# 🚀 ABSOLUTE EASIEST Deployment - Get Live in 5 Minutes!

## ⚡ Method 1: Vercel (Frontend) + Render (Backend) - Recommended Free Path

You already have `vercel.json` and `render.yaml` configured.

### Backend → Render

1. Go to **[render.com](https://render.com)** → Sign up with GitHub
2. **"New"** → **"Blueprint"**
3. Select this repo
4. Render will read `render.yaml` and create `nextdoorlearn-backend`
5. Deploy → Copy your backend URL: `https://your-backend.onrender.com`

### Frontend → Vercel

1. Go to **[vercel.com](https://vercel.com)** → Sign up with GitHub (free)
2. **"Add New Project"** → Import your GitHub repo
3. **Settings:**
   - **Root Directory:** leave blank if using the root `vercel.json`, or set it to `frontend`
   - **Framework Preset:** Vite
4. **Environment Variables:**
   - **Key:** `VITE_API_URL`
   - **Value:** `https://your-backend.onrender.com/api` (your Render URL + `/api`)
5. Redeploy the frontend.

**Share this link:** `https://your-app.vercel.app`

---

## 🎯 Method 2: Render (Both in One Place)

### Deploy Both to Render (5 minutes)

1. Go to **[render.com](https://render.com)** → Sign up with GitHub

#### Backend:
2. **"New"** → **"Web Service"**
3. Connect your repo
4. Settings:
   - **Name:** `nextdoorlearn-backend`
   - **Root Directory:** `backend`
   - **Build:** `npm install`
   - **Start:** `npm start`
   - **Environment:** Add `JWT_SECRET` = `my-secret-123`
5. Deploy → Copy URL: `https://your-backend.onrender.com`

#### Frontend:
6. **"New"** → **"Static Site"**
7. Connect your repo
8. Settings:
   - **Name:** `nextdoorlearn-frontend`
   - **Root Directory:** `frontend`
   - **Build:** `npm run build`
   - **Publish:** `dist`
   - **Environment:** Add `VITE_API_URL` = `https://your-backend.onrender.com/api`
9. Deploy → Done! 🎉

**Share this link:** `https://your-frontend.onrender.com`

---

## 🏆 Which is Easiest?

**Vercel + Railway** = Fastest deployment, best performance
**Render** = Everything in one place, simpler to manage

Both are free and take ~5 minutes!

---

## ✅ That's It!

Your backend CORS is already configured to work with any frontend URL.

**Test it:** Visit your frontend URL and try logging in!

---

## 🆘 Quick Troubleshooting

- **Backend not working?** Check logs in Railway/Render dashboard
- **Frontend can't connect?** Make sure `VITE_API_URL` ends with `/api`
- **Build fails?** Make sure you selected the correct root directory (`frontend` or `backend`)
