import { z } from "zod"

// ─── Nested Schemas ────────────────────────────────────────────────────────────

const OrderItemSchema = z.object({
  item_name:       z.string().max(150),
  item_code:       z.string().max(50).nullish(),
  category:        z.string().max(100).nullish(),
  quantity:        z.number().positive(),
  unit_price:      z.number().min(0),
  discount_amount: z.number().min(0).default(0),
  tax_rate:        z.number().min(0).default(0),
  tax_amount:      z.number().min(0).default(0),
  total_price:     z.number().min(0),
  notes:           z.string().max(255).nullish(),
})

const KotItemSchema = z.object({
  item_name: z.string().max(150),
  quantity:  z.number().positive(),
  notes:     z.string().max(255).nullish(),
})

const KotSchema = z.object({
  external_id: z.string().uuid(),
  kot_number:  z.number().int().positive(),
  status:      z.enum(["PENDING", "IN_PROGRESS", "READY", "SERVED", "CANCELLED"]),
  notes:       z.string().max(255).nullish(),
  printed_at:  z.string().datetime().nullish(),
  created_at:  z.string().datetime(),
  items:       z.array(KotItemSchema),
})

const PaymentSchema = z.object({
  external_id:     z.string().uuid(),
  amount:          z.number().positive(),
  method:          z.enum(["CASH", "CARD", "UPI", "ONLINE"]),
  status:          z.enum(["PAID", "PENDING", "REFUNDED"]),
  transaction_ref: z.string().max(100).nullish(),
  paid_at:         z.string().datetime(),
})

const OrderSchema = z.object({
  external_id:       z.string().uuid(),
  order_number:      z.string().max(20),
  order_type:        z.enum(["DINE_IN", "TAKEAWAY", "ONLINE"]),
  status:            z.enum(["RUNNING", "HOLD", "COMPLETED", "CANCELLED"]),
  table_number:      z.string().max(10).nullish(),
  covers:            z.number().int().positive().nullish(),
  customer_name:     z.string().max(100).nullish(),
  customer_phone:    z.string().max(15).nullish(),
  platform:          z.enum(["SWIGGY", "ZOMATO", "OTHER"]).nullish(),
  platform_order_id: z.string().max(50).nullish(),
  subtotal:          z.number().min(0),
  discount_amount:   z.number().min(0).default(0),
  tax_amount:        z.number().min(0).default(0),
  total_amount:      z.number().min(0),
  notes:             z.string().max(255).nullish(),
  ordered_at:        z.string().datetime(),
  completed_at:      z.string().datetime().nullish(),
  items:             z.array(OrderItemSchema),
  kots:              z.array(KotSchema),
  payments:          z.array(PaymentSchema),
})

// ─── Root Payload ──────────────────────────────────────────────────────────────

export const SyncPayloadSchema = z.object({
  device_id:  z.string().max(100),
  sync_from:  z.string().datetime(),
  sync_to:    z.string().datetime(),
  orders:     z.array(OrderSchema).max(500), // cap batch size
})

export type SyncPayload  = z.infer<typeof SyncPayloadSchema>
export type OrderPayload = z.infer<typeof OrderSchema>
