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
   deployment environment. Authorizer email is metadata only, never proof of ownership.
6. Add an optional, non-public single-line text setting with key
   `isaudi_link_code`, Arabic label `رمز ربط iSaudi`, and English label
   `iSaudi Link Code`. Enable `app.settings.updated`. Accept 32 hexadecimal
   characters, optionally separated into eight four-character groups by hyphens
   (39 displayed characters). Do not use a numeric field or expose it on the storefront.
7. Confirm this field exists before attempting a real merchant claim.

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
4. Encrypted credentials are stored by authoritative Salla merchant ID, unclaimed.
5. A signed-in verified user generates a ten-minute single-use linking code,
   copies it into the Salla app setting, and saves settings.
6. The signed settings event atomically claims the merchant and consumes the
   code. Only a domain-separated digest is stored. Regeneration invalidates
   earlier active codes. Expiry uses server time, not event time.
7. Existing ownership is immutable, including after uninstall. Products and
   orders cannot use unclaimed credentials.

The legacy custom OAuth callback remains in the codebase for compatibility but
is not used by the normal connect action.

Easy Mode does not provide browser correlation between the install click and
the webhook. The status API therefore never guesses the initiating user: it
shows waiting based on that user's active linking code, and connection state
only for their owned merchant. No email matching or installation-click ordering
is used.

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
