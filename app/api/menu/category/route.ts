import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/getUser"
import { authorize } from "@/lib/authorize"

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req)
    authorize(user.role, ["OWNER", "MANAGER", "SUPER_ADMIN"])

    // SUPER_ADMIN must not create categories without a restaurant context
    if (user.restaurant_id === null) {
      return NextResponse.json(
        { success: false, error: "SUPER_ADMIN must specify a restaurant context" },
        { status: 400 }
      )
    }

    const { name, display_order } = await req.json()

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Category name is required" },
        { status: 400 }
      )
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        display_order: typeof display_order === "number" ? display_order : 0,
        restaurant_id: user.restaurant_id,
      },
    })

    return NextResponse.json({ success: true, category })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error"
    const isAuthError = message === "Unauthorized" || message === "No token"
    return NextResponse.json(
      { success: false, error: isAuthError ? message : "Internal server error" },
      { status: isAuthError ? (message === "No token" ? 401 : 403) : 500 }
    )
  }
}
