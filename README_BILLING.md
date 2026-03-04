# Billing (Tap Only)

- Tap only. Moyasar is not used.

## Flow

1) Client requests a payment
- Endpoint: POST /api/billing/tap/create-payment
- Body: { planId: "starter|growth|enterprise", interval: "month|year" }

2) Server responds
- Response JSON includes: { redirectUrl } (or url fallback)

3) Client redirects user
- Browser is redirected to the Tap checkout page (redirectUrl)

4) Return and refresh
- After payment completion, Tap redirects back (e.g. to /billing?status=success)
- The UI refreshes the subscription status on load

## Notes
- Do not use any Moyasar routes or webhooks. They were removed.
- Ensure TAP_* environment variables are configured in the deployment.
