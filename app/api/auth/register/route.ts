import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"
import { sendEmail } from "@/lib/sendEmail"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, email, password, restaurantName } = body

    // Input validation
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 })
    }
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    // Check for existing user before doing any expensive work
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 400 })
    }

    // Hash password BEFORE storing — never persist plaintext credentials
    const passwordHash = await bcrypt.hash(password, 12)

    // Cryptographically secure OTP
    const otp = crypto.randomInt(100_000, 999_999).toString()
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex")

    await prisma.otpVerification.create({
      data: {
        contact: email,
        otp_hash: otpHash,
        purpose: "REGISTER",
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
        temp_name: name.trim(),
        temp_password: passwordHash,       // bcrypt hash — never plaintext
        temp_restaurant: restaurantName?.trim() ?? null,
        temp_role: null,                   // role is assigned server-side in verify-otp
      },
    })

    await sendEmail(email, otp)

    return NextResponse.json({ message: "OTP sent to your email. Please verify to complete registration." })
  } catch (error) {
    console.error("[register]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
