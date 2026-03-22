import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { verifyRefreshToken, generateAccessToken, hashToken } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const { refreshToken } = await req.json()

    if (!refreshToken) {
      return NextResponse.json(
        { error: "Refresh token required" },
        { status: 400 }
      )
    }

    // Verify JWT signature before any DB query
    try {
      verifyRefreshToken(refreshToken)
    } catch {
      return NextResponse.json(
        { error: "Invalid refresh token" },
        { status: 401 }
      )
    }

    const tokenHash   = hashToken(refreshToken)
    const tokenRecord = await prisma.refreshToken.findUnique({
      where:   { token_hash: tokenHash },
      include: { user: true },
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

    const newAccessToken = generateAccessToken(tokenRecord.user)

    return NextResponse.json({ accessToken: newAccessToken })

  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
