import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { sendEmail } from "@/lib/sendEmail"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
const { contact, purpose } = await req.json()


    const lastOtp = await prisma.otpVerification.findFirst({
  where: { contact },
  orderBy: { created_at: "desc" }
})
// If last OTP was created less than 60 sec ago thn block
if (lastOtp && Date.now() - new Date(lastOtp.created_at).getTime() < 60000) {
  return NextResponse.json(
    { error: "Wait before requesting another OTP" },
    { status: 429 }
  )
}
    

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()

    const otpHash = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex")

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 min

    // Save in DB
    await prisma.otpVerification.create({
      data: {
        contact,
        purpose,
        otp_hash: otpHash,
        expires_at: expiresAt,
        attempts: 0
      }
    })

    //  SEND EMAIL HERE
    await sendEmail(contact, otp)
console.log("ENV CHECK:", process.env.DATABASE_URL)
    return NextResponse.json({ success: true })
    

  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Failed to send OTP" },
      { status: 500 }
    )
  }
}