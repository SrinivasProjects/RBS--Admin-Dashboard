import { prisma } from "@/lib/prisma"
import { getUserFromRequest } from "@/lib/getUser"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  try {
    const user: any = getUserFromRequest(req)

    const data = await prisma.restaurant.findMany({
      where: user.role === "SUPER_ADMIN"
        ? {}
        : { id: user.restaurant_id }
    })

    return NextResponse.json(data)

  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }
}