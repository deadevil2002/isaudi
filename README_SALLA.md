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
3. Set Redirect URI to: `https://your-domain.com/api/connect/salla/callback` (or `http://localhost:3000/api/connect/salla/callback` for dev).
4. Copy `Client ID` and `Client Secret`.
5. Add to `.env.local` (or Cloudflare Pages Environment Variables).

### Environment Variables
```env
# Salla OAuth
SALLA_CLIENT_ID=your_client_id
SALLA_CLIENT_SECRET=your_client_secret
SALLA_REDIRECT_URL=http://localhost:3000/api/connect/salla/callback

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
This project uses Next.js App Router. When deploying to Cloudflare Pages:
- The API routes (`/api/*`) run as Cloudflare Pages Functions.
- Ensure all Environment Variables are set in the Cloudflare Dashboard.
- `sqlite3` is used for local dev. For Prod, ensure D1 binding is configured if migrating to D1 (currently using file-based SQLite for MVP compatibility).
