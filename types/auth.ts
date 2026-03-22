export interface JwtUser {
  id: number
  role: string
  restaurant_id: number | null
  iat: number
  exp: number
}
