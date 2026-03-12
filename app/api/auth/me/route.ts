import { prisma } from "@/lib/prisma"
import jwt from "jsonwebtoken"
import { NextResponse } from "next/server"

export async function GET(req: Request) {

  const authHeader = req.headers.get("authorization")

  if (!authHeader) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  const token = authHeader.split(" ")[1]

  const decoded: any = jwt.verify(
    token,
    process.env.JWT_SECRET!
  )

  const user = await prisma.user.findUnique({
    where: { id: decoded.id }
  })

  return NextResponse.json(user)
}