import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { NextResponse } from "next/server"

const MAX_OTP_ATTEMPTS = 5

export async function POST(req: Request) {
  try {
    const { contact, otp, purpose } = await req.json()

    // Find the most recent unused OTP record for this contact+purpose
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

    if (record.expires_at < new Date()) {
      return NextResponse.json(
        { error: "OTP expired" },
        { status: 400 }
      )
    }

    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      return NextResponse.json(
        { error: "Too many attempts. Please request a new OTP." },
        { status: 429 }
      )
    }

    const otpHash = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex")

    if (record.otp_hash !== otpHash) {
      // Increment attempt counter on wrong guess
      await prisma.otpVerification.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } }
      })
      return NextResponse.json(
        { error: "Invalid OTP" },
        { status: 400 }
      )
    }

    await prisma.otpVerification.update({
      where: { id: record.id },
      data: { is_used: true }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}