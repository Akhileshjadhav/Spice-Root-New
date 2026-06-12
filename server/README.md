# Spice Root Server

Render-ready Node backend for privileged Spice Root operations.

The React client reads and writes most storefront data directly through Firebase Auth + Firestore. This server is intentionally small and only handles work that should not run in the browser.

## Responsibilities

```txt
src/config/env.js          environment and deployment config
src/middleware/auth.js     Firebase token verification
src/routes/router.js       active API route table
src/services/authService.js admin bootstrap for env allowlist emails
src/services/inventoryService.js stock decrement after checkout
src/services/razorpayService.js Razorpay test/mock order + signature verification
src/services/firebaseAdmin.js Firebase Admin initialization
```

## Active API routes

```txt
GET    /health
POST   /api/auth/ensure-admin
POST   /api/orders/inventory-adjustment
GET    /api/razorpay/config
POST   /api/razorpay/create-order
POST   /api/razorpay/verify-payment
```

All `/api/*` routes except `/health` require a Firebase ID token in the `Authorization: Bearer` header.

## Local

```bash
npm install
npm run dev
```

Default URL:

```txt
http://localhost:3001
```

Health check:

```bash
curl http://localhost:3001/health
```

## Render

Use `server` as the root directory.

Build command:

```bash
npm install
```

Start command:

```bash
npm start
```

Set environment variables from `.env.example` in the Render dashboard. Use `NODE_ENV=production` on Render.

On boot, the server validates required production env vars. `/health` reports readiness (`ok: true` when Firebase Admin, Razorpay, admin allowlist, and `CLIENT_ORIGIN` are configured).

See [DEPLOYMENT.md](../DEPLOYMENT.md) for the full checklist.

## Razorpay modes

`RAZORPAY_MOCK_MODE=true` is the visible demo/test gateway mode for the current project keys. It opens Razorpay Checkout and saves the order after a successful test payment callback.

`RAZORPAY_MOCK_MODE=false` creates a real Razorpay test order using the configured `rzp_test_` key and secret. Use that only after the Razorpay secret is confirmed valid.
