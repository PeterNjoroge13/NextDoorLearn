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
- [ ] Make time-zone ownership explicit throughout booking and session displays.
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

- [ ] Complete iOS and Android identifiers, deep-link schemes, universal-link placeholders, and build profiles.
- [ ] Add production-safe app metadata, versioning, privacy declarations, and permission descriptions.
- [ ] Ensure every web workflow has an intentional mobile equivalent or safe handoff.
- [ ] Improve offline, loading, retry, empty, expired-session, and API-unavailable states.
- [ ] Verify keyboard handling, safe areas, dynamic text, touch targets, and screen-reader labels.
- [ ] Add scheduling/rescheduling, calendar connection, meeting access, reporting, and account controls.
- [ ] Produce repeatable EAS preview and store-build documentation.
- [ ] Run lint, type checking, export, and mobile-sized visual smoke tests in CI.

## Priority 1: UX Polish

- [ ] Standardize loading, empty, error, success, confirmation, and destructive-action patterns.
- [ ] Verify responsive behavior across compact mobile, tablet, laptop, and wide desktop layouts.
- [ ] Improve accessibility semantics, focus states, contrast, keyboard navigation, and reduced motion.
- [ ] Remove layout shifts and text overflow in navigation, cards, dialogs, forms, and dashboards.
- [ ] Make dates, times, time zones, prices, statuses, and role labels consistent everywhere.
- [ ] Add clear recovery paths when the API, integrations, or session data are unavailable.
- [ ] Audit performance, image sizing, route loading, and unnecessary network requests.

## Priority 1: Tutor And Student Improvements

- [ ] Keep student and tutor dashboards distinct, task-focused, and role appropriate.
- [ ] Improve onboarding progress and explain the next useful action for each role.
- [ ] Show transparent matching reasons without exposing private profile information.
- [ ] Improve tutor availability management and student slot selection.
- [ ] Expand learning goals, milestones, session notes, reflections, and progress history.
- [ ] Improve tutor application, approval, activation, public profile, review, and trust indicators.
- [ ] Add clear safety access to block, report, support, and moderation outcomes.
- [ ] Improve notification preferences and reduce duplicate or low-value alerts.

## Continuous Release Quality

- [ ] Expand API workflow tests to cover every critical student/tutor journey.
- [ ] Add browser-level tests for public, student, tutor, and administrator routes.
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
