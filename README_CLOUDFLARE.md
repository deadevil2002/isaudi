# Cloudflare Pages Deployment Guide for isaudi.ai

This guide explains how to deploy the **isaudi.ai** landing page to Cloudflare Pages.

## Prerequisites

- A GitHub account connected to the `isaudi_html` repository.
- A Cloudflare account.

## 1. Connect GitHub Repository

1.  Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2.  Go to **Workers & Pages** > **Create Application** > **Pages** > **Connect to Git**.
3.  Select the `isaudi_html` repository.

## 2. Configure Build Settings

Use the following settings during the setup wizard:

- **Framework Preset**: `Next.js (Static Export)`
- **Build command**: `npm run build`
- **Build output directory**: `out`

> **Note**: This project is configured for static export (`output: "export"` in `next.config.ts`). It does **not** require a Node.js server to run. It serves pure HTML/CSS/JS.

## 3. Environment Variables

No environment variables are required for the static landing page.

## 4. Custom Domain Setup

After the first deployment is successful:

1.  Go to your Pages project > **Custom Domains**.
2.  Click **Set up a custom domain**.
3.  Enter `isaudi.ai` and follow the DNS configuration steps (Cloudflare will guide you to update your DNS records).
4.  Repeat for `www.isaudi.ai`.

## Changed Files Reference

The following files were modified to prepare for this deployment:

1.  **`next.config.ts`**: Enabled static export (`output: "export"`) and unoptimized images.
2.  **`src/app/layout.tsx`**: Added SEO metadata (Title, Description, Open Graph) and wrapped app in `LanguageProvider`.
3.  **`src/components/providers/language-provider.tsx`**: Created new context for bilingual RTL/LTR toggling.
4.  **`src/components/layout/header.tsx`**: Connected language toggle button to the provider.

## Verification

To verify the build locally before pushing:

```bash
npm run build
# Check if the 'out' directory is created
ls out
```
