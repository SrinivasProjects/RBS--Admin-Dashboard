import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/getUser"
// menu fetching route
export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req)

    const categories = await prisma.category.findMany({
      where: {
        restaurant_id: user.restaurant_id
      },
      include: {
        items: {
          include: {
            variants: true,
            addons: {
              include: {
                addon: true
              }
            }
          }
        }
      }
    })

    const menu = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      items: cat.items.map((item) => ({
        id: item.id,
        name: item.name,
        price: Number(item.price),
        is_veg: item.is_veg,
        variants: item.variants,
        addons: item.addons.map((a) => a.addon)
      }))
    }))

    return NextResponse.json({ success: true, menu })
  } catch (error) {
    console.error("MENU ERROR:", error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}