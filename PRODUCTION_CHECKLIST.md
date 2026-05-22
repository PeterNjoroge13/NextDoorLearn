# NextDoorLearn Production Checklist

## Required Before Beta

- Deploy backend on Railway.
- Deploy frontend on Vercel.
- Set `VITE_API_URL` in Vercel.
- Set `JWT_SECRET`, `FRONTEND_URL`, `DATABASE_PATH`, and `UPLOAD_DIR` in Railway.
- Set `RESEND_API_KEY` and `EMAIL_FROM` in Railway for password reset and email verification.
- Attach a Railway volume if using SQLite for beta.
- Verify `https://your-api/api/health`.
- Run `SMOKE_API_URL=https://your-api/api npm run smoke` from `backend`.
- Register a student and tutor in production.
- Complete a tutor profile with subjects.
- Send and accept a connection request.
- Send messages between connected users.
- Schedule a session.

## Important Soon After Beta

- Move SQLite to PostgreSQL.
- Move avatar uploads to persistent object storage.
- Decide whether to require email verification before messaging/scheduling.
- Add Playwright UI smoke tests.
- Add monitoring/error reporting.

## Known Local Notes

- This project expects Node `>=20.19.0`.
- Local development still works with SQLite.
- Local uploads are stored under `backend/uploads`.
- Generated runtime files are intentionally ignored by Git.
