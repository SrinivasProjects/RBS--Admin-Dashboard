import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/getUser"

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req)

    // SUPER_ADMIN (restaurant_id: null) gets all active categories across all restaurants
    // All other roles are scoped to their own restaurant
    const where =
      user.restaurant_id !== null
        ? { restaurant_id: user.restaurant_id, is_active: true }
        : { is_active: true }

    const categories = await prisma.category.findMany({
      where,
      orderBy: { display_order: "asc" },
      include: {
        items: {
          where: { is_available: true },
          orderBy: { name: "asc" },
          include: {
            variants: true,
            addons: {
              include: { addon: true },
            },
          },
        },
      },
    })

    const menu = categories.map((cat) => ({
      id: cat.id,
      restaurant_id: cat.restaurant_id,
      name: cat.name,
      display_order: cat.display_order,
      items: cat.items.map((item) => ({
        id: item.id,
        name: item.name,
        code: item.code,
        description: item.description,
        price: Number(item.price),
        is_veg: item.is_veg,
        is_available: item.is_available,
        variants: item.variants.map((v) => ({
          id: v.id,
          name: v.name,
          price: Number(v.price),
        })),
        addons: item.addons.map((a) => ({
          id: a.addon.id,
          name: a.addon.name,
          price: Number(a.addon.price),
        })),
      })),
    }))

    return NextResponse.json({ success: true, menu })
  } catch (error) {
    console.error("[menu GET]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
