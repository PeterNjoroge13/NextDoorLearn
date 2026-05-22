# NextDoorLearn Deployment Guide

This branch is set up for a low-cost beta deployment:

- Frontend: Vercel
- Backend API: Railway
- Current database: SQLite for beta/local use
- Recommended production database next: Railway PostgreSQL

## 1. Deploy The Backend On Railway

1. Push this branch to GitHub.
2. In Railway, create a new project from the GitHub repo.
3. Use the root repo with the included `railway.json`, or set the service root to `backend`.
4. Confirm Railway uses:
   - Build command: `cd backend && npm install`
   - Start command: `cd backend && npm start`
5. Set these backend environment variables:

```env
NODE_ENV=production
PORT=3001
JWT_SECRET=use-a-long-random-secret
DATABASE_PATH=/data/nextdoorlearn.db
FRONTEND_URL=https://your-vercel-app.vercel.app
CORS_ORIGINS=https://your-custom-domain.com
RATE_LIMIT_MAX=300
AUTH_RATE_LIMIT_MAX=30
```

Optional Google Calendar variables:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://your-railway-api.up.railway.app/api/google/callback
```

After deploy, verify:

```bash
curl https://your-railway-api.up.railway.app/api/health
```

Expected response includes `"status":"ok"` and `"database":"ok"`.

## 2. Deploy The Frontend On Vercel

1. Import the GitHub repo in Vercel.
2. Set the project root directory to `frontend`.
3. Use:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Set this frontend environment variable:

```env
VITE_API_URL=https://your-railway-api.up.railway.app/api
```

5. Deploy.
6. Add the final Vercel URL to Railway as `FRONTEND_URL`.
7. Redeploy the Railway backend after changing CORS variables.

## 3. Local Development

Backend:

```bash
cd backend
cp .env.example .env
npm install
npm start
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- Health check: `http://localhost:3001/api/health`

## 4. Production Notes

- `backend/node_modules`, `backend/uploads`, and local SQLite database files are intentionally ignored by Git.
- For a Railway SQLite beta, attach a persistent volume and set `DATABASE_PATH=/data/nextdoorlearn.db`.
- Local avatar uploads work for development, but Railway filesystem storage is not the right long-term upload solution.
- Before a public launch, move uploads to Cloudinary, Supabase Storage, or another persistent object store.
- SQLite can work for a tiny beta, but Railway PostgreSQL is the recommended next database step.
- Keep `JWT_SECRET` private and long.
- Keep `FRONTEND_URL` and `CORS_ORIGINS` aligned with the deployed frontend domains.

## 5. Smoke Test Checklist

After both services deploy:

1. Visit the Vercel frontend.
2. Register a student.
3. Register a tutor.
4. Complete tutor subjects/profile.
5. Student browses tutors.
6. Student sends a connection request.
7. Tutor accepts the request.
8. Student and tutor exchange messages.
9. A session is scheduled.
10. Refresh nested routes like `/dashboard`, `/tutors`, and `/profile`.
