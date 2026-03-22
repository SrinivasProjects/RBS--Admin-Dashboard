import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getUserFromRequest } from "@/lib/getUser"
import { authorize } from "@/lib/authorize"
import { Prisma, OrderStatus } from "@prisma/client"

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req)
    authorize(user.role, ["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER"])

    const where: Prisma.OrderWhereInput = {
      ...(user.role !== "SUPER_ADMIN" && { restaurant_id: user.restaurant_id! }),
      status: { in: ["RUNNING", "HOLD"] as OrderStatus[] },
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: {
          select: {
            item_name:   true,
            category:    true,
            quantity:    true,
            unit_price:  true,
            total_price: true,
            notes:       true,
          },
        },
        kots:     { select: { id: true } },
        payments: {
          where:  { status: "PAID" },
          select: { amount: true },
        },
      },
      orderBy: { ordered_at: "asc" },
    })

    const now = new Date()

    const data = orders.map((order) => {
      const paid_amount = order.payments.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      )
      const due_amount = Number(order.total_amount) - paid_amount

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
        subtotal:         Number(order.subtotal),
        discount_amount:  Number(order.discount_amount),
        tax_amount:       Number(order.tax_amount),
        total_amount:     Number(order.total_amount),
        paid_amount:      Number(paid_amount.toFixed(2)),
        due_amount:       Number(due_amount.toFixed(2)),
        kot_count:        order.kots.length,
        items:            order.items.map((item) => ({
          item_name:   item.item_name,
          category:    item.category,
          quantity:    Number(item.quantity),
          unit_price:  Number(item.unit_price),
          total_price: Number(item.total_price),
          notes:       item.notes,
        })),
        ordered_at:       order.ordered_at,
        elapsed_minutes:  Math.floor(
          (now.getTime() - new Date(order.ordered_at).getTime()) / 60000
        ),
      }
    })

    return NextResponse.json({ data, total: data.length })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
