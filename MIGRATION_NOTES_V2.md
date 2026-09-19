# UI Migration Notes V2

## Purpose

These notes define the boundary for migrating the approved `/design-preview`
visual system into the real iSaudi.ai application.

## Source of truth

**The approved `/design-preview` is the visual source of truth.**

Use:

- `src/app/design-preview/page.tsx`
- `src/app/design-preview/preview.module.css`
- `src/app/design-preview/layout.tsx`
- `public/brand/design-preview-logo.png`

The preview is a presentation reference, not production business logic.

## Migration target

Apply the approved visual language to the existing production surfaces without
replacing their behavior:

1. Public header, footer, homepage, and marketing sections
2. Pricing presentation and billing entry points
3. Login, OTP, verification, and session-aware states
4. Authenticated shell and dashboard
5. Report generation, report details, comparison, and assistant
6. CSV and Salla connection flows
7. Account, settings, and subscription status
8. Admin presentation only after its separate security model is preserved

## Contracts that must not change

- Existing route paths and same-origin API paths
- D1 schema and ownership constraints
- OTP HMAC, expiry, attempt limits, rate limits, and session cookies
- Tap amount/currency/metadata verification and atomic subscription activation
- Tap `enterprise` checkout key to `business` entitlement mapping
- Salla signature verification, credential encryption, merchant ownership, and
  single-use linking codes
- Report ownership checks and AI quotas
- Admin authentication, roles, audit logs, reset, and transfer controls
- Real pricing: 199/399/899 SAR monthly and 1,999/3,999/8,999 SAR annually

## Preview-only elements

Do not copy preview simulation behavior into production:

- Visual-only OTP controls
- Illustrative dashboard figures
- Local-only assistant response
- Illustrative market comparison without an external market-data source
- TikTok concept; TikTok is unavailable and not integrated
- Preview notices and isolated-demo copy

## Migration approach

1. Work only on the dedicated migration branch.
2. Migrate shared brand tokens and layout primitives first.
3. Move one production surface at a time while retaining the existing data and
   action components.
4. Validate each changed route against its real API contract.
5. Keep primary content usable when client animation or hydration is unavailable.
6. Run tests, TypeScript, lint, and the production build before review.
7. Runtime-test the OpenNext build on an isolated Worker before any production
   deployment.
8. Do not merge or deploy until the complete migration is approved.

## Known risks

- The preview uses static illustrative content; production uses asynchronous,
  user-owned data and must retain loading/empty/error states.
- Production authentication and billing cannot use preview-only native/CSS
  simulation controls.
- Market comparison wording must not imply an external benchmark feed.
- TikTok must remain explicitly unavailable.
- Existing responsive behavior and Arabic RTL semantics must survive component
  replacement.
- Deployment applies targeted release SQL; migration state must be checked
  separately before any schema-dependent release.

## Exact stopping point

The visual direction and logo are approved, but no production route has been
migrated. Stop after creating the approved-state recovery commit/tag and
switching to the dedicated migration branch.