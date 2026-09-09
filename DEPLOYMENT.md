# NextDoorLearn Deployment Guide

The production stack is:

- Frontend: Vercel
- Backend API: Render
- Database: Neon PostgreSQL free plan

Local development continues to use SQLite unless `DATABASE_URL` is set.

## 1. Create The Neon Database

1. Create a free project at [Neon](https://console.neon.tech/).
2. Copy the pooled PostgreSQL connection string from the project dashboard.
3. Keep the connection string private. It contains the database password.

No SQL import is required. The backend creates every required table and index when it starts.

To test a Neon connection locally:

```bash
cd backend
DATABASE_URL='your-neon-pooled-connection-string' npm run db:check
```

Expected output starts with `Database ready (postgres)`.

## 2. Connect Render To Neon

Open the `nextdoorlearn-backend` service in Render, then add this environment variable:

```env
DATABASE_URL=your-neon-pooled-connection-string
```

Keep the existing variables, including `JWT_SECRET`, `FRONTEND_URL`, `CORS_ORIGINS`, and `UPLOAD_DIR`. Trigger a deploy after saving the variable. The API automatically selects PostgreSQL whenever `DATABASE_URL` exists.

Verify the deployment:

```bash
curl https://nextdoorlearn-backend.onrender.com/api/health
```

The response should contain `"status":"ok"` and `"database":"ok"`.

Then run the complete API workflow:

```bash
cd backend
SMOKE_API_URL=https://nextdoorlearn-backend.onrender.com/api npm run smoke
```

The smoke test creates disposable student and tutor accounts and exercises authentication, profiles, applications, waitlisting, connections, scheduling, progress, notifications, and messaging.

## 3. Vercel Frontend

The Vercel project should use:

```env
VITE_API_URL=https://nextdoorlearn-backend.onrender.com/api
```

Its root directory is `frontend`, build command is `npm run build`, and output directory is `dist`.

## 4. Local Development

Backend with SQLite:

```bash
cd backend
cp .env.example .env
npm install
npm start
```

Frontend:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Local URLs are `http://localhost:5173` for the frontend and `http://localhost:3001/api/health` for backend health.

## 5. Remaining Storage Work

Neon makes accounts and application data persistent. Uploaded profile pictures still use Render's temporary filesystem and can disappear during a restart or deploy. Move uploads to Cloudinary, Amazon S3, or another object store before relying on them in production.

Also configure `RESEND_API_KEY` and `EMAIL_FROM` before requiring email verification or password-reset email delivery.
