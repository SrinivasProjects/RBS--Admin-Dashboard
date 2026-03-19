import jwt from "jsonwebtoken"
import crypto from "crypto"

const JWT_SECRET = process.env.JWT_SECRET!
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!

// Generate Access Token
export function generateAccessToken(user: {
  id: number
  role: string
  restaurant_id: number | null
}) {

  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      restaurant_id: user.restaurant_id
    },
    JWT_SECRET,
    { expiresIn: "15m" }
  )
}

// Generate Refresh Token
export function generateRefreshToken(userId: number) {

  return jwt.sign(
    { id: userId },
    JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  )
}

// Verify Access Token
export function verifyAccessToken(token: string) {

  return jwt.verify(token, JWT_SECRET)

}

// Verify Refresh Token
export function verifyRefreshToken(token: string) {

  return jwt.verify(token, JWT_REFRESH_SECRET)

}

// Hash Token (for DB storage)
export function hashToken(token: string) {

  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex")

}