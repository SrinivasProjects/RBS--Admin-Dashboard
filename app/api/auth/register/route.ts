import { prisma } from "@/lib/prisma"
import bcrypt from "bcrypt"
import crypto from "crypto"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, email, password } = body

    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists with this email" },
        { status: 400 }
      )
    }

    const hash = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password_hash: hash,
        role: "OWNER"
      }
    })

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()

    const otpHash = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex")

    await prisma.otpVerification.create({
      data: {
        user_id: user.id,
        contact: email,
        otp_hash: otpHash,
        purpose: "REGISTER",
        expires_at: new Date(Date.now() + 5 * 60 * 1000)
      }
    })

    return NextResponse.json({
      message: "User created. Verify OTP.",
      otp 
    })

  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}