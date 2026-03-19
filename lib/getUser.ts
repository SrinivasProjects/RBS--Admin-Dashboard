import jwt from "jsonwebtoken"

export function getUserFromRequest(req: Request) {

  const authHeader = req.headers.get("authorization")

  if (!authHeader) {
    throw new Error("No token")
  }

  const token = authHeader.split(" ")[1]

  return jwt.verify(
    token,
    process.env.JWT_SECRET!
  )
}