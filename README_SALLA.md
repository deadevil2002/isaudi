# Salla Store Integration & Data Ingestion

This project now supports connecting a store via Salla OAuth or CSV Upload to power the dashboard analytics.

## 1. CSV Import (Works Immediately)
No external setup required. Users can upload products and orders immediately.
- **URL**: `/connect/csv`
- **Templates**: Available in `public/templates/` (and downloadable from the UI).
- **Processing**:
  - Parsed client-side (headers validation).
  - Sent to `/api/connect/csv/upload`.
  - Prices converted to Halala (x100) for storage.
  - Linked to `userId` with `platform='csv'`.

## 2. Salla OAuth (Requires Developer App)
To enable the "Connect Salla" button, you must configure a Salla Developer App.

### Setup Steps:
1. Go to [Salla Partners Portal](https://partners.salla.sa/).
2. Create a new App.
3. Set the production Redirect URI to `https://isaudi.ai/api/connect/salla/callback` (or `http://localhost:3000/api/connect/salla/callback` for local development).
4. Copy `Client ID` and `Client Secret`.
5. Add local values to `.env.local`; configure production values as Cloudflare Worker secrets or variables.

### Environment Variables
```env
# Salla OAuth
SALLA_CLIENT_ID=your_client_id
SALLA_CLIENT_SECRET=your_client_secret
SALLA_REDIRECT_URL=https://isaudi.ai/api/connect/salla/callback

# Security
# Used to encrypt/decrypt tokens in the DB. Must be 32 bytes or use AUTH_SECRET fallback.
TOKEN_ENCRYPTION_KEY=super-secret-key-must-be-32-bytes-long!

# Webhooks (Optional)
SALLA_WEBHOOK_SECRET=your_webhook_secret
```

### Flow
1. User clicks "Connect Salla".
2. Redirects to `/api/connect/salla/start`.
3. Redirects to Salla OAuth consent page.
4. Returns to `/api/connect/salla/callback` with `code`.
5. Server exchanges `code` for `access_token` & `refresh_token`.
6. Tokens are encrypted and stored in `store_connections` table.
7. User redirected to Dashboard.

## 3. Database Schema
New tables added to SQLite (D1 compatible):
- `store_connections`: Stores tokens and store info.
- `products`: Unified product schema.
- `orders`: Unified order schema.

## 4. Cloudflare Deployment Note
This project uses the Next.js App Router through OpenNext on a Cloudflare Worker:
- API routes are same-origin under `https://isaudi.ai/api/*`.
- Production environment values are configured for the Cloudflare Worker.
- Production storage uses D1 database `isaudi-db` through binding `DB`.
