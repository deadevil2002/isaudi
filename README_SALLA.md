# Salla Store Integration & Data Ingestion

This project supports Salla Easy Mode installation or CSV upload.

## 1. CSV Import (Works Immediately)
No external setup required. Users can upload products and orders immediately.
- **URL**: `/connect/csv`
- **Templates**: Available in `public/templates/` (and downloadable from the UI).
- **Processing**:
  - Parsed client-side (headers validation).
  - Sent to `/api/connect/csv/upload`.
  - Prices converted to Halala (x100) for storage.
  - Linked to `userId` with `platform='csv'`.

## 2. Salla Easy Mode (Owner configuration required)
The connect action opens the fixed Salla installation page for Partner App ID
`613623113`: `https://s.salla.sa/apps/install/613623113`.

### Setup Steps:
1. Go to [Salla Partners Portal](https://partners.salla.sa/).
2. Configure the app in Easy Mode.
3. Configure the webhook as `https://isaudi.ai/api/webhooks/salla`.
4. Enable the required app lifecycle events, including authorization and uninstall.
5. Configure the webhook secret and server OAuth client credentials in the
   deployment environment. The authorizing Salla email must exactly match one
   existing, verified iSaudi.ai account after email normalization; otherwise
   the merchant remains unclaimed.

### Environment Variables
```env
# Server credentials used for refresh grants
SALLA_CLIENT_ID=your_client_id
SALLA_CLIENT_SECRET=your_client_secret

# Security
# Required Cloudflare Worker secret for authenticated encryption of new Easy
# Mode credentials. Easy Mode fails closed when it is absent.
TOKEN_ENCRYPTION_KEY=super-secret-key-must-be-32-bytes-long!

# Easy Mode webhook verification (required)
SALLA_WEBHOOK_SECRET=your_webhook_secret
```

### Flow
1. User opens the exact Salla app installation URL.
2. Salla sends signed lifecycle webhooks.
3. The server verifies the raw-body signature before parsing.
4. Authorization identity is verified with Salla and matched to one verified
   local account.
5. Encrypted credentials are stored by authoritative Salla merchant ID.

The legacy custom OAuth callback remains in the codebase for compatibility but
is not used by the normal connect action.

Easy Mode does not provide browser correlation between the install click and
the webhook. The status API therefore never guesses the initiating user: it
shows an unclaimed/mismatch state only when the authenticated user's normalized
email equals the unclaimed authorizer email. Everyone else sees the
before-install state, with no merchant or other-account details.

`app.updated` is lifecycle-only. New access and refresh credentials are
accepted only from the documented `app.store.authorize` event; fields on
`app.updated` are not guessed or treated as credentials.

Refresh attempts are persisted before contacting Salla. If the provider may
have rotated a refresh token but the result cannot be confirmed locally, the
connection is marked for safe reauthorization rather than retrying the same
stored refresh token.

## 3. Database Schema
New tables added to SQLite (D1 compatible):
- `store_connections`: Stores tokens and store info.
- `salla_connections`: Authoritative Easy Mode merchant ownership, lifecycle,
  and encrypted rotating credentials.
- `products`: Unified product schema.
- `orders`: Unified order schema.

## 4. Cloudflare Deployment Note
This project uses the Next.js App Router through OpenNext on a Cloudflare Worker:
- API routes are same-origin under `https://isaudi.ai/api/*`.
- Production environment values are configured for the Cloudflare Worker.
- Production storage uses D1 database `isaudi-db` through binding `DB`.
