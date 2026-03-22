import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import type { Device } from "@prisma/client"

export async function getDeviceFromRequest(req: Request): Promise<Device> {
  const rawKey = req.headers.get("x-device-key")

  if (!rawKey) {
    throw new Error("Device key required")
  }

  const keyHash = crypto
    .createHash("sha256")
    .update(rawKey)
    .digest("hex")

  const device = await prisma.device.findUnique({
    where: { device_key: keyHash },
  })

  if (!device || !device.is_active) {
    throw new Error("Invalid or inactive device")
  }

  return device
}
