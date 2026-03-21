import { prisma } from "@/lib/prisma"
import jwt from "jsonwebtoken"
import { NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/getUser"

export async function GET(req: Request) {

  // const authHeader = req.headers.get("authorization")

  // if (!authHeader) {
  //   return NextResponse.json(
  //     { error: "Unauthorized" },
  //     { status: 401 }
  //   )
  // }

  // const token = authHeader.split(" ")[1]

  const decoded: any = getUserFromRequest(req)

  const user = await prisma.user.findUnique({
    where: { id: decoded.id }
  })

  return NextResponse.json(user)
}