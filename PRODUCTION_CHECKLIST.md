# NextDoorLearn Production Checklist

## Required Before Beta

- Deploy backend on Render.
- Deploy frontend on Vercel.
- Set `VITE_API_URL` in Vercel.
- Create a Neon project and set its pooled connection string as `DATABASE_URL` in Render.
- Set `JWT_SECRET`, `FIELD_ENCRYPTION_KEY`, and `JOB_SECRET` in Render. The Blueprint generates all three secrets and configures `FRONTEND_URL` plus `CORS_ORIGINS` for the public domain and Vercel fallback.
- Set `RESEND_API_KEY`, `EMAIL_FROM`, and `RESEND_WEBHOOK_SECRET` in Render for password reset, verification, and delivery tracking.
- Create a Zoom Server-to-Server OAuth app and set `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, and `ZOOM_HOST_USER_ID` in Render.
- Create Google OAuth web credentials and set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`; register `https://nextdoorlearn-backend.onrender.com/api/google/callback` as an authorized redirect URI.
- Set `ADMIN_EMAILS` in Render for moderation endpoints.
- Keep `REQUIRE_EMAIL_VERIFICATION=false` until Resend delivery is confirmed, then switch it to `true`.
- Verify `https://your-api/api/health`.
- Run `SMOKE_API_URL=https://your-api/api SMOKE_FRONTEND_ORIGIN=https://your-frontend npm run smoke:production` from `backend`.
- Confirm the `Production smoke` GitHub Actions workflow passes after each release; it also checks the live services every six hours.
- Run the mutation-heavy `npm run smoke` only against local or staging environments.
- Register a student, submit a tutor application, approve it in the admin console, and activate the tutor account.
- Complete the approved tutor profile with subjects.
- Send and accept a connection request.
- Send messages between connected users.
- Schedule a session.
- Confirm the session creates a Zoom room, sends both participants an email, and appears in Google Calendar for connected users.

## Important Soon After Beta

- Move database-backed images to S3-compatible object storage when upload volume begins to grow beyond the Neon plan.
- Enable required email verification after Resend and the sending domain are verified.
- Add Playwright UI smoke tests.
- Add production monitoring/error reporting and uptime alerts.
- Configure automated Neon backups or point-in-time recovery for the production branch.

## Known Local Notes

- This project expects Node `>=20.19.0`.
- Local development still works with SQLite.
- New profile and tutor-application images are stored in the database; legacy local upload URLs remain readable.
- Generated runtime files are intentionally ignored by Git.
