# Authentication Guide for isaudi.ai

This project implements a passwordless Email OTP authentication system.

## 1. Architecture

- **Auth Method**: Email Magic Code (OTP).
- **Session**: `httpOnly` cookie (`session_id`).
- **Database**:
  - **Development**: D1 binding via Cloudflare/Miniflare.
  - **Production (Cloudflare)**: Cloudflare D1 database `isaudi-db`, bound as `DB`.

## 2. Environment Setup

Copy `.env.example` to `.env.local`:

```env
# Secret for session signing (if using JWT, currently using DB session IDs)
AUTH_SECRET=your-secret-key-here

# Email Provider Configuration
# Options: 'dev' (logs to console) or 'resend' (sends real email)
EMAIL_PROVIDER=dev

# Resend API Key (Required if EMAIL_PROVIDER=resend)
RESEND_API_KEY=re_123456789

# Base URL
APP_URL=http://localhost:3000
```

## 3. How It Works

### Development Mode (Default)
1. User enters email at `/login`.
2. Backend generates a 6-digit code.
3. Code is **logged to the terminal console** (Look for `[DEV MODE] OTP Request`).
4. User enters code to verify.
5. Session cookie is set.

### Production Mode (Resend)
1. Set `EMAIL_PROVIDER=resend`.
2. Set `RESEND_API_KEY`.
3. System sends actual HTML email with the code.

## 4. Cloudflare Worker Deployment

The project uses Next.js API Routes (`src/app/api/*`).

- Production runs as a Cloudflare Worker built with OpenNext.
- The canonical application URL is `https://isaudi.ai`.
- The application API is same-origin at `https://isaudi.ai/api`.
- Deployment runs from GitHub Actions on pushes to `main`.
- `wrangler.toml` is the source of truth for Worker routes, D1 binding, and runtime variables.

## 5. API Routes

- `POST /api/auth/request-otp`: Generates and sends code.
- `POST /api/auth/verify-otp`: Validates code and sets session cookie.
- `POST /api/auth/logout`: Destroys session.

## 6. Files Modified
- `src/app/login/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/api/auth/*`
- `src/lib/db/*`
- `src/lib/email/*`
- `src/components/layout/header.tsx`
- `next.config.ts` (Removed export mode)
