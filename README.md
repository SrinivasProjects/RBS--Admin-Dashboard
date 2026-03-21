# RBS Admin Dashboard

A full-stack **Restaurant Business System** admin dashboard built with **Next.js 16 (App Router)**, **TypeScript**, **Prisma 7**, and **PostgreSQL (Neon)**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router) |
| Language | TypeScript 5 |
| Database | PostgreSQL via Neon |
| ORM | Prisma 7 + PrismaPg adapter |
| Auth | JWT (access + refresh tokens) |
| Password hashing | bcryptjs (10 rounds) |
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

## Typical Testing Flow

Use any HTTP client (Postman, Insomnia, `curl`, Thunder Client, etc.).

```
Step 1  POST /api/auth/register       → create account
Step 2  POST /api/auth/verify-otp     → verify registration OTP (get OTP from server logs in dev)
Step 3  POST /api/auth/login          → get accessToken + refreshToken
Step 4  GET  /api/auth/me             → verify token works (use accessToken as Bearer)
Step 5  GET  /api/test-data           → test role-based data access
Step 6  PUT  /api/auth/change-password → change password (use accessToken as Bearer)
Step 7  POST /api/auth/refresh-token  → get new accessToken using refreshToken
Step 8  POST /api/auth/logout         → invalidate refreshToken
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
