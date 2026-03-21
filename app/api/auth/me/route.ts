import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/getUser"

export async function GET(req: Request) {
  try {
    const decoded: any = getUserFromRequest(req)

    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(user)

  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }
}