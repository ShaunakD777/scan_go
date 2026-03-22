# Scan & Go Checkout

A full-stack smart retail self-checkout system. Shoppers scan product barcodes in-store using their phone, add items to a cart, pay via Razorpay, and exit through an RFID-verified gate — no cashier needed.

---

## System Overview

- Frontend: React PWA for scanning and checkout
- Backend: Supabase handles auth, database, and payments
- Hardware Layer: ESP32 + RC522 verifies paid items at exit

The system bridges digital checkout with physical verification using RFID.

## Features

- **Barcode Scanning** — Scan product barcodes directly from the browser camera
- **Shopping Cart** — Real-time cart management scoped to a selected store
- **Razorpay Payments** — Secure checkout with server-side payment verification via Supabase Edge Functions
- **RFID Gate Verification** — Exit gate checks that all items in a bag are paid before allowing exit
- **Role-Based Access Control** — Three roles: `super_admin`, `admin` (store manager), and `user`
- **Multi-Store Support** — Super admins manage multiple stores; store admins manage their own store and products
- **Admin Dashboards** — Store admin and super admin dashboards for product and store management
- **Transaction History** — Users can view their past purchases
- **PWA Support** — Installable as a Progressive Web App on mobile devices

---

## Tech Stack

**Frontend:** React 18, TypeScript, Vite, shadcn/ui, Tailwind CSS, React Router

**Backend:** Supabase (PostgreSQL + Edge Functions on Deno)

**Auth:** Supabase Auth

**Payments:** Razorpay

**RFID Service:** Python / FastAPI (`Backend/`)

**Deployment:** Vercel (frontend), Supabase (backend)

---

## Project Structure

```
.
├── src/                    # React frontend
│   ├── pages/              # Route-level page components
│   ├── components/         # Reusable UI components (shadcn/ui based)
│   ├── hooks/              # Context providers (useAuth, useCart)
│   ├── integrations/       # Auto-generated Supabase types & client
│   └── lib/                # Supabase client, auth helpers, utilities
├── supabase/
│   ├── functions/          # Deno Edge Functions
│   │   ├── create-razorpay-order/      # Creates a Razorpay payment order
│   │   ├── verify-razorpay-payment/    # Verifies payment & updates DB
│   │   └── rfid-gate-check/           # Checks RFID tags against payment status
│   └── migrations/         # PostgreSQL schema migrations
├── Backend/                # FastAPI RFID gate service (Python)
└── esp32-gate/             # ESP32 hardware companion (RFID reader)
```

---

## Hardware Setup (RFID Gate)

⚠️ This project requires hardware setup. See the hardware guide before running.

This project includes a physical RFID-based exit gate powered by ESP32 and RC522.

 Full wiring, pin configuration, and Arduino code:  
**[View Hardware Guide](docs/hardware.md)**

### Hardware Used
- ESP32
- RC522 RFID Module
- Buzzer
- Jumper wires
- USB cable (for flashing)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+) and npm
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for running/deploying Edge Functions)
- A [Supabase](https://supabase.com) project
- A [Razorpay](https://razorpay.com) account (test mode works fine)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/scan-go-checkout.git
cd scan-go-checkout
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
```

For Supabase Edge Functions, set these in your Supabase project dashboard under **Settings > Edge Functions > Secrets**:

```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. Run the development server

```bash
npm run dev
```

The app will be available at `http://localhost:8080`.

---

## Database Setup

Apply the Supabase migrations to set up your database schema:

```bash
supabase db push
```

The schema includes tables for: `profiles`, `user_roles`, `stores`, `products`, `carts`, `cart_items`, and `transactions`.

---

## Deploying Edge Functions

```bash
supabase functions deploy create-razorpay-order
supabase functions deploy verify-razorpay-payment
supabase functions deploy rfid-gate-check
```

---

## RFID Backend Service

The `Backend/` directory contains a Python/FastAPI service that the RFID gate hardware calls to verify payment status.

**Requirements:** Python 3.11+

```bash
cd Backend
pip install fastapi uvicorn supabase
uvicorn main:app --reload
uvicorn main:app --host 0.0.0.0 --port 8000
```

The service exposes a `POST /check-payment` endpoint that accepts an RFID tag ID and returns whether the corresponding product has been paid for.

---

## Payment Flow

```
1. User scans barcodes → items added to cart
2. User clicks "Pay" → Razorpay order created via Edge Function
3. Razorpay checkout opens in browser
4. User completes payment
5. verify-razorpay-payment Edge Function:
   - Verifies payment with Razorpay API
   - Marks products as is_paid = true
   - Deactivates the cart
6. Transaction record created → user redirected to success page
```

---

## RFID Gate Flow

```
1. Shopper approaches exit gate
2. ESP32 reads RFID tags from items in bag
3. Gate service calls rfid-gate-check (Edge Function or Backend/)
4. If all items are paid → gate opens
5. If any item is unpaid → gate stays closed, alert triggered
```

---

## User Roles

| Role | Access |
|---|---|
| `user` | Scan products, manage cart, pay, view history |
| `admin` | Store dashboard, add/manage products for their store |
| `super_admin` | Manage all stores and assign admins |

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server on port 8080 |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run all tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |

---
