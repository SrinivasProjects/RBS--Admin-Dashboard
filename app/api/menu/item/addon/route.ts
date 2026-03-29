import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
// mapp adons
export async function POST(req: Request) {
  try {
    const { item_id, addon_id } = await req.json()

    if (!item_id || !addon_id) {
      return NextResponse.json(
        { success: false, message: "Missing fields" },
        { status: 400 }
      )
    }

    const mapping = await prisma.itemAddon.create({
      data: {
        item_id,
        addon_id
      }
    })

    return NextResponse.json({ success: true, mapping })
  } catch (error) {
    console.error("MAPPING ERROR:", error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}