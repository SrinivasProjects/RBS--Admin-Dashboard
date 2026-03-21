import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { NextResponse } from "next/server"

export async function POST(req: Request) {

  const { contact, otp, purpose } = await req.json()

  const otpHash = crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex")

  const record = await prisma.otpVerification.findFirst({
    where: {
      contact,
      purpose,
      otp_hash: otpHash,
      is_used: false
    }
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

  await prisma.otpVerification.update({
    where: { id: record.id },
    data: { is_used: true }
  })

  return NextResponse.json({
    success: true
  })
}