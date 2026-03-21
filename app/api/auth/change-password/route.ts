import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { getUserFromRequest } from "@/lib/getUser"
import { NextResponse } from "next/server"

export async function PUT(req: Request) {
  try {
    const user = getUserFromRequest(req)

    const { oldPassword, newPassword } = await req.json()

    const dbUser = await prisma.user.findUnique({
      where: { id: (user as any).id }
    })

    if (!dbUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    const valid = await bcrypt.compare(oldPassword, dbUser.password_hash)

    if (!valid) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 400 }
      )
    }

    const hash = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
      where: { id: dbUser.id },
      data: { password_hash: hash }
    })

    return NextResponse.json({
      message: "Password updated"
    })

  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }
}