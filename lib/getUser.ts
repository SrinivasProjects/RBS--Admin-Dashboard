import jwt from "jsonwebtoken"
import type { JwtUser } from "@/types/auth"

export function getUserFromRequest(req: Request): JwtUser {
  const authHeader = req.headers.get("authorization")

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("No token")
  }

  const token = authHeader.split(" ")[1]
  return jwt.verify(token, process.env.JWT_SECRET!) as JwtUser
}
