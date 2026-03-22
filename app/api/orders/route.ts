import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getUserFromRequest } from "@/lib/getUser"
import { authorize } from "@/lib/authorize"
import { parsePagination, buildMeta } from "@/lib/pagination"

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req)
    authorize(user.role, ["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER"])

    const { searchParams } = req.nextUrl
    const { page, limit, skip } = parsePagination(searchParams)

    // ── Filters ─────────────────────────────────────────────────────────────
    const status     = searchParams.get("status")     as Prisma.EnumOrderStatusFilter | null
    const order_type = searchParams.get("order_type") as Prisma.EnumOrderTypeFilter  | null
    const search     = searchParams.get("search")
    const fromParam  = searchParams.get("from")
    const toParam    = searchParams.get("to")

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const from = fromParam ? new Date(fromParam) : today
    const to   = toParam   ? new Date(toParam)   : tomorrow

    const where: Prisma.OrderWhereInput = {
      ...(user.role !== "SUPER_ADMIN" && { restaurant_id: user.restaurant_id! }),
      ordered_at: { gte: from, lt: to },
      ...(status     && { status }),
      ...(order_type && { order_type }),
      ...(search && {
        OR: [
          { order_number:   { contains: search, mode: "insensitive" } },
          { customer_name:  { contains: search, mode: "insensitive" } },
        ],
      }),
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: {
          id:               true,
          order_number:     true,
          order_type:       true,
          status:           true,
          table_number:     true,
          covers:           true,
          customer_name:    true,
          customer_phone:   true,
          platform:         true,
          platform_order_id: true,
          subtotal:         true,
          discount_amount:  true,
          tax_amount:       true,
          total_amount:     true,
          notes:            true,
          ordered_at:       true,
          completed_at:     true,
          payments: {
            where:  { status: "PAID" },
            select: { amount: true, method: true },
          },
        },
        orderBy: { ordered_at: "desc" },
        skip,
        take:  limit,
      }),
      prisma.order.count({ where }),
    ])

    // Aggregate revenue across the current page for the summary
    const revenueAgg = await prisma.order.aggregate({
      where,
      _sum: { total_amount: true },
    })

    const data = orders.map((order) => {
      const paid_amount = order.payments.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      )
      return {
        id:               order.id,
        order_number:     order.order_number,
        order_type:       order.order_type,
        status:           order.status,
        table_number:     order.table_number,
        covers:           order.covers,
        customer_name:    order.customer_name,
        customer_phone:   order.customer_phone,
        platform:         order.platform,
        platform_order_id: order.platform_order_id,
        subtotal:         Number(order.subtotal),
        discount_amount:  Number(order.discount_amount),
        tax_amount:       Number(order.tax_amount),
        total_amount:     Number(order.total_amount),
        paid_amount:      Number(paid_amount.toFixed(2)),
        due_amount:       Number(
          (Number(order.total_amount) - paid_amount).toFixed(2)
        ),
        ordered_at:       order.ordered_at,
        completed_at:     order.completed_at,
      }
    })

    return NextResponse.json({
      data,
      meta: {
        ...buildMeta(total, { page, limit, skip }),
        summary: {
          total_orders:  total,
          total_revenue: Number((revenueAgg._sum.total_amount ?? 0).toString()),
        },
      },
    })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
