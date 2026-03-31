import nodemailer from "nodemailer"

// Singleton transporter — created once at module load, reused for all emails
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

export const sendEmail = async (to: string, otp: string): Promise<void> => {
  await transporter.sendMail({
    from: `"RBS Support" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Your OTP Code",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
        <h2>Verify your email</h2>
        <p>Use the OTP below to complete your request. It expires in <strong>5 minutes</strong>.</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 24px 0;">
          ${otp}
        </div>
        <p style="color: #888; font-size: 12px;">If you did not request this, ignore this email.</p>
      </div>
    `,
  })
}
