import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { sendEmail } from "@/lib/sendEmail"
import { NextResponse } from "next/server"
import { OtpPurpose } from "@prisma/client"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { contact, purpose } = body

    // Input validation
    if (!contact || typeof contact !== "string") {
      return NextResponse.json({ error: "Contact is required" }, { status: 400 })
    }
    if (!purpose || !Object.values(OtpPurpose).includes(purpose as OtpPurpose)) {
      return NextResponse.json({ error: "Invalid purpose" }, { status: 400 })
    }

    // Rate limit — one OTP per contact per 60 seconds
    const lastOtp = await prisma.otpVerification.findFirst({
      where: { contact },
      orderBy: { created_at: "desc" },
    })

    if (lastOtp && Date.now() - new Date(lastOtp.created_at).getTime() < 60_000) {
      return NextResponse.json(
        { error: "Please wait before requesting another OTP" },
        { status: 429 }
      )
    }

    // Cryptographically secure 6-digit OTP
    const otp = crypto.randomInt(100_000, 999_999).toString()

    const otpHash = crypto.createHash("sha256").update(otp).digest("hex")
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

    await prisma.otpVerification.create({
      data: {
        contact,
        purpose: purpose as OtpPurpose,
        otp_hash: otpHash,
        expires_at: expiresAt,
        attempts: 0,
      },
    })

    await sendEmail(contact, otp)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[send-otp]", error)
    return NextResponse.json({ error: "Failed to send OTP" }, { status: 500 })
  }
}
