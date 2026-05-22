# NextDoorLearn Completion Plan

## Goal

Turn NextDoorLearn into a polished, deployable tutoring platform for students and volunteer/low-cost tutors, with a redesigned frontend, a production-ready backend, and a free/low-cost hosting path using Vercel for the frontend and Railway for the API/database.

The priority is not to preserve the current visual design. Existing functionality should be kept where it works, but the user experience should be redesigned from the ground up so the app feels trustworthy, modern, accessible, and ready for real users.

## Product North Star

NextDoorLearn should feel like a community education hub, not a class project dashboard. A student should be able to join, explain what they need, find a tutor, request help, schedule a session, and message that tutor without confusion. A tutor should be able to join, build a credible profile, manage requests, message students, and track sessions with minimal friction.

## Recommended Hosting Architecture

- Frontend: Vercel, serving the React/Vite app.
- Backend API: Railway, running the Express server.
- Database: Railway PostgreSQL for production.
- File uploads: avoid local disk in production. Use Cloudinary free tier, UploadThing, Supabase Storage free tier, or disable uploads until storage is configured.
- Email: Resend free tier or Brevo free tier for transactional email.
- Realtime: start with polling/SSE if needed; add WebSockets only after the core UX is solid.
- Monitoring: Railway logs plus simple health checks; add Sentry free tier later.

SQLite is fine locally, but it is not a good fit for Railway production unless using persistent volumes deliberately. PostgreSQL should be part of the launch plan.

## Current State Summary

The project already has a strong MVP foundation:

- React/Vite frontend.
- Express backend.
- JWT authentication.
- Student/tutor roles.
- Profiles.
- Tutor browsing.
- Connection requests.
- Messaging.
- Sessions.
- Reviews.
- Notifications.
- Availability tables.
- Google Calendar integration scaffolding.
- Vercel/Railway/Netlify deployment files.

Main issues to fix before launch:

- Frontend visual system feels inconsistent and overly custom.
- Screens duplicate navigation and layout logic.
- Many inline styles and emoji-based UI elements make the product feel less mature.
- Frontend package does not currently include Tailwind despite docs mentioning it.
- Production deployment still has hardcoded localhost avatar URLs in places.
- Backend CORS is too open for production.
- SQLite and local uploads are not production-safe by default.
- No real test suite.
- No seed/demo data workflow.
- No polished public landing/onboarding flow.

## Build Strategy

Do not rewrite the whole backend first. Keep the working Express API, then harden it. The biggest visible win will come from a frontend rebuild.

Recommended approach:

1. Stabilize the current behavior with smoke tests and a local seed database.
2. Rebuild the frontend design system and app shell.
3. Redesign all core screens using reusable components.
4. Fix production API, uploads, CORS, environment variables, and database.
5. Add missing launch features.
6. Deploy to Vercel + Railway.
7. Run beta testing and polish.

## Phase 1: Product Definition And UX Direction

Outcome: clear scope, visual direction, and user flows before implementation.

Tasks:

- Define launch personas:
  - Student seeking help.
  - Tutor offering help.
  - Optional future admin/moderator.
- Define the MVP launch promise:
  - "Find a trusted tutor, request help, schedule a session, and stay connected."
- Decide whether tutoring is free, paid, donation-based, or mixed.
- Decide if public browsing is allowed before login.
- Decide whether tutors need approval before appearing publicly.
- Define trust language: community service, verified tutors, reviews, session history.
- Create a simple sitemap:
  - Public home.
  - Login/register.
  - Student dashboard.
  - Tutor dashboard.
  - Browse tutors.
  - Tutor profile detail.
  - Requests.
  - Messages.
  - Sessions/calendar.
  - Profile/settings.

Acceptance criteria:

- User roles and launch scope are written down.
- The app has a clear first-time-user journey.
- Anything not needed for launch is moved to a post-launch list.

## Phase 2: Visual Redesign

Outcome: beautiful, trustworthy, responsive UI.

Recommended style:

- Bright, calm, community-focused.
- Light mode as the default.
- Warm off-white page background, crisp white surfaces, deep readable text.
- Accent palette using teal/blue for learning/trust, coral or amber for warmth, green for success.
- Avoid heavy dark dashboard styling as the default.
- Use real human-centered imagery or tasteful generated educational/community visuals on public pages.
- Replace emoji UI with lucide-react icons.
- Use consistent spacing, type scale, buttons, forms, cards, badges, tabs, and empty states.

Frontend technical recommendation:

- Add Tailwind CSS or move to a focused component library.
- Best lightweight path:
  - Tailwind CSS.
  - lucide-react.
  - class-variance-authority for component variants if desired.
  - react-hook-form + zod for forms.
  - sonner or react-hot-toast for notifications.
- Alternative polished path:
  - shadcn/ui components on top of Tailwind.

Core design system components:

- AppShell.
- TopNav.
- Sidebar or responsive bottom/mobile nav.
- PageHeader.
- Button.
- Input/Textarea/Select.
- Badge.
- Avatar.
- EmptyState.
- LoadingState.
- StatCard.
- TutorCard.
- SessionCard.
- RequestCard.
- MessageThread.
- Modal/Drawer.
- Toast.

Acceptance criteria:

- Every screen uses the same layout system.
- No page-level inline styling except rare dynamic values.
- Mobile screens are first-class.
- Buttons and controls look consistent.
- The app no longer feels like disconnected pages.

## Phase 3: Frontend Rebuild Screen By Screen

Outcome: the existing features are preserved but presented in a much better product experience.

### Public Home

Build a real first screen, not a generic marketing page.

Content:

- Strong brand signal: NextDoorLearn.
- Clear value proposition for students and tutors.
- Two primary actions: "Find a tutor" and "Become a tutor."
- Trust markers: free/affordable help, community tutors, session scheduling, reviews.
- Preview of subjects and tutor cards.

### Auth And Onboarding

Tasks:

- Merge login/register into a polished auth flow.
- Let users choose Student or Tutor clearly.
- Add profile setup steps after registration.
- Show profile completeness after login.
- Improve form validation and errors.

Acceptance criteria:

- A new user can register and immediately understand what to do next.
- Failed auth states are clear and friendly.

### Student Dashboard

Primary jobs:

- Continue a conversation.
- See upcoming sessions.
- Browse recommended tutors.
- Track pending requests.

Layout:

- Welcome header.
- Quick action row.
- Upcoming session panel.
- Active tutor connections.
- Recommended tutors.
- Recent notifications.

### Tutor Dashboard

Primary jobs:

- Respond to requests.
- Prepare for upcoming sessions.
- Manage availability.
- Keep profile credible.

Layout:

- Welcome header.
- Request queue.
- Upcoming sessions.
- Availability summary.
- Student conversations.
- Review/rating summary.

### Browse Tutors

Tasks:

- Build a high-quality discovery experience.
- Add search, subject filters, availability, rating, cost/free filter.
- Add tutor detail view or route.
- Show profile photos, subjects, teaching style, rating, response status.
- Replace alert-based request handling with toasts and disabled states.

Acceptance criteria:

- Students can compare tutors quickly.
- Tutor cards look polished and informative.
- Request flow feels intentional.

### Tutor Profile Detail

Tasks:

- Add route `/tutors/:id`.
- Show bio, subjects, education, teaching style, reviews, availability, and request CTA.
- Show trust signals and response status.

### Requests

Tasks:

- Redesign request queue.
- Separate pending, accepted, declined.
- Add clear accept/decline actions for tutors.
- Add request status for students.

### Messages

Tasks:

- Redesign as a two-pane desktop layout and single-thread mobile layout.
- Add conversation list, unread indicators, timestamps.
- Add graceful empty state.
- Keep polling initially if simpler.
- Later upgrade to SSE or WebSockets.

### Sessions

Tasks:

- Redesign session list/calendar.
- Add schedule session flow.
- Add status updates: scheduled, completed, cancelled, no-show.
- Add meeting link field.
- Add session notes after completion.

### Profile And Settings

Tasks:

- Split profile into sections:
  - Basic info.
  - Role-specific profile.
  - Subjects.
  - Availability.
  - Photo.
  - Account/security.
- Add profile completeness.
- Fix avatar URL handling for production.

Acceptance criteria:

- Both student and tutor profiles look credible and complete.
- Profile updates feel safe and confirmed.

## Phase 4: Backend Hardening

Outcome: backend is suitable for public beta.

Tasks:

- Replace permissive CORS with allowed origins from environment variables.
- Add `helmet`.
- Add rate limiting for auth and general API routes.
- Add request validation with zod or express-validator.
- Normalize API error responses.
- Add pagination where lists may grow.
- Add role checks where needed.
- Add ownership checks for sessions, messages, requests, reviews, and uploads.
- Move secrets fully into env vars.
- Add production-safe logging.
- Add health endpoint with database check.

Acceptance criteria:

- API rejects invalid input predictably.
- Users cannot access another user's private data.
- Production frontend origin is explicitly allowed.
- Health check confirms API and DB status.

## Phase 5: Database And Storage

Outcome: production data survives deployments.

Tasks:

- Add Railway PostgreSQL.
- Replace direct SQLite-only code with a database layer that supports PostgreSQL.
- Choose one of:
  - Migrate to Prisma.
  - Use `pg` with SQL migrations.
  - Use Knex migrations.
- Create migration files for all current tables.
- Add seed script for demo users, tutors, sessions, and reviews.
- Decide upload storage:
  - Recommended: Cloudinary for avatars.
  - Alternative: Supabase Storage.
  - Temporary: disable avatars in production until storage is ready.
- Remove committed database files from future production workflow.

Acceptance criteria:

- Production database is PostgreSQL.
- Schema is reproducible from migrations.
- Demo data can be generated.
- Uploaded avatars do not depend on local server disk.

## Phase 6: Launch Features To Add Or Finish

Outcome: the product feels complete enough for real beta users.

Must-have:

- Forgot password or at least admin/manual reset plan.
- Email verification or clear "beta account" limitation.
- Email notifications for requests and upcoming sessions.
- Better notification center.
- Tutor profile detail pages.
- Profile completeness.
- Reviews displayed clearly.
- Empty/loading/error states everywhere.
- Terms, privacy, and community guidelines pages.
- Basic contact/support link.

Should-have:

- Favorites/bookmarks for students.
- Availability editor for tutors.
- Session reminder emails.
- Admin seed/moderation script.
- Public tutor browsing with login required to request.

Later:

- Real-time messaging.
- Video calls.
- Payments.
- Native mobile app.
- Full tutor verification workflow.

## Phase 7: Testing And Quality

Outcome: confidence before beta launch.

Tasks:

- Add frontend lint fixes.
- Add backend unit tests for auth, connections, messages, sessions.
- Add API integration tests with a test database.
- Add Playwright end-to-end smoke tests:
  - Register student.
  - Register tutor.
  - Student browses tutors.
  - Student sends request.
  - Tutor accepts request.
  - Messages are exchanged.
  - Session is scheduled.
  - Review is submitted.
- Add responsive visual checks for:
  - Mobile 390px.
  - Tablet 768px.
  - Desktop 1440px.
- Test deployment environment with production API URL.

Acceptance criteria:

- `npm run build` passes for frontend.
- Backend test suite passes.
- E2E happy path passes.
- No obvious mobile layout breakage.

## Phase 8: Deployment

Outcome: public beta URL is live.

Railway backend:

- Create Railway project.
- Add PostgreSQL service.
- Deploy backend service from `/backend`.
- Set env vars:
  - `NODE_ENV=production`
  - `JWT_SECRET`
  - `DATABASE_URL`
  - `FRONTEND_URL`
  - email provider keys if used
  - storage provider keys if used
- Confirm `/api/health`.

Vercel frontend:

- Import repo.
- Set root directory to `frontend`.
- Build command: `npm run build`.
- Output directory: `dist`.
- Set `VITE_API_URL=https://your-railway-api-url/api`.
- Add SPA rewrite if needed.

Post-deploy checks:

- Register/login.
- Profile setup.
- Browse tutors.
- Request connection.
- Messaging.
- Session scheduling.
- Avatar upload if enabled.
- Refresh on nested routes.

Acceptance criteria:

- Vercel URL works.
- Railway API works.
- Full core workflow works in production.

## Phase 9: Beta Launch

Outcome: real feedback from a small controlled group.

Tasks:

- Recruit 5 students and 3 tutors.
- Provide simple onboarding instructions.
- Ask them to complete one realistic workflow.
- Collect feedback on:
  - Visual trust.
  - Ease of signing up.
  - Tutor discovery.
  - Messaging clarity.
  - Scheduling clarity.
  - Mobile usability.
- Fix the top 10 issues.

Acceptance criteria:

- At least 8 beta users complete onboarding.
- At least 3 student-tutor connections are attempted.
- Feedback is documented and prioritized.

## Suggested Implementation Order

1. Add design dependencies and app shell.
2. Build reusable UI components.
3. Redesign login/register.
4. Redesign dashboard.
5. Redesign tutor browsing and tutor detail.
6. Redesign requests.
7. Redesign messages.
8. Redesign sessions.
9. Redesign profile/settings.
10. Add backend production hardening.
11. Move database to PostgreSQL.
12. Add email/storage.
13. Add tests.
14. Deploy.
15. Beta test.

## Concrete Milestones

### Milestone 1: Beautiful Local App

Deliverables:

- New visual system.
- Redesigned auth, dashboard, tutor browsing, profile.
- Existing API still works.
- Frontend build passes.

### Milestone 2: Complete Core Workflows

Deliverables:

- Requests, messages, sessions, reviews fully polished.
- Empty states and errors handled.
- Student and tutor flows tested locally.

### Milestone 3: Production Backend

Deliverables:

- CORS, validation, rate limits, security headers.
- PostgreSQL migration.
- Production env config.
- Health check.

### Milestone 4: Hosted Beta

Deliverables:

- Vercel frontend.
- Railway API/database.
- Production workflow tested.
- Beta instructions ready.

### Milestone 5: Beta Feedback Polish

Deliverables:

- Top beta issues fixed.
- Docs updated.
- Launch checklist complete.

## Definition Of Done

The project is complete when:

- The app looks polished on mobile and desktop.
- Students and tutors can complete the full workflow in production.
- The frontend is deployed on Vercel.
- The backend and database are deployed on Railway.
- Environment variables are documented.
- No hardcoded localhost URLs remain.
- Production data persists.
- Critical routes are protected.
- Basic tests pass.
- A new user can understand the app without help.

