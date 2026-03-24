# FitFusion — Instant Deployment Steps

Your app is production-ready. Here's how to get it live in **5 minutes**:

## Step 1: Push to GitHub

1. Go to https://github.com/new and create a new repo called `fitfusion`
2. In PowerShell:
```powershell
cd "c:\Users\maliq\OneDrive\Documents\fitfusion"
git init
git config user.email "you@example.com"
git config user.name "Your Name"
git add .
git commit -m "FitFusion production-ready"
git remote add origin https://github.com/YOUR_USERNAME/fitfusion.git
git branch -M main
git push -u origin main
```

## Step 2: Deploy Backend to Railway (2 min)

1. Go to https://railway.app
2. Click **New Project** → **Deploy from GitHub**
3. Select your `fitfusion` repo
4. Railway detects it's a Node project; **choose `backend/` as root**
5. Add environment variables in Railway dashboard:
   ```
   PORT=4000
   JWT_SECRET=generateastrong32charsecrethereABC123XYZ
   JWT_EXPIRY=7d
   FRONTEND_ORIGIN=https://fitfusion.vercel.app
   DEMO_EMAIL=demo@fitfusion.app
   ```
6. **Deploy** — Railway will build & deploy automatically in ~2 min
7. **Copy your Railway backend URL** (e.g., `https://fitfusion-api.railway.app`)

## Step 3: Deploy Frontend to Vercel (2 min)

1. Go to https://vercel.com/dashboard
2. Click **Add New...** → **Project**
3. Select your `fitfusion` GitHub repo
4. Set **Framework Preset** to `Vite`
5. Set **Root Directory** to `frontend/`
6. Add **Environment Variable**:
   ```
   VITE_API_BASE=https://fitfusion-api.railway.app/api
   ```
   (Use your actual Railway URL from Step 2)
7. **Deploy** — Vercel will build & deploy in ~2 min
8. **Your app is live** at `https://fitfusion.vercel.app` (or your Vercel URL)

---

## Test Your Live App

1. Open https://fitfusion.vercel.app
2. **Sign up** or use demo:
   - Email: `demo@fitfusion.app`
   - Password: `demo1234`
3. **Test features**:
   - Log meals, workouts, weight, sleep, water
   - Generate personalized workouts
   - Build meal plans
   - Check AI coach advice
   - Auto-adjust your fitness plan
   - Join challenges, earn XP, climb leaderboard
   - Upload progress photos
   - Voice log (type as if speaking)
   - Connect Apple Health / Fitbit

---

## Health Check

After deployment, verify both services are running:

```powershell
# Test backend health (no auth needed)
Invoke-RestMethod -Uri "https://fitfusion-api.railway.app/api/health"

# Expected response:
# @{ ok = True; service = fitfusion-backend; secure = True; database = sqlite }
```

---

## Production Notes

- **JWT_SECRET**: Generate a strong random string (min 32 chars). Change from example above.
- **Database**: SQLite persists automatically in Railway (WAL mode enabled)
- **Uploads**: Progress photos stored in `backend/uploads/`
- **Security**: Helmet + rate limit + compression middleware enabled
- **Auth**: JWT tokens expire in 7 days (configurable via `JWT_EXPIRY`)

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Frontend can't connect to backend** | Check `VITE_API_BASE` env var matches your Railway URL exactly |
| **Login fails** | Clear browser cache, check JWT_SECRET is set in Railway |
| **Photos don't upload** | Ensure multer config allows image/* MIME types |
| **Fitbit OAuth fails** | Set `FITBIT_CLIENT_ID`, `FITBIT_CLIENT_SECRET` if using real Fitbit; else demo-connect works locally |

---

## Next: Monitor & Optimize

- Railway dashboard: https://railway.app (view logs, metrics)
- Vercel dashboard: https://vercel.com/dashboard (view builds, analytics)
- Set up error tracking: Sentry, LogRocket, or Railway's built-in
- Add analytics: Mixpanel, Segment, or Google Analytics

**You're now running FitFusion in production!**
