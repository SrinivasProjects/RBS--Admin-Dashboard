import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/getUser"
import { authorize } from "@/lib/authorize"
import { Prisma } from "@prisma/client"

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req)
    authorize(user.role, ["OWNER", "MANAGER", "SUPER_ADMIN"])

    if (user.restaurant_id === null) {
      return NextResponse.json(
        { success: false, error: "SUPER_ADMIN must specify a restaurant context" },
        { status: 400 }
      )
    }

    const { name, price } = await req.json()

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ success: false, error: "Addon name is required" }, { status: 400 })
    }
    if (price === undefined || isNaN(Number(price)) || Number(price) < 0) {
      return NextResponse.json({ success: false, error: "Valid price is required" }, { status: 400 })
    }

    const addon = await prisma.addon.create({
      data: {
        name: name.trim(),
        price: new Prisma.Decimal(price),
        restaurant_id: user.restaurant_id,
      },
    })

    return NextResponse.json({ success: true, addon: { ...addon, price: Number(addon.price) } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error"
    const isAuthError = message === "Unauthorized" || message === "No token"
    return NextResponse.json(
      { success: false, error: isAuthError ? message : "Internal server error" },
      { status: isAuthError ? (message === "No token" ? 401 : 403) : 500 }
    )
  }
}
