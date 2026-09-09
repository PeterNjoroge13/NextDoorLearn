# NextDoorLearn

NextDoorLearn is a tutoring and mentorship platform for connecting students with tutors in their community. The current beta supports student/tutor accounts, tutor discovery, connection requests, messaging, sessions, reviews, notifications, availability, and profile management.

## Tech Stack

- Frontend: React 19 + Vite
- Backend: Node.js + Express
- Database: PostgreSQL (Neon) in production, SQLite fallback for local development
- Authentication: JWT + bcrypt
- Hosting: Vercel frontend + Render backend + Neon PostgreSQL

## Requirements

- Node `>=20.19.0`
- npm

The repo includes `.nvmrc` for compatible local and hosted Node versions.

## Local Setup

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
cp .env.example .env
npm install
npm run dev
```

Local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- Health check: `http://localhost:3001/api/health`

## Core Features

- Student and tutor registration/login
- Role-specific dashboard
- Profile editing and profile completion
- Tutor browse/search/filter
- Student-to-tutor connection requests
- Direct messaging for connections
- Session scheduling and status tracking
- Tutor reviews and ratings
- In-app notifications
- Tutor availability windows
- Optional Google Calendar integration scaffolding

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the Vercel, Render, and Neon setup.

Useful production env vars:

```env
JWT_SECRET=use-a-long-random-secret
FRONTEND_URL=https://your-vercel-app.vercel.app
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
VITE_API_URL=https://nextdoorlearn-backend.onrender.com/api
```

See [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) before beta launch.

## Notes

- `node_modules`, local SQLite files, and uploaded avatars are intentionally ignored.
- The backend uses SQLite when `DATABASE_URL` is absent and PostgreSQL when it is present.
- The production schema is created automatically and safely with `CREATE TABLE IF NOT EXISTS` statements.
- Local filesystem uploads should move to object storage before a larger public launch.
