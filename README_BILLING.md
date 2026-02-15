# Billing & Payments Implementation

This project uses **Moyasar** for Saudi-friendly payments (SAR).

## 1. Setup

### Environment Variables
Add these to your `.env.local` and Cloudflare Pages settings:

```env
MOYASAR_SECRET_KEY=sk_test_...
MOYASAR_PUBLISHABLE_KEY=pk_test_...
APP_URL=https://your-domain.com
```

### Cloudflare Deployment
Since payment processing involves API routes (`/api/billing/*`), this project uses **Cloudflare Pages Functions**.
Do NOT enable static export (`output: "export"`) in `next.config.ts`.

## 2. Webhook Configuration

To receive payment confirmations, configure the webhook in your Moyasar Dashboard:

- **URL**: `https://your-domain.com/api/billing/webhook/moyasar`
- **Events**: `invoice.paid` (or `payment.paid`)

## 3. Testing (DEV Mode)

1. **Login**: Go to `/login` and sign in.
2. **Go to Billing**: Navigate to `/billing`.
3. **Select Plan**: Click "اشترك شهريًا" for any plan.
   - If `MOYASAR_SECRET_KEY` is **missing**, the system mocks a successful payment and redirects you back with `status=processed`.
   - If configured, you will be redirected to the Moyasar Invoice page.
4. **Verification**:
   - Check the `subscriptions` and `payments` tables in `src/lib/db/local.db` (using a SQLite viewer).
   - Verify the Dashboard now shows "Manage Subscription" instead of "Upgrade".
   - Verify premium features are unlocked.

## 4. API Routes

- `POST /api/billing/create-payment`: Creates an invoice and returns redirect URL.
- `POST /api/billing/webhook/moyasar`: Handles status updates from Moyasar.

## 5. Security

- **Server-Side Gating**: Use `requirePlan()` from `src/lib/auth/utils.ts` to protect API routes.
- **Client-Side Gating**: The Dashboard UI conditionally renders content based on `user.plan`.
