import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { NextResponse } from "next/server"
import { Role } from "@prisma/client"
import { sendEmail } from "@/lib/sendEmail"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, email, password , restaurantName, role } = body

    const existingUser = await prisma.user.findUnique({
      where: { email }
    })
        let userRole: Role = Role.OWNER

       if (role === Role.SUPER_ADMIN) {
          userRole = Role.SUPER_ADMIN
          }
    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists with this email" },
        { status: 400 }
      )
    }

    // const hash = await bcrypt.hash(password, 10)

    //     let restaurantId = null

    //  if (userRole !== Role.SUPER_ADMIN) {
    //   const restaurant = await prisma.restaurant.create({
    //     data: {
    //       name: restaurantName || `${name}'s Restaurant`
    //     }
    //   })

    //   restaurantId = restaurant.id
    // }

    // const user = await prisma.user.create({
    //   data: {
    //     name,
    //     email,
    //     password_hash: hash,
    //     role: userRole ,
    //     restaurant_id: restaurantId

    //   }
    // })

    // Generate OTP

const otp = Math.floor(100000 + Math.random() * 900000).toString()

const otpHash = crypto
  .createHash("sha256")
  .update(otp)
  .digest("hex")

await prisma.otpVerification.create({
  data: {
    contact: email,
    otp_hash: otpHash,
    purpose: "REGISTER",
    expires_at: new Date(Date.now() + 5 * 60 * 1000),

    
    temp_name: name,
    temp_password: password,
    temp_restaurant: restaurantName,
    temp_role: role
  }
})

// SEND EMAIL 
await sendEmail(email, otp)

return NextResponse.json({
  message: "OTP sent to email. Please verify."
})

  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}