import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getDeviceFromRequest } from "@/lib/getDevice"
import { SyncPayloadSchema, type OrderPayload } from "@/lib/validators/sync"

type SyncResults = { orders: number; kots: number; payments: number }
type SyncError   = { external_id: string; error: string }

async function processOrder(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  orderData: OrderPayload,
  restaurantId: number
): Promise<{ kots: number; payments: number }> {

  // ── Upsert order ────────────────────────────────────────────────────────────
  const order = await tx.order.upsert({
    where:  { external_id: orderData.external_id },
    create: {
      external_id:       orderData.external_id,
      restaurant_id:     restaurantId,
      order_number:      orderData.order_number,
      order_type:        orderData.order_type,
      status:            orderData.status,
      table_number:      orderData.table_number    ?? null,
      covers:            orderData.covers           ?? null,
      customer_name:     orderData.customer_name    ?? null,
      customer_phone:    orderData.customer_phone   ?? null,
      platform:          orderData.platform         ?? null,
      platform_order_id: orderData.platform_order_id ?? null,
      subtotal:          orderData.subtotal,
      discount_amount:   orderData.discount_amount,
      tax_amount:        orderData.tax_amount,
      total_amount:      orderData.total_amount,
      notes:             orderData.notes            ?? null,
      ordered_at:        new Date(orderData.ordered_at),
      completed_at:      orderData.completed_at
        ? new Date(orderData.completed_at)
        : null,
    },
    update: {
      status:          orderData.status,
      subtotal:        orderData.subtotal,
      discount_amount: orderData.discount_amount,
      tax_amount:      orderData.tax_amount,
      total_amount:    orderData.total_amount,
      completed_at:    orderData.completed_at
        ? new Date(orderData.completed_at)
        : null,
      notes:           orderData.notes ?? null,
    },
  })

  // ── Replace order items (full state from EXE) ───────────────────────────────
  await tx.orderItem.deleteMany({ where: { order_id: order.id } })

  if (orderData.items.length > 0) {
    await tx.orderItem.createMany({
      data: orderData.items.map((item) => ({
        order_id:        order.id,
        item_name:       item.item_name,
        item_code:       item.item_code       ?? null,
        category:        item.category        ?? null,
        quantity:        item.quantity,
        unit_price:      item.unit_price,
        discount_amount: item.discount_amount,
        tax_rate:        item.tax_rate,
        tax_amount:      item.tax_amount,
        total_price:     item.total_price,
        notes:           item.notes           ?? null,
      })),
    })
  }

  // ── Upsert KOTs ────────────────────────────────────────────────────────────
  let kotCount = 0
  for (const kotData of orderData.kots) {
    const kot = await tx.kot.upsert({
      where:  { external_id: kotData.external_id },
      create: {
        external_id:   kotData.external_id,
        order_id:      order.id,
        restaurant_id: restaurantId,
        kot_number:    kotData.kot_number,
        status:        kotData.status,
        notes:         kotData.notes      ?? null,
        printed_at:    kotData.printed_at ? new Date(kotData.printed_at) : null,
        created_at:    new Date(kotData.created_at),
      },
      update: {
        status:     kotData.status,
        printed_at: kotData.printed_at ? new Date(kotData.printed_at) : null,
      },
    })

    await tx.kotItem.deleteMany({ where: { kot_id: kot.id } })

    if (kotData.items.length > 0) {
      await tx.kotItem.createMany({
        data: kotData.items.map((item) => ({
          kot_id:    kot.id,
          item_name: item.item_name,
          quantity:  item.quantity,
          notes:     item.notes ?? null,
        })),
      })
    }
    kotCount++
  }

  // ── Upsert payments ────────────────────────────────────────────────────────
  let paymentCount = 0
  for (const paymentData of orderData.payments) {
    await tx.payment.upsert({
      where:  { external_id: paymentData.external_id },
      create: {
        external_id:     paymentData.external_id,
        order_id:        order.id,
        restaurant_id:   restaurantId,
        amount:          paymentData.amount,
        method:          paymentData.method,
        status:          paymentData.status,
        transaction_ref: paymentData.transaction_ref ?? null,
        paid_at:         new Date(paymentData.paid_at),
      },
      update: {
        amount:          paymentData.amount,
        method:          paymentData.method,
        status:          paymentData.status,
        transaction_ref: paymentData.transaction_ref ?? null,
      },
    })
    paymentCount++
  }

  return { kots: kotCount, payments: paymentCount }
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate device
    const device = await getDeviceFromRequest(req)

    // 2. Parse + validate body
    const body   = await req.json()
    const parsed = SyncPayloadSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const { orders } = parsed.data

    const results: SyncResults = { orders: 0, kots: 0, payments: 0 }
    const errors: SyncError[]  = []

    // 3. Process each order atomically — one failed order doesn't block others
    for (const orderData of orders) {
      const kotCount     = orderData.kots.length
      const paymentCount = orderData.payments.length

      try {
        await prisma.$transaction(async (tx) => {
          await processOrder(tx, orderData, device.restaurant_id)
        })

        results.orders++
        results.kots     += kotCount
        results.payments += paymentCount

      } catch (err) {
        errors.push({
          external_id: orderData.external_id,
          error:       err instanceof Error ? err.message : "Unknown error",
        })
      }
    }

    // 4. Update device last sync time
    await prisma.device.update({
      where: { id: device.id },
      data:  { last_synced_at: new Date() },
    })

    return NextResponse.json({
      synced:      results,
      errors,
      server_time: new Date().toISOString(),
    })

  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
