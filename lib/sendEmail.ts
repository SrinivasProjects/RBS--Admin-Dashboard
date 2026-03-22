import nodemailer from "nodemailer"

export const sendEmail = async (to: string, otp: string) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",   // Gmail shortcut
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  })

  await transporter.sendMail({
    from: `"RBS" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Your OTP Code",
    html: `<h2>Your OTP is: ${otp}</h2>`,
  })
}