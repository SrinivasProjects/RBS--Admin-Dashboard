# RBS Admin Dashboard

A full-stack **Restaurant Business System** admin dashboard built with **Next.js 16 (App Router)**, **TypeScript**, **Prisma 6**, and **PostgreSQL (Neon)**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.1 (App Router) |
| Language | TypeScript 5 |
| Database | PostgreSQL via Neon |
| ORM | Prisma 6.12.0 + PrismaPg adapter |
| Auth | JWT (access 15 min + refresh 7 days) |
| Password hashing | bcryptjs (10 rounds) |
| Validation | Zod v4 |
| Styling | Tailwind CSS 4 |
| State | Zustand + TanStack React Query |

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma client
npx prisma generate

# 3. Run database migrations
npx prisma migrate deploy

# 4. Start dev server
npm run dev
```

Server runs at `http://localhost:3000`.

---

## Environment Variables

Create a `.env` file at the project root with the following keys:

```env
DATABASE_URL="postgresql://<user>:<password>@<host>/<db>?sslmode=require"
DIRECT_URL="postgresql://<user>:<password>@<direct-host>/<db>?sslmode=require"

# Generate with: openssl rand -hex 64
JWT_SECRET="your_jwt_secret_here"
JWT_REFRESH_SECRET="your_jwt_refresh_secret_here"
```

---

## Database Schema

### Roles
```
SUPER_ADMIN | OWNER | MANAGER | CASHIER | WAITER | KITCHEN | INVENTORY
```

### OTP Purposes
```
REGISTER | LOGIN | CHANGE_PASSWORD
```

### Order Status
```
RUNNING | HOLD | COMPLETED | CANCELLED
```

### Order Types
```
DINE_IN | TAKEAWAY | ONLINE
```

### KOT Status
```
PENDING | IN_PROGRESS | READY | SERVED | CANCELLED
```

### Payment Methods & Status
```
Methods: CASH | CARD | UPI | ONLINE
Status:  PAID | PENDING | REFUNDED
```

---

## Architecture: Offline-First EXE Sync

The billing EXE (desktop app) runs offline-capable. It generates UUID `external_id` values for every Order, KOT, and Payment locally, then pushes batches to `POST /api/sync` when online.

- Server does **UPSERT on `external_id`** — safe to retry, guarantees idempotency
- Each order is processed in its own **Prisma transaction** — one failure doesn't block others
- Device authentication uses `X-Device-Key` header (SHA-256 hashed secret, stored in `devices` table)

---

## API Reference

Base URL: `http://localhost:3000`

All protected routes require the header:
```
Authorization: Bearer <accessToken>
```

---

### Auth Routes

---

#### 1. Register

**`POST /api/auth/register`**

Creates a new restaurant and an OWNER user. Generates an OTP and (in production) sends it to the user's contact via email/SMS.

**Request Body**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "yourpassword123",
  "restaurantName": "John's Diner"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | Yes | User's full name |
| `email` | string | Yes | Must be unique |
| `password` | string | Yes | Plain text — hashed server-side |
| `restaurantName` | string | No | Defaults to `"<name>'s Restaurant"` |

**Success Response — `200`**
```json
{
  "message": "User created. A verification OTP has been sent to your contact."
}
```

**Error Responses**
| Status | Body |
|---|---|
| `400` | `{ "error": "User already exists with this email" }` |
| `500` | `{ "error": "Internal server error" }` |

---

#### 2. Login

**`POST /api/auth/login`**

Authenticates a user and returns a short-lived access token (15 min) and a long-lived refresh token (7 days). Also updates `last_login_at`.

**Request Body**
```json
{
  "email": "john@example.com",
  "password": "yourpassword123"
}
```

| Field | Type | Required |
|---|---|---|
| `email` | string | Yes |
| `password` | string | Yes |

**Success Response — `200`**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Access token payload**
```json
{
  "id": 1,
  "role": "OWNER",
  "restaurant_id": 1,
  "iat": 1700000000,
  "exp": 1700000900
}
```

**Error Responses**
| Status | Body |
|---|---|
| `401` | `{ "error": "Invalid credentials" }` |
| `500` | `{ "error": "Internal server error" }` |

---

#### 3. Verify OTP

**`POST /api/auth/verify-otp`**

Verifies the OTP sent during registration, login, or password change. Locks out after **5 failed attempts**.

**Request Body**
```json
{
  "contact": "john@example.com",
  "otp": "482910",
  "purpose": "REGISTER"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `contact` | string | Yes | Email or phone used during registration |
| `otp` | string | Yes | 6-digit code |
| `purpose` | string | Yes | One of: `REGISTER`, `LOGIN`, `CHANGE_PASSWORD` |

**Success Response — `200`**
```json
{
  "success": true
}
```

**Error Responses**
| Status | Body | Cause |
|---|---|---|
| `400` | `{ "error": "Invalid OTP" }` | No matching OTP record, or wrong code |
| `400` | `{ "error": "OTP expired" }` | OTP older than 5 minutes |
| `429` | `{ "error": "Too many attempts. Please request a new OTP." }` | 5 or more failed attempts |
| `500` | `{ "error": "Internal server error" }` | |

---

#### 4. Refresh Token

**`POST /api/auth/refresh-token`**

Issues a new access token using a valid refresh token. The refresh token's JWT signature is verified before any database lookup.

**Request Body**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

| Field | Type | Required |
|---|---|---|
| `refreshToken` | string | Yes |

**Success Response — `200`**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses**
| Status | Body | Cause |
|---|---|---|
| `400` | `{ "error": "Refresh token required" }` | Body missing `refreshToken` |
| `401` | `{ "error": "Invalid refresh token" }` | Bad JWT signature or not in DB |
| `401` | `{ "error": "Refresh token expired" }` | DB expiry has passed |
| `500` | `{ "error": "Internal server error" }` | |

---

#### 5. Get Current User

**`GET /api/auth/me`**

Returns the authenticated user's profile.

**Headers**
```
Authorization: Bearer <accessToken>
```

**No request body.**

**Success Response — `200`**
```json
{
  "id": 1,
  "restaurant_id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "phone": null,
  "password_hash": "$2b$10$...",
  "role": "OWNER",
  "avatar": null,
  "is_active": true,
  "last_login_at": "2026-03-21T10:00:00.000Z",
  "created_at": "2026-03-11T15:00:00.000Z",
  "updated_at": "2026-03-21T10:00:00.000Z"
}
```

**Error Responses**
| Status | Body | Cause |
|---|---|---|
| `401` | `{ "error": "Unauthorized" }` | Missing or invalid access token |
| `404` | `{ "error": "User not found" }` | User deleted after token was issued |

---

#### 6. Change Password

**`PUT /api/auth/change-password`**

Updates the authenticated user's password after verifying the old one.

**Headers**
```
Authorization: Bearer <accessToken>
```

**Request Body**
```json
{
  "oldPassword": "yourpassword123",
  "newPassword": "newsecurepassword456"
}
```

| Field | Type | Required |
|---|---|---|
| `oldPassword` | string | Yes |
| `newPassword` | string | Yes |

**Success Response — `200`**
```json
{
  "message": "Password updated"
}
```

**Error Responses**
| Status | Body | Cause |
|---|---|---|
| `400` | `{ "error": "Invalid password" }` | `oldPassword` does not match |
| `401` | `{ "error": "Unauthorized" }` | Missing or invalid access token |
| `404` | `{ "error": "User not found" }` | User deleted after token was issued |

---

#### 7. Logout

**`POST /api/auth/logout`**

Invalidates the refresh token by deleting it from the database. The access token will expire naturally (15 min).

**Request Body**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

| Field | Type | Required |
|---|---|---|
| `refreshToken` | string | Yes |

**Success Response — `200`**
```json
{
  "message": "Logged out successfully"
}
```

**Error Responses**
| Status | Body | Cause |
|---|---|---|
| `400` | `{ "error": "Refresh token required" }` | Body missing `refreshToken` |
| `500` | `{ "error": "Internal server error" }` | |

---

### Data Routes

---

#### 8. Get Restaurant Data

**`GET /api/test-data`**

Returns restaurant records filtered by role:
- `SUPER_ADMIN` — returns **all** restaurants
- All other roles — returns **only their own** restaurant

**Headers**
```
Authorization: Bearer <accessToken>
```

**No request body.**

**Success Response — `200`**
```json
[
  {
    "id": 1,
    "name": "John's Diner",
    "phone": null,
    "email": null,
    "address": null,
    "is_active": true,
    "created_at": "2026-03-11T15:00:00.000Z",
    "updated_at": "2026-03-21T10:00:00.000Z"
  }
]
```

**Error Responses**
| Status | Body | Cause |
|---|---|---|
| `401` | `{ "error": "Unauthorized" }` | Missing or invalid access token |

---

### Order Routes

All order routes require: `Authorization: Bearer <accessToken>`

Roles: `SUPER_ADMIN` sees all restaurants. `OWNER`, `MANAGER`, `CASHIER` see only their own.

---

#### 9. Running Orders

**`GET /api/orders/running`**

Returns all active (`RUNNING` + `HOLD`) orders with items, KOT count, paid amount, due amount, and elapsed time.

**Allowed roles:** `SUPER_ADMIN`, `OWNER`, `MANAGER`, `CASHIER`

**No query parameters.**

**Success Response — `200`**
```json
{
  "data": [
    {
      "id": 1,
      "order_number": "ORD-001",
      "order_type": "DINE_IN",
      "status": "RUNNING",
      "table_number": "T5",
      "covers": 3,
      "customer_name": null,
      "customer_phone": null,
      "platform": null,
      "subtotal": 450.00,
      "discount_amount": 0.00,
      "tax_amount": 22.50,
      "total_amount": 472.50,
      "paid_amount": 0.00,
      "due_amount": 472.50,
      "kot_count": 1,
      "items": [
        {
          "item_name": "Butter Chicken",
          "category": "Main Course",
          "quantity": 2,
          "unit_price": 180.00,
          "total_price": 360.00,
          "notes": null
        }
      ],
      "ordered_at": "2026-03-21T10:30:00.000Z",
      "elapsed_minutes": 14
    }
  ],
  "total": 1
}
```

**Error Responses**
| Status | Body | Cause |
|---|---|---|
| `401` | `{ "error": "Unauthorized" }` | Missing / invalid token or insufficient role |

---

#### 10. All Orders (Paginated)

**`GET /api/orders`**

Returns paginated order history with optional filters.

**Allowed roles:** `SUPER_ADMIN`, `OWNER`, `MANAGER`, `CASHIER`

**Query Parameters**
| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Max `100` |
| `status` | string | — | One of: `RUNNING`, `HOLD`, `COMPLETED`, `CANCELLED` |
| `order_type` | string | — | One of: `DINE_IN`, `TAKEAWAY`, `ONLINE` |
| `from` | ISO date | today 00:00 | Filter by `ordered_at >= from` |
| `to` | ISO date | today 23:59 | Filter by `ordered_at <= to` |
| `search` | string | — | Searches `order_number`, `customer_name`, `customer_phone`, `table_number` |

**Example:** `GET /api/orders?status=COMPLETED&from=2026-03-01&to=2026-03-21&page=1&limit=20`

**Success Response — `200`**
```json
{
  "data": [
    {
      "id": 1,
      "order_number": "ORD-001",
      "order_type": "DINE_IN",
      "status": "COMPLETED",
      "table_number": "T5",
      "covers": 3,
      "customer_name": null,
      "customer_phone": null,
      "platform": null,
      "subtotal": 450.00,
      "discount_amount": 0.00,
      "tax_amount": 22.50,
      "total_amount": 472.50,
      "ordered_at": "2026-03-21T10:30:00.000Z",
      "completed_at": "2026-03-21T11:00:00.000Z"
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "total_pages": 3,
    "total_orders": 42,
    "total_revenue": 18750.00
  }
}
```

**Error Responses**
| Status | Body | Cause |
|---|---|---|
| `400` | `{ "error": "..." }` | Invalid status or order_type value |
| `401` | `{ "error": "Unauthorized" }` | Missing / invalid token |

---

### KOT Route

---

#### 11. Kitchen Order Tickets (KOT)

**`GET /api/kot`**

Returns paginated KOTs with their items. Kitchen staff can use this to see what to prepare.

**Allowed roles:** `SUPER_ADMIN`, `OWNER`, `MANAGER`, `CASHIER`, `KITCHEN`

**Query Parameters**
| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | number | `1` | |
| `limit` | number | `20` | Max `100` |
| `status` | string | — | One of: `PENDING`, `IN_PROGRESS`, `READY`, `SERVED`, `CANCELLED` |
| `order_id` | number | — | Filter by a specific order |
| `from` | ISO date | today 00:00 | Filter by `created_at >= from` |
| `to` | ISO date | today 23:59 | Filter by `created_at <= to` |

**Success Response — `200`**
```json
{
  "data": [
    {
      "id": 1,
      "external_id": "550e8400-e29b-41d4-a716-446655440000",
      "order_id": 1,
      "order_number": "ORD-001",
      "table_number": "T5",
      "kot_number": 1,
      "status": "PENDING",
      "notes": null,
      "printed_at": null,
      "created_at": "2026-03-21T10:31:00.000Z",
      "items": [
        {
          "item_name": "Butter Chicken",
          "quantity": 2,
          "notes": null
        }
      ]
    }
  ],
  "meta": {
    "total": 5,
    "page": 1,
    "limit": 20,
    "total_pages": 1
  }
}
```

**Error Responses**
| Status | Body | Cause |
|---|---|---|
| `400` | `{ "error": "..." }` | Invalid status value |
| `401` | `{ "error": "Unauthorized" }` | Missing / invalid token |

---

### Payment Routes

---

#### 12. Due Payments

**`GET /api/payments/due`**

Returns non-cancelled orders that have an outstanding balance (due_amount > 0), with their payment history.

**Allowed roles:** `SUPER_ADMIN`, `OWNER`, `MANAGER`, `CASHIER`

**Query Parameters**
| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | number | `1` | |
| `limit` | number | `20` | Max `100` |
| `from` | ISO date | today 00:00 | Filter by `ordered_at >= from` |
| `to` | ISO date | tomorrow 00:00 | Filter by `ordered_at < to` |

**Success Response — `200`**
```json
{
  "data": [
    {
      "id": 2,
      "order_number": "ORD-002",
      "order_type": "DINE_IN",
      "status": "COMPLETED",
      "table_number": "T3",
      "customer_name": null,
      "customer_phone": null,
      "total_amount": 680.00,
      "paid_amount": 300.00,
      "due_amount": 380.00,
      "ordered_at": "2026-03-21T09:00:00.000Z",
      "payments": [
        {
          "method": "CASH",
          "amount": 300.00,
          "status": "PAID",
          "transaction_ref": null,
          "paid_at": "2026-03-21T09:45:00.000Z"
        }
      ]
    }
  ],
  "meta": {
    "total": 3,
    "page": 1,
    "limit": 20,
    "total_pages": 1,
    "total_due": 1180.00
  }
}
```

**Error Responses**
| Status | Body | Cause |
|---|---|---|
| `401` | `{ "error": "Unauthorized" }` | Missing / invalid token |

---

### Report Routes

---

#### 13. Profit & Loss Report

**`GET /api/reports/profit-loss`**

Aggregates completed order revenue, discounts, taxes, and payment collections for a date range. Supports daily / weekly / monthly breakdown.

**Allowed roles:** `SUPER_ADMIN`, `OWNER`, `MANAGER`

**Query Parameters**
| Param | Type | Required | Notes |
|---|---|---|---|
| `from` | ISO date | **Yes** | Start date (inclusive) |
| `to` | ISO date | **Yes** | End date (inclusive, end of day) |
| `group_by` | string | No | `day` (default), `week`, or `month` |

**Example:** `GET /api/reports/profit-loss?from=2026-03-01&to=2026-03-21&group_by=day`

**Success Response — `200`**
```json
{
  "summary": {
    "total_orders": 85,
    "completed_orders": 72,
    "cancelled_orders": 5,
    "gross_revenue": 42500.00,
    "total_discount": 1200.00,
    "tax_collected": 2125.00,
    "net_revenue": 41300.00,
    "total_due": 850.00,
    "collected": {
      "CASH": 28000.00,
      "UPI": 12000.00,
      "CARD": 1650.00
    }
  },
  "by_type": {
    "DINE_IN":  { "orders": 45, "revenue": 28000.00 },
    "TAKEAWAY": { "orders": 20, "revenue": 10500.00 },
    "ONLINE":   { "orders": 7,  "revenue": 4000.00 }
  },
  "breakdown": [
    {
      "period": "2026-03-01T00:00:00.000Z",
      "orders": 5,
      "gross_revenue": 2800.00,
      "discount": 50.00,
      "tax": 140.00,
      "net_revenue": 2750.00
    }
  ]
}
```

**Error Responses**
| Status | Body | Cause |
|---|---|---|
| `400` | `{ "error": "from and to query params are required" }` | Missing date range |
| `400` | `{ "error": "group_by must be day, week, or month" }` | Invalid group_by |
| `401` | `{ "error": "Unauthorized" }` | Missing / invalid token or insufficient role |

---

### Sync Route (EXE → Server)

---

#### 14. Sync Offline Data

**`POST /api/sync`**

Receives a batch of orders (with items, KOTs, and payments) from the offline EXE billing app. Uses UPSERT on `external_id` for idempotency — safe to retry.

**Authentication:** Device key header (not JWT)
```
X-Device-Key: <raw-device-secret>
```

The raw key is SHA-256 hashed and matched against the `devices` table. The device must be active.

**Request Body**
```json
{
  "orders": [
    {
      "external_id": "550e8400-e29b-41d4-a716-446655440000",
      "order_number": "ORD-001",
      "order_type": "DINE_IN",
      "status": "COMPLETED",
      "table_number": "T5",
      "covers": 3,
      "customer_name": null,
      "customer_phone": null,
      "platform": null,
      "platform_order_id": null,
      "subtotal": "450.00",
      "discount_amount": "0.00",
      "tax_amount": "22.50",
      "total_amount": "472.50",
      "notes": null,
      "ordered_at": "2026-03-21T10:30:00.000Z",
      "completed_at": "2026-03-21T11:00:00.000Z",
      "items": [
        {
          "item_name": "Butter Chicken",
          "item_code": "MC-001",
          "category": "Main Course",
          "quantity": "2.000",
          "unit_price": "180.00",
          "discount_amount": "0.00",
          "tax_rate": "5.00",
          "tax_amount": "18.00",
          "total_price": "378.00",
          "notes": null
        }
      ],
      "kots": [
        {
          "external_id": "660e8400-e29b-41d4-a716-446655440001",
          "kot_number": 1,
          "status": "SERVED",
          "notes": null,
          "printed_at": "2026-03-21T10:31:00.000Z",
          "created_at": "2026-03-21T10:30:30.000Z",
          "items": [
            {
              "item_name": "Butter Chicken",
              "quantity": "2.000",
              "notes": null
            }
          ]
        }
      ],
      "payments": [
        {
          "external_id": "770e8400-e29b-41d4-a716-446655440002",
          "amount": "472.50",
          "method": "CASH",
          "status": "PAID",
          "transaction_ref": null,
          "paid_at": "2026-03-21T11:00:00.000Z"
        }
      ]
    }
  ]
}
```

**Field Constraints**
| Field | Type | Notes |
|---|---|---|
| `orders` | array | Max **500** orders per batch |
| `external_id` | UUID string | Generated by EXE — used as idempotency key |
| `order_type` | string | `DINE_IN`, `TAKEAWAY`, or `ONLINE` |
| `status` | string | `RUNNING`, `HOLD`, `COMPLETED`, or `CANCELLED` |
| `table_number` | string \| null | Required when `order_type = DINE_IN` |
| `platform` | string \| null | `SWIGGY`, `ZOMATO`, or `OTHER` — only when `order_type = ONLINE` |
| `subtotal`, `discount_amount`, `tax_amount`, `total_amount` | numeric string | Decimal with 2 places |
| `quantity` | numeric string | Decimal with up to 3 places (supports fractional e.g. `"0.500"`) |
| `payment.method` | string | `CASH`, `CARD`, `UPI`, or `ONLINE` |
| `payment.status` | string | `PAID`, `PENDING`, or `REFUNDED` |

**Success Response — `200`**
```json
{
  "synced": {
    "orders": 1,
    "kots": 1,
    "payments": 1
  },
  "errors": [],
  "server_time": "2026-03-21T11:05:00.000Z"
}
```

**Partial Success Response — `200`** _(some orders failed)_
```json
{
  "synced": {
    "orders": 4,
    "kots": 6,
    "payments": 4
  },
  "errors": [
    {
      "external_id": "550e8400-e29b-41d4-a716-446655440099",
      "error": "Unique constraint failed on the fields: (`restaurant_id`,`order_number`)"
    }
  ],
  "server_time": "2026-03-21T11:05:00.000Z"
}
```

**Error Responses**
| Status | Body | Cause |
|---|---|---|
| `401` | `{ "error": "Unauthorized" }` | Missing, invalid, or inactive device key |
| `422` | `{ "error": "Invalid payload", "details": {...} }` | Zod validation failed |
| `500` | `{ "error": "Internal server error" }` | |

---

## Typical Testing Flow

Use any HTTP client (Postman, Insomnia, `curl`, Thunder Client, etc.).

```
Step 1  POST /api/auth/register       → create account
Step 2  POST /api/auth/verify-otp     → verify registration OTP (get OTP from server logs in dev)
Step 3  POST /api/auth/login          → get accessToken + refreshToken
Step 4  GET  /api/auth/me             → verify token works (use accessToken as Bearer)
Step 5  GET  /api/test-data           → test role-based data access
Step 6  POST /api/sync                → push EXE data (use X-Device-Key header)
Step 7  GET  /api/orders/running      → view active orders
Step 8  GET  /api/orders              → paginated order history
Step 9  GET  /api/kot                 → KOT list for kitchen
Step 10 GET  /api/payments/due        → orders with outstanding balance
Step 11 GET  /api/reports/profit-loss?from=2026-03-01&to=2026-03-21 → P&L report
Step 12 PUT  /api/auth/change-password → change password (use accessToken as Bearer)
Step 13 POST /api/auth/refresh-token  → get new accessToken using refreshToken
Step 14 POST /api/auth/logout         → invalidate refreshToken
```

> **Dev note:** Since no email/SMS provider is wired up yet, the generated OTP is visible in the terminal where `npm run dev` is running (it appears in Prisma query logs). Use that value in Step 2.

---

## Scripts

```bash
npm run dev        # Start development server
npm run build      # Production build
npm start          # Start production server
npm run lint       # Run ESLint
npx prisma generate        # Regenerate Prisma client after schema changes
npx prisma migrate deploy  # Apply pending migrations to the database
npx prisma studio          # Open Prisma GUI to browse data
```




Authentication Flow (Updated)

The system uses a secure OTP-based registration flow combined with JWT authentication.

Registration Flow (Updated)
Register → Generate OTP → Store temp data → Verify OTP → Create User
User is NOT created immediately
Temporary data is stored in otp_verifications table
User is created only after successful OTP verification

OTP System Details
OTP is a 6-digit code
Stored as SHA-256 hash
Valid for 5 minutes
Maximum 5 attempts allowed
OTP is marked as used after successful verification

Login & Token System
Login returns:
Access Token (15 min)
Refresh Token (7 days)
Access token is used for all API calls:
Authorization: Bearer <accessToken>
Refresh token is used to generate new access tokens

