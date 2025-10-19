# NextDoorLearn Deployment Guide

## Frontend Deployment (Vercel)

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Deploy to Vercel**:
   ```bash
   cd frontend
   vercel
   ```

3. **Set Environment Variables** in Vercel dashboard:
   - `VITE_API_URL`: Your backend API URL (e.g., `https://your-backend.railway.app/api`)

## Backend Deployment (Railway/Render)

### Option 1: Railway
1. Go to [railway.app](https://railway.app)
2. Connect your GitHub repository
3. Select the `backend` folder
4. Railway will automatically detect Node.js and deploy

### Option 2: Render
1. Go to [render.com](https://render.com)
2. Create a new Web Service
3. Connect your GitHub repository
4. Set build command: `cd backend && npm install`
5. Set start command: `cd backend && npm start`

## Environment Variables for Backend

Create a `.env` file in the backend directory:
```env
JWT_SECRET=your-super-secret-jwt-key-change-in-production
PORT=3001
```

## Database

The app uses SQLite which will be created automatically. For production, consider:
- PostgreSQL with Railway/Render
- Update database connection in `backend/src/db/database.js`

## Testing the Deployment

1. **Frontend**: Visit your Vercel URL
2. **Backend**: Test API endpoints at `https://your-backend-url.com/api/health`
3. **Full Flow**: Register users, create profiles, send connection requests, and test messaging

## Production Considerations

- Change JWT secret to a strong, random value
- Set up proper CORS origins
- Add rate limiting
- Implement proper error logging
- Set up monitoring and alerts
- Consider using a production database (PostgreSQL)
- Add input validation and sanitization
- Implement proper security headers
