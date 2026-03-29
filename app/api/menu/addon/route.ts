import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/getUser"
import { Prisma } from "@prisma/client"
// cretes addon 
export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req)

    const { name, price } = await req.json()

    if (!name || !price) {
      return NextResponse.json(
        { success: false, message: "Name and price required" },
        { status: 400 }
      )
    }

    const addon = await prisma.addon.create({
      data: {
        name,
        price: new Prisma.Decimal(price),
        restaurant_id: user.restaurant_id
      }
    })

    return NextResponse.json({ success: true, addon })
  } catch (error) {
    console.error("ADDON ERROR:", error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}