import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"
import { generateAccessToken, generateRefreshToken, hashToken } from "@/lib/auth"

const MAX_SESSIONS_PER_USER = 5

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })

    if (!user || !user.is_active) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const accessToken  = generateAccessToken(user)
    const refreshToken = generateRefreshToken(user.id)
    const tokenHash    = hashToken(refreshToken)
    const expiresAt    = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await prisma.$transaction(async (tx) => {
      // Purge expired tokens for this user first
      await tx.refreshToken.deleteMany({
        where: { user_id: user.id, expires_at: { lt: new Date() } },
      })

      // Enforce session limit — delete oldest if at cap
      const existing = await tx.refreshToken.findMany({
        where:   { user_id: user.id },
        orderBy: { created_at: "asc" },
        select:  { id: true },
      })

      if (existing.length >= MAX_SESSIONS_PER_USER) {
        const toDelete = existing.slice(0, existing.length - MAX_SESSIONS_PER_USER + 1)
        await tx.refreshToken.deleteMany({
          where: { id: { in: toDelete.map((t) => t.id) } },
        })
      }

      // Create new session
      await tx.refreshToken.create({
        data: { user_id: user.id, token_hash: tokenHash, expires_at: expiresAt },
      })

      // Update last login
      await tx.user.update({
        where: { id: user.id },
        data:  { last_login_at: new Date() },
      })
    })

    return NextResponse.json({ accessToken, refreshToken })

  } catch (error) {
    console.error("[login]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
