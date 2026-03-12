import { prisma } from "@/lib/prisma"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { NextResponse } from "next/server"

export async function PUT(req: Request) {

  const { oldPassword, newPassword } = await req.json()

  const authHeader = req.headers.get("authorization")

  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const token = authHeader.split(" ")[1]

  const decoded: any = jwt.verify(
    token,
    process.env.JWT_SECRET!
  )

  const user = await prisma.user.findUnique({
    where: { id: decoded.id }
  })

  if (!user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    )
  }

  const valid = await bcrypt.compare(
    oldPassword,
    user.password_hash
  )

  if (!valid) {
    return NextResponse.json(
      { error: "Wrong password" },
      { status: 400 }
    )
  }

  const hashed = await bcrypt.hash(newPassword, 10)

  await prisma.user.update({
    where: { id: user.id },
    data: { password_hash: hashed }
  })

  return NextResponse.json({
    message: "Password updated"
  })
}