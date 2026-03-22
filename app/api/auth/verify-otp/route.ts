import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { Role } from "@prisma/client"

const MAX_OTP_ATTEMPTS = 5

export async function POST(req: Request) {
  try {
    const { contact, otp, purpose } = await req.json()

    // Find latest unused OTP
    const record = await prisma.otpVerification.findFirst({
      where: {
        contact,
        purpose,
        is_used: false
      },
      orderBy: { created_at: "desc" }
    })

    if (!record) {
      return NextResponse.json(
        { error: "Invalid OTP" },
        { status: 400 }
      )
    }

    // Expiry check
    if (record.expires_at < new Date()) {
      return NextResponse.json(
        { error: "OTP expired" },
        { status: 400 }
      )
    }

    // Attempt limit check
    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      return NextResponse.json(
        { error: "Too many attempts. Please request a new OTP." },
        { status: 429 }
      )
    }

    // Hash incoming OTP
    const otpHash = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex")

    // Invalid OTP
    if (record.otp_hash !== otpHash) {
      await prisma.otpVerification.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } }
      })

      return NextResponse.json(
        { error: "Invalid OTP" },
        { status: 400 }
      )
    }

    

    // Validate temp data
    if (!record.temp_name || !record.temp_password) {
      return NextResponse.json(
        { error: "Invalid registration data" },
        { status: 400 }
      )
    }

    // Prevent duplicate users
    const existingUser = await prisma.user.findUnique({
      where: { email: record.contact }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      )
    }

    // Hash password
    const hash = await bcrypt.hash(record.temp_password, 10)

    // Role logic
    let userRole: Role = Role.OWNER
    if (record.temp_role === Role.SUPER_ADMIN) {
      userRole = Role.SUPER_ADMIN
    }

    // Create restaurant if needed
    let restaurantId = null

    if (userRole !== Role.SUPER_ADMIN) {
      const restaurant = await prisma.restaurant.create({
        data: {
          name:
            record.temp_restaurant ||
            `${record.temp_name}'s Restaurant`
        }
      })

      restaurantId = restaurant.id
    }

    // Create user
    await prisma.user.create({
      data: {
        name: record.temp_name,
        email: record.contact,
        password_hash: hash,
        role: userRole,
        restaurant_id: restaurantId
      }
    })

    // Mark OTP as used (AFTER success)
    await prisma.otpVerification.update({
      where: { id: record.id },
      data: { is_used: true }
    })

    return NextResponse.json({
      success: true,
      message: "User registered successfully"
    })

  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}