import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getUserFromRequest } from "@/lib/getUser"
import { authorize } from "@/lib/authorize"
import { parsePagination, buildMeta } from "@/lib/pagination"

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req)
    authorize(user.role, ["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER", "KITCHEN"])

    const { searchParams } = req.nextUrl
    const { page, limit, skip } = parsePagination(searchParams)

    const statusParam  = searchParams.get("status") as Prisma.EnumKotStatusFilter | null
    const order_id     = searchParams.get("order_id")
    const dateParam    = searchParams.get("date")

    const date = dateParam ? new Date(dateParam) : new Date()
    date.setHours(0, 0, 0, 0)
    const nextDay = new Date(date)
    nextDay.setDate(nextDay.getDate() + 1)

    const where: Prisma.KotWhereInput = {
      ...(user.role !== "SUPER_ADMIN" && { restaurant_id: user.restaurant_id! }),
      created_at: { gte: date, lt: nextDay },
      ...(statusParam && { status: statusParam }),
      ...(order_id    && { order_id: parseInt(order_id, 10) }),
    }

    const [kots, total] = await Promise.all([
      prisma.kot.findMany({
        where,
        select: {
          id:         true,
          kot_number: true,
          status:     true,
          notes:      true,
          printed_at: true,
          created_at: true,
          order: {
            select: {
              order_number: true,
              table_number: true,
              order_type:   true,
            },
          },
          items: {
            select: {
              item_name: true,
              quantity:  true,
              notes:     true,
            },
          },
        },
        orderBy: { created_at: "desc" },
        skip,
        take:  limit,
      }),
      prisma.kot.count({ where }),
    ])

    const data = kots.map((kot) => ({
      id:           kot.id,
      order_id:     undefined, // resolved from order relation
      order_number: kot.order.order_number,
      table_number: kot.order.table_number,
      order_type:   kot.order.order_type,
      kot_number:   kot.kot_number,
      status:       kot.status,
      notes:        kot.notes,
      printed_at:   kot.printed_at,
      created_at:   kot.created_at,
      items:        kot.items.map((item) => ({
        item_name: item.item_name,
        quantity:  Number(item.quantity),
        notes:     item.notes,
      })),
    }))

    return NextResponse.json({
      data,
      meta: buildMeta(total, { page, limit, skip }),
    })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
