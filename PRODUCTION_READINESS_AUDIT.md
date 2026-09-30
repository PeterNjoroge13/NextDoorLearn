# NextDoorLearn Production Readiness Audit

Last updated: September 28, 2026

This audit separates launch blockers from code that is already implemented. A green build is not treated as proof that external providers or operational processes are ready.

## P0: Launch Blockers

- **Transactional email and verification:** production currently reports email as unconfigured and email verification as optional. Configure Resend, verify the sending domain and webhook, test delivery/retry/bounce handling, then require verification.
- **Payments:** complete Stripe Connect platform verification, configure live keys and webhook signing, and pass the documented payment, refund, dispute, payout, and mobile PaymentSheet release gate before accepting money.
- **Backups and recovery:** enable Neon recovery appropriate to the selected plan and perform a restore drill. A backup that has never been restored is not a verified recovery plan.
- **Legal and youth safety:** obtain review of Terms, Privacy, cancellation/refund policy, tutor classification, minor/guardian consent, mandated-reporting process, data retention, and account deletion language.
- **Operational ownership:** assign a human owner and response target for safety reports, tutor approvals, refund failures, Stripe disputes, provider outages, and account appeals.

## P1: Complete Before Public Launch

- Configure Zoom and Google OAuth, then test 429, timeout, revoked-token, partial-failure, reschedule, and cancellation behavior with real sandbox accounts.
- Route failed workflow notifications to the production operator. Scheduled jobs now use signed GitHub OIDC identity, and job heartbeats, stale leases, health reporting, and admin warnings are implemented.
- Add hosted error tracking and uptime alerts with request IDs, release identifiers, and a documented incident-response path.
- Complete physical-device testing on supported iPhones and Android devices, including push permissions, deep links, password reset links, checkout return paths, accessibility text sizes, and poor networks.
- Complete App Store Connect and Play Console records, privacy answers, screenshots, age rating, support URL, review credentials, and account-deletion reviewer notes.
- Run a real beta with student and tutor cohorts and rehearse tutor rejection, suspension, appeal, no-show, refund failure, dispute, and safety escalation workflows.
- Obtain legal approval for message, support, audit, application, and anonymized financial retention periods. Expired security tokens and completed-email content now have configurable automated cleanup.

## P2: Production Improvements

- Extend the implemented message-history cursor pagination to conversations, session history, tutors, applications, reports, and audit logs before those datasets become large.
- Add a staging environment with separate database branches, Stripe test mode, email domain, OAuth apps, and mobile build profile.
- Add privacy-aware analytics for onboarding completion, match quality, booking conversion, attendance, and retention.
- Exercise the new integration maintenance switches during a staging incident drill before launch.
- Add tutor vacation mode, archived conversations, receipts, downloadable invoices, dispute intake, and appeal tracking.
- Move media to object storage with malware scanning, image re-encoding, lifecycle rules, and deletion propagation as volume grows.
- Expand the new bounded load-smoke runner into authenticated staging scenarios for tutor discovery, conversations, notifications, and administration queues.

## Implemented In The September 27 Pass

- Account deletion now anonymizes personal data instead of cascading away payment and safety history.
- Future sessions are cancelled and payment settlement is attempted for deletion, safety blocks, suspension, and bans.
- Moderation revokes refresh tokens, invalidates access tokens, and disables push devices.
- Users can export their account data from desktop web and native mobile.
- Email and reminder workers use recoverable leases to prevent concurrent duplicate work.
- Email delivery has bounded retries, a dead-letter state, administrator visibility, and a guarded retry action.
- The scheduled worker reconciles non-final payments on cancelled sessions with provider-idempotent retries.
- Background work records durable heartbeats, rejects overlapping runs, expires abandoned leases, and surfaces stale or failed execution in health and admin views.
- Scoped maintenance switches pause new bookings and provider writes without blocking Stripe webhooks, refunds, existing records, or cleanup operations.
- Zoom retries rate limits and transient provider failures; Google Calendar isolates participant failures and disables sync after revoked authorization.
- Scheduled retention removes expired authentication artifacts and redacts aged email content while preserving operational delivery metadata.
- Production request and fatal-error logs are structured, request-ID correlated, and omit bodies, network addresses, and direct contact information.
- Database migration `017_operational_recovery` adds only nullable lifecycle/lease fields and recovery indexes for a low-risk rollout.
- Database migration `018_background_job_health` adds the bounded operational run ledger used by heartbeat monitoring.
- Database migration `019_message_history_pagination` adds the composite index used by cursor-based message history.

## Release And Rollback Notes

- Deploy the backend before relying on the new web/mobile controls so migrations `017_operational_recovery` through `019_message_history_pagination` are present.
- These migrations are additive. Rolling application code back does not require dropping columns, tables, or indexes.
- Do not roll back by deleting anonymized user ledger rows; payment and moderation records may be required for reconciliation and safety investigations.
- Monitor `email_outbox.dead_letter`, `session_payments.refund_failed`, open safety reports, and `backgroundJobs` health after every release.
