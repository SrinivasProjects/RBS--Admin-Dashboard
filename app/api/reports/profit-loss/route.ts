import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { getUserFromRequest } from "@/lib/getUser"
import { authorize } from "@/lib/authorize"

type GroupBy = "day" | "week" | "month"

type PeriodRow = {
  period:        Date
  orders:        number
  gross_revenue: string
  discount:      string
  tax:           string
}

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req)
    authorize(user.role, ["SUPER_ADMIN", "OWNER", "MANAGER"])

    const { searchParams } = req.nextUrl

    const fromParam  = searchParams.get("from")
    const toParam    = searchParams.get("to")
    const groupByRaw = searchParams.get("group_by") ?? "day"

    if (!fromParam || !toParam) {
      return NextResponse.json(
        { error: "from and to query params are required" },
        { status: 400 }
      )
    }

    const VALID_GROUP_BY: GroupBy[] = ["day", "week", "month"]
    if (!VALID_GROUP_BY.includes(groupByRaw as GroupBy)) {
      return NextResponse.json(
        { error: "group_by must be day, week, or month" },
        { status: 400 }
      )
    }
    const groupBy = groupByRaw as GroupBy

    const from = new Date(fromParam)
    const to   = new Date(toParam)
    // Include all of the `to` day
    to.setHours(23, 59, 59, 999)

    const restaurantFilter: Prisma.OrderWhereInput =
      user.role !== "SUPER_ADMIN"
        ? { restaurant_id: user.restaurant_id! }
        : {}

    const orderWhere: Prisma.OrderWhereInput = {
      ...restaurantFilter,
      ordered_at: { gte: from, lte: to },
    }

    const paymentWhere: Prisma.PaymentWhereInput = {
      ...(user.role !== "SUPER_ADMIN" && { restaurant_id: user.restaurant_id! }),
      paid_at: { gte: from, lte: to },
      status:  "PAID",
    }

    // ── Run all aggregations in parallel ────────────────────────────────────
    const [byStatus, byType, paymentTotals, periodRows] = await Promise.all([

      prisma.order.groupBy({
        by:    ["status"],
        where: orderWhere,
        _count: { id: true },
        _sum:  { total_amount: true, discount_amount: true, tax_amount: true },
      }),

      prisma.order.groupBy({
        by:    ["order_type"],
        where: { ...orderWhere, status: "COMPLETED" },
        _count: { id: true },
        _sum:  { total_amount: true },
      }),

      prisma.payment.groupBy({
        by:    ["method"],
        where: paymentWhere,
        _sum:  { amount: true },
      }),

      // Period breakdown — requires raw SQL for date_trunc
      prisma.$queryRaw<PeriodRow[]>(Prisma.sql`
        SELECT
          date_trunc(${groupBy}, ordered_at) AS period,
          COUNT(*)::int                      AS orders,
          COALESCE(SUM(total_amount), 0)     AS gross_revenue,
          COALESCE(SUM(discount_amount), 0)  AS discount,
          COALESCE(SUM(tax_amount), 0)       AS tax
        FROM orders
        WHERE
          ${user.role !== "SUPER_ADMIN"
            ? Prisma.sql`restaurant_id = ${user.restaurant_id!} AND`
            : Prisma.sql``}
          status      = 'COMPLETED'
          AND ordered_at >= ${from}
          AND ordered_at <= ${to}
        GROUP BY 1
        ORDER BY 1 ASC
      `),
    ])

    // ── Build summary ────────────────────────────────────────────────────────
    let total_orders      = 0
    let completed_orders  = 0
    let cancelled_orders  = 0
    let gross_revenue     = 0
    let total_discount    = 0
    let tax_collected     = 0

    for (const row of byStatus) {
      total_orders += row._count.id
      if (row.status === "COMPLETED") {
        completed_orders = row._count.id
        gross_revenue    = Number(row._sum.total_amount   ?? 0)
        total_discount   = Number(row._sum.discount_amount ?? 0)
        tax_collected    = Number(row._sum.tax_amount      ?? 0)
      }
      if (row.status === "CANCELLED") {
        cancelled_orders = row._count.id
      }
    }

    const collected: Record<string, number> = {}
    let total_paid = 0
    for (const row of paymentTotals) {
      const amount = Number(row._sum.amount ?? 0)
      collected[row.method] = amount
      total_paid += amount
    }

    const total_due = Number((gross_revenue - total_paid).toFixed(2))
    const net_revenue = Number((gross_revenue - total_discount).toFixed(2))

    // ── Build by_type ────────────────────────────────────────────────────────
    const by_type: Record<string, { orders: number; revenue: number }> = {}
    for (const row of byType) {
      by_type[row.order_type] = {
        orders:  row._count.id,
        revenue: Number(row._sum.total_amount ?? 0),
      }
    }

    // ── Build breakdown ──────────────────────────────────────────────────────
    const breakdown = periodRows.map((row) => {
      const rev  = parseFloat(row.gross_revenue)
      const disc = parseFloat(row.discount)
      const tax  = parseFloat(row.tax)
      return {
        period:        row.period,
        orders:        row.orders,
        gross_revenue: rev,
        discount:      disc,
        tax,
        net_revenue:   Number((rev - disc).toFixed(2)),
      }
    })

    return NextResponse.json({
      summary: {
        total_orders,
        completed_orders,
        cancelled_orders,
        gross_revenue:   Number(gross_revenue.toFixed(2)),
        total_discount:  Number(total_discount.toFixed(2)),
        tax_collected:   Number(tax_collected.toFixed(2)),
        net_revenue,
        total_due:       Math.max(0, total_due),
        collected,
      },
      by_type,
      breakdown,
    })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
