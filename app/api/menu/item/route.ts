import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/getUser"
import { Prisma } from "@prisma/client"
// item creation route
export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req)

    const { name, price, category_id, is_veg } = await req.json()

    if (!name || !price || !category_id) {
      return NextResponse.json(
        { success: false, message: "Required fields missing" },
        { status: 400 }
      )
    }

    const item = await prisma.item.create({
      data: {
        name,
        price: new Prisma.Decimal(price),
        category_id,
        is_veg,
        restaurant_id: user.restaurant_id
      }
    })

    return NextResponse.json({ success: true, item })
  } catch (error) {
    console.error("ITEM ERROR:", error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}