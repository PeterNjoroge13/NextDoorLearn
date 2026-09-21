# NextDoorLearn Production Feature Backlog

Last updated: September 21, 2026

This file tracks production work that can be completed without external account credentials. Items that require Peter to configure a third-party service are listed separately so engineering work can continue without blocking.

## Priority 1: Scheduling Improvements

- [x] Add a first-class rescheduling workflow for confirmed and pending sessions.
- [x] Revalidate tutor availability and both participants' conflicts when a session moves.
- [x] Preserve authorization boundaries: only session participants can propose changes.
- [x] Notify the other participant and require confirmation when a student proposes a new time.
- [x] Refresh reminders, Google Calendar events, and managed Zoom meetings after rescheduling.
- [x] Add cancellation reasons and retain a useful audit trail.
- [x] Persist the tutor timezone on each booking and show it throughout availability, booking, and session displays.
- [x] Improve session detail states for pending, confirmed, cancelled, completed, and no-show sessions.
- [x] Add backend tests for overlapping sessions, invalid transitions, blocked users, and rescheduling.

## Priority 1: Security Review

- [x] Audit authenticated routes for object-level authorization and role enforcement.
- [x] Validate identifiers, status transitions, URLs, dates, times, pagination, profile inputs, and uploaded files.
- [x] Review authentication, refresh-token rotation, password recovery, logout, and session revocation.
- [x] Keep private reflections, meeting host links, student identities, contact details, and integration tokens out of unauthorized responses.
- [x] Add request correlation IDs and safer structured production error logging.
- [x] Add focused rate limits for authentication, public forms, messaging, uploads, reports, and blocks.
- [x] Run dependency audits and avoid unsafe forced downgrades for transitive Expo tooling advisories.
- [x] Add regression tests for cross-user access, blocked-user behavior, bounded history, and sensitive fields.

## Priority 1: Mobile Production Preparation

- [x] Configure iOS and Android identifiers, the custom deep-link scheme, adaptive icons, and build profiles.
- [x] Add production-safe metadata, runtime versioning, permission descriptions, and store declarations.
- [x] Give each critical web workflow an intentional mobile equivalent or policy handoff.
- [x] Handle loading, retry, empty, expired-session, API-unavailable, and network-timeout states.
- [x] Improve keyboard insets, safe areas, dynamic text behavior, touch targets, and shared screen-reader labels.
- [x] Add scheduling/rescheduling, calendar connection, meeting access, reporting, and account controls.
- [x] Produce repeatable EAS preview and store-build documentation.
- [x] Run lint, type checking, and static mobile export in CI; retain physical-device smoke testing as an owner release gate.

## Priority 1: UX Polish

- [ ] Standardize loading, empty, error, success, confirmation, and destructive-action patterns.
- [ ] Verify responsive behavior across compact mobile, tablet, laptop, and wide desktop layouts.
- [x] Add global keyboard focus visibility, skip navigation, and reduced-motion support.
- [ ] Complete a manual contrast and screen-reader audit across every workflow.
- [ ] Remove layout shifts and text overflow in navigation, cards, dialogs, forms, and dashboards.
- [x] Make booking timezones, prices, statuses, and role labels explicit across web and mobile.
- [x] Add clear recovery paths when the API, integrations, or session data are unavailable.
- [x] Split dashboard, payment, administration, and secondary routes into on-demand bundles.
- [ ] Finish image sizing and unnecessary-request performance audits.

## Priority 1: Tutor And Student Improvements

- [x] Keep student and tutor dashboards distinct, task-focused, and role appropriate.
- [x] Show onboarding progress and the next useful action for each role.
- [x] Show transparent matching reasons without exposing private profile information.
- [x] Enforce a $25/hour platform cap and let students filter and match by affordable price tiers.
- [x] Improve tutor availability management and add published-window selection during booking.
- [x] Support learning goals, milestones, session notes, private reflections, and progress history.
- [x] Support tutor application, approval, activation, public profiles, reviews, and trust indicators.
- [x] Add clear safety access to block, report, support, and moderation outcomes.
- [x] Improve notification preferences and reduce duplicate or low-value alerts.

## Priority 1: Marketplace Payments

- [x] Freeze the agreed tutor rate on each booking and calculate totals only on the server.
- [x] Add Stripe Connect tutor onboarding and payout-readiness checks.
- [x] Add embedded web checkout and native iOS/Android PaymentSheet checkout.
- [x] Persist a provider-neutral payment ledger with idempotent PaymentIntent creation.
- [x] Verify signed raw-body webhooks and ignore duplicate provider events.
- [x] Restrict payment data and actions by role, session ownership, and booking state.
- [x] Add cancellation refunds, transfer reversal, and visible refund states.
- [x] Add student payment history and tutor earnings/payout workspaces.
- [x] Add payment privacy, terms, deployment, and release documentation.

## Continuous Release Quality

- [ ] Expand API workflow tests to cover every critical student/tutor journey.
- [x] Add browser-level tests for public, student, tutor, and administrator routes.
- [ ] Keep frontend, backend, mobile, mutation smoke, and production smoke checks green.
- [ ] Commit and push focused checkpoints to `main` after verification.
- [ ] Keep deployment and operational documentation aligned with real behavior.

## Requires Peter Or External Credentials

- [ ] Configure Resend domain, API key, sender address, and delivery webhook.
- [ ] Configure Google OAuth credentials and publish/verify the consent screen when required.
- [ ] Configure Zoom Server-to-Server OAuth credentials and meeting scopes.
- [ ] Enroll in the Apple Developer Program and accept Apple agreements.
- [ ] Create/verify Google Play Console and Apple App Store Connect records.
- [ ] Obtain final legal review for Terms, Privacy Policy, youth-safety, and consent language.
- [ ] Establish operational decisions for tutor screening, incident response, and support ownership.
- [ ] Complete the Stripe Connect platform profile, business verification, branding, and live-mode review.
- [ ] Add Stripe live secret/publishable keys and the production webhook signing secret in Render.
- [ ] Run the test-mode payment, payout, cancellation, refund, dispute, and mobile physical-device release gates.
