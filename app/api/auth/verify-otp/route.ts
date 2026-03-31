import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { NextResponse } from "next/server"
import { Role } from "@prisma/client"

const MAX_OTP_ATTEMPTS = 5

export async function POST(req: Request) {
  try {
    const { contact, otp, purpose } = await req.json()

    if (!contact || !otp || !purpose) {
      return NextResponse.json({ error: "contact, otp, and purpose are required" }, { status: 400 })
    }

    // Find latest unused OTP for this contact + purpose
    const record = await prisma.otpVerification.findFirst({
      where: { contact, purpose, is_used: false },
      orderBy: { created_at: "desc" },
    })

    if (!record) {
      return NextResponse.json({ error: "Invalid OTP" }, { status: 400 })
    }

    // Expiry check
    if (record.expires_at < new Date()) {
      return NextResponse.json({ error: "OTP has expired. Please request a new one." }, { status: 400 })
    }

    // Brute-force attempt limit
    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      return NextResponse.json(
        { error: "Too many failed attempts. Please request a new OTP." },
        { status: 429 }
      )
    }

    // Verify OTP hash
    const otpHash = crypto.createHash("sha256").update(String(otp)).digest("hex")

    if (record.otp_hash !== otpHash) {
      await prisma.otpVerification.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      })
      return NextResponse.json({ error: "Invalid OTP" }, { status: 400 })
    }

    // ── REGISTER flow ────────────────────────────────────────────────────────
    if (purpose === "REGISTER") {
      if (!record.temp_name || !record.temp_password) {
        return NextResponse.json({ error: "Registration data is incomplete" }, { status: 400 })
      }

      const existingUser = await prisma.user.findUnique({ where: { email: record.contact } })
      if (existingUser) {
        return NextResponse.json({ error: "An account with this email already exists" }, { status: 400 })
      }

      // Role is always OWNER for self-registration — SUPER_ADMIN is server-assigned only
      const userRole: Role = Role.OWNER

      // Atomic: restaurant + user created together or neither
      await prisma.$transaction(async (tx) => {
        const restaurant = await tx.restaurant.create({
          data: {
            name: record.temp_restaurant?.trim() || `${record.temp_name}'s Restaurant`,
          },
        })

        await tx.user.create({
          data: {
            name: record.temp_name!,
            email: record.contact,
            password_hash: record.temp_password!, // already bcrypt-hashed in register route
            role: userRole,
            restaurant_id: restaurant.id,
          },
        })
      })
    }

    // Mark OTP as used — runs for all purposes
    await prisma.otpVerification.update({
      where: { id: record.id },
      data: { is_used: true },
    })

    return NextResponse.json({ success: true, message: "Verified successfully" })
  } catch (error) {
    console.error("[verify-otp]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
