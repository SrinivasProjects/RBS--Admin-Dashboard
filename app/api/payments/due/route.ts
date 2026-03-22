import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getUserFromRequest } from "@/lib/getUser"
import { authorize } from "@/lib/authorize"
import { parsePagination, buildMeta } from "@/lib/pagination"
import { Prisma } from "@prisma/client"

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req)
    authorize(user.role, ["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER"])

    const { searchParams } = req.nextUrl
    const { page, limit, skip } = parsePagination(searchParams)

    const fromParam = searchParams.get("from")
    const toParam   = searchParams.get("to")

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const from = fromParam ? new Date(fromParam) : today
    const to   = toParam   ? new Date(toParam)   : tomorrow

    // Fetch non-cancelled orders in range, with their payments
    const where: Prisma.OrderWhereInput = {
      ...(user.role !== "SUPER_ADMIN" && { restaurant_id: user.restaurant_id! }),
      ordered_at: { gte: from, lt: to },
      status:     { not: "CANCELLED" },
    }

    const orders = await prisma.order.findMany({
      where,
      select: {
        id:             true,
        order_number:   true,
        order_type:     true,
        status:         true,
        table_number:   true,
        customer_name:  true,
        customer_phone: true,
        total_amount:   true,
        ordered_at:     true,
        payments: {
          select: {
            method:          true,
            amount:          true,
            status:          true,
            transaction_ref: true,
            paid_at:         true,
          },
        },
      },
      orderBy: { ordered_at: "desc" },
    })

    // Filter to only those with an outstanding balance
    const dueOrders = orders
      .map((order) => {
        const paid_amount = order.payments
          .filter((p) => p.status === "PAID")
          .reduce((sum, p) => sum + Number(p.amount), 0)
        const due_amount = Number(order.total_amount) - paid_amount
        return { ...order, paid_amount, due_amount }
      })
      .filter((order) => order.due_amount > 0)

    const total     = dueOrders.length
    const total_due = dueOrders.reduce((sum, o) => sum + o.due_amount, 0)
    const paginated = dueOrders.slice(skip, skip + limit)

    const data = paginated.map((order) => ({
      id:             order.id,
      order_number:   order.order_number,
      order_type:     order.order_type,
      status:         order.status,
      table_number:   order.table_number,
      customer_name:  order.customer_name,
      customer_phone: order.customer_phone,
      total_amount:   Number(order.total_amount),
      paid_amount:    Number(order.paid_amount.toFixed(2)),
      due_amount:     Number(order.due_amount.toFixed(2)),
      ordered_at:     order.ordered_at,
      payments:       order.payments.map((p) => ({
        method:          p.method,
        amount:          Number(p.amount),
        status:          p.status,
        transaction_ref: p.transaction_ref,
        paid_at:         p.paid_at,
      })),
    }))

    return NextResponse.json({
      data,
      meta: {
        ...buildMeta(total, { page, limit, skip }),
        total_due: Number(total_due.toFixed(2)),
      },
    })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
