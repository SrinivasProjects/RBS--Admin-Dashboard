import { prisma } from "@/lib/prisma"
import bcrypt from "bcrypt"
import { getUserFromRequest } from "@/lib/getUser"
import { NextResponse } from "next/server"

export async function PUT(req: Request) {

  const user = getUserFromRequest(req)

  const { oldPassword, newPassword } = await req.json()

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id }
  })

  const valid = await bcrypt.compare(
    oldPassword,
    dbUser!.password_hash
  )

  if (!valid) {
    return NextResponse.json(
      { error: "Invalid password" },
      { status: 400 }
    )
  }

  const hash = await bcrypt.hash(newPassword, 10)

  await prisma.user.update({
    where: { id: user.id },
    data: { password_hash: hash }
  })

  return NextResponse.json({
    message: "Password updated"
  })
}