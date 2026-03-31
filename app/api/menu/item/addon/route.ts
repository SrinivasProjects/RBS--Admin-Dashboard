import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/getUser"
import { authorize } from "@/lib/authorize"

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

    const { item_id, addon_id } = await req.json()

    if (!item_id || typeof item_id !== "number") {
      return NextResponse.json({ success: false, error: "item_id is required" }, { status: 400 })
    }
    if (!addon_id || typeof addon_id !== "number") {
      return NextResponse.json({ success: false, error: "addon_id is required" }, { status: 400 })
    }

    // Ownership checks — both item and addon must belong to the user's restaurant
    const [item, addon] = await Promise.all([
      prisma.item.findUnique({ where: { id: item_id }, select: { restaurant_id: true } }),
      prisma.addon.findUnique({ where: { id: addon_id }, select: { restaurant_id: true } }),
    ])

    if (!item || item.restaurant_id !== user.restaurant_id) {
      return NextResponse.json(
        { success: false, error: "Item not found in your restaurant" },
        { status: 403 }
      )
    }
    if (!addon || addon.restaurant_id !== user.restaurant_id) {
      return NextResponse.json(
        { success: false, error: "Addon not found in your restaurant" },
        { status: 403 }
      )
    }

    const mapping = await prisma.itemAddon.create({
      data: { item_id, addon_id },
    })

    return NextResponse.json({ success: true, mapping })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error"
    const isAuthError = message === "Unauthorized" || message === "No token"
    return NextResponse.json(
      { success: false, error: isAuthError ? message : "Internal server error" },
      { status: isAuthError ? (message === "No token" ? 401 : 403) : 500 }
    )
  }
}
