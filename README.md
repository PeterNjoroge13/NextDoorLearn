# NextDoorLearn

NextDoorLearn is a tutoring and mentorship platform for connecting students with tutors in their community. The current beta supports student/tutor accounts, tutor discovery, connection requests, messaging, sessions, reviews, notifications, availability, and profile management.

## Tech Stack

- Frontend: React 19 + Vite
- Backend: Node.js + Express
- Database: SQLite for local/beta use
- Authentication: JWT + bcrypt
- Hosting target: Vercel frontend + Railway backend

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

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Vercel and Railway setup.

Useful production env vars:

```env
JWT_SECRET=use-a-long-random-secret
FRONTEND_URL=https://your-vercel-app.vercel.app
VITE_API_URL=https://your-railway-api.up.railway.app/api
DATABASE_PATH=/data/nextdoorlearn.db
UPLOAD_DIR=/data/uploads
```

See [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) before beta launch.

## Notes

- `node_modules`, local SQLite files, and uploaded avatars are intentionally ignored.
- SQLite is acceptable for a small beta with a Railway volume, but PostgreSQL is the recommended next database step.
- Local filesystem uploads should move to object storage before a larger public launch.

