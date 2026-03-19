import { prisma } from "@/lib/prisma"
import jwt from "jsonwebtoken"
import crypto from "crypto"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { refreshToken } = await req.json()

    if (!refreshToken) {
      return NextResponse.json(
        { error: "Refresh token required" },
        { status: 400 }
      )
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex")

    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token_hash: tokenHash },
      include: { user: true }
    })

    if (!tokenRecord) {
      return NextResponse.json(
        { error: "Invalid refresh token" },
        { status: 401 }
      )
    }

    if (tokenRecord.expires_at < new Date()) {
      return NextResponse.json(
        { error: "Refresh token expired" },
        { status: 401 }
      )
    }

    const newAccessToken = jwt.sign(
      {
        id: tokenRecord.user.id,
        role: tokenRecord.user.role
        restaurant_id:tokenRecord.user.restaurant_id
      },
      process.env.JWT_SECRET!,
      { expiresIn: "15m" }
    )

    return NextResponse.json({
      accessToken: newAccessToken
    })

  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}