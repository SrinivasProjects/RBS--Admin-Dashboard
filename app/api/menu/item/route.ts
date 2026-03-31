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

    const { name, price, category_id, is_veg, code, description } = await req.json()

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ success: false, error: "Item name is required" }, { status: 400 })
    }
    if (price === undefined || isNaN(Number(price)) || Number(price) < 0) {
      return NextResponse.json({ success: false, error: "Valid price is required" }, { status: 400 })
    }
    if (!category_id || typeof category_id !== "number") {
      return NextResponse.json({ success: false, error: "category_id is required" }, { status: 400 })
    }

    // Ownership check — category must belong to the user's restaurant
    const category = await prisma.category.findUnique({ where: { id: category_id } })
    if (!category || category.restaurant_id !== user.restaurant_id) {
      return NextResponse.json(
        { success: false, error: "Category not found in your restaurant" },
        { status: 403 }
      )
    }

    const item = await prisma.item.create({
      data: {
        name: name.trim(),
        price: new Prisma.Decimal(price),
        category_id,
        restaurant_id: user.restaurant_id,
        is_veg: typeof is_veg === "boolean" ? is_veg : true,
        code: code?.trim() ?? null,
        description: description?.trim() ?? null,
      },
    })

    return NextResponse.json({ success: true, item: { ...item, price: Number(item.price) } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error"
    const isAuthError = message === "Unauthorized" || message === "No token"
    return NextResponse.json(
      { success: false, error: isAuthError ? message : "Internal server error" },
      { status: isAuthError ? (message === "No token" ? 401 : 403) : 500 }
    )
  }
}
