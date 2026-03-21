export function authorize(
  userRole: string,
  allowedRoles: string[]
) {

  if (!allowedRoles.includes(userRole)) {
    throw new Error("Unauthorized")
  }

}