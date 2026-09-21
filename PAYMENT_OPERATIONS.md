# NextDoorLearn Payment Operations

The application code supports Stripe Connect destination charges. Students pay inside the NextDoorLearn web or native mobile checkout, and Stripe routes funds to the tutor's connected payout account. Stripe-hosted onboarding is used only for regulated tutor identity and bank verification.

## Production configuration

1. Complete the Stripe Connect platform profile, business verification, support details, branding, and public terms/privacy URLs.
2. In Render, set `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, and `STRIPE_WEBHOOK_SECRET`. Never put secret or webhook keys in Vercel, Expo public variables, screenshots, mobile builds, or git.
3. Create a Stripe webhook for `https://nextdoorlearn-backend.onrender.com/api/webhooks/stripe`.
4. Subscribe to `account.updated`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, and `charge.refunded`.
5. Leave `STRIPE_PLATFORM_FEE_PERCENT=0` until pricing, taxes, refunds, and tutor economics have been reviewed. The supported range is 0-20.
6. Confirm Render reports `payments: configured` at `/api/health`, then redeploy Vercel and create new EAS builds.

## Test-mode release gate

1. Create clean student and tutor accounts. Approve and activate the tutor through the real admin flow.
2. Set the tutor rate, schedule a 60-minute session, and verify the displayed total matches the booked rate.
3. Complete tutor payout onboarding with Stripe test data and confirm payout status becomes ready.
4. Pay from the website with a successful Stripe test card. Confirm the student sees Paid and the tutor sees the earning once the signed webhook arrives.
5. Repeat from an iPhone and Android preview build using native PaymentSheet.
6. Test a declined card and an authentication-required card. Confirm no false Paid state appears.
7. Cancel a paid session. Confirm a full refund and transfer reversal appear in Stripe and NextDoorLearn.
8. Retry webhook delivery from Stripe and confirm duplicate events do not duplicate notifications or ledger entries.
9. Verify a different student, tutor, and signed-out user cannot read or mutate the payment.
10. Export Stripe's test transaction records and reconcile them against `session_payments` before enabling live mode.

## Operating rules

- Never mark a payment paid from a browser or mobile response. The signed webhook is the source of truth.
- Never request card numbers, bank details, identity documents, or payout credentials in messages or support email.
- Do not change the duration of a paid session. Cancel/refund it and create a new booking.
- Investigate `refund_failed` immediately in Stripe, then document the resolution through the support process.
- Review Stripe disputes, connected-account restrictions, webhook failures, and payout failures every business day after launch.
- Keep the current policy text as an engineering draft until counsel reviews youth safety, marketplace terms, refunds, taxes, and independent tutor status.
