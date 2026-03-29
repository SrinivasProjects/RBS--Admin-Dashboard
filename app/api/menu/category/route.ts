import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/getUser"
// category route
export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req)

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      )
    }
// Read the request body and extract the name field into a variable
    const { name } = await req.json()

    if (!name) {
      return NextResponse.json(
        { success: false, message: "Category name is required" },
        { status: 400 }
      )
    }
// create  a new category for the restaurant of the user
    const category = await prisma.category.create({
      data: { // Used to store data in database 
        name,
        restaurant_id: user.restaurant_id 
      }
    })

    return NextResponse.json({ success: true, category })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}