# FitFusion — Production Deployment Guide

This guide helps you deploy FitFusion backend and frontend to production for live testing.

## Quickest Path: Railway + Vercel

### Backend: Deploy to Railway

1. **Create a Railway account** at https://railway.app (sign up with GitHub for easy setup).

2. **Create a new project** and connect your GitHub repo (`fitfusion`).

3. **Select this directory** as your project root: `backend/`

4. **Add environment variables** in Railway dashboard:
   ```
   PORT=4000
   JWT_SECRET=your-secure-random-32-char-secret-here
   JWT_EXPIRY=7d
   FRONTEND_ORIGIN=https://fitfusion.vercel.app
   DEMO_EMAIL=demo@fitfusion.app
   ```

5. **Deploy** – Railway automatically builds and deploys on push. Your backend will be live at:
   ```
   https://fitfusion-backend.railway.app
   ```

### Frontend: Deploy to Vercel

1. **Create a Vercel account** at https://vercel.com (sign up with GitHub).

2. **Create a new project** and connect your GitHub repo.

3. **Set project root** to `frontend/`

4. **Add environment variable**:
   ```
   VITE_API_BASE=https://fitfusion-backend.railway.app/api
   ```
   (Replace with your actual Railway backend URL from step 1.)

5. **Deploy** – Vercel automatically builds and deploys. Your frontend will be live at:
   ```
   https://fitfusion.vercel.app
   ```

---

## Alternative: Render (Full-Stack Single Repo)

If you prefer one platform for both:

### Backend on Render

1. Sign up at https://render.com
2. Create a new **Web Service** and connect your GitHub repo
3. Set **Build Command**: `cd backend && npm install && npm test`
4. Set **Start Command**: `cd backend && npm start`
5. Add environment variables (same as above)

### Frontend on Render (Static Site)

1. Create a new **Static Site** and connect repo
2. Set **Build Command**: `cd frontend && npm install && npm run build`
3. Set **Publish Directory**: `frontend/dist`

---

## Testing the Live Deployment

Once deployed, visit your frontend URL and:

1. **Sign up** with a new email or use demo:
   - Email: `demo@fitfusion.app`
   - Password: `demo1234`

2. **Test core flows**:
   - Log meals, workouts, steps, weight, sleep, water
   - Generate workouts (gym/home/travel/no-equipment)
   - Build meal plans (budget/high-protein/vegetarian/halal)
   - Check AI coach recommendations
   - Auto-adjust your plan
   - View progress predictions
   - Join challenges and check leaderboard
   - Upload progress photos
   - Voice log (text input simulating voice)
   - Connect Apple Health / Fitbit (local demo mode or OAuth if configured)

3. **Monitor logs**: Backend logs are viewable in Railway/Render dashboard.

---

## Production Hardening Checklist

- [ ] Use a strong `JWT_SECRET` (at least 32 random characters)
- [ ] Update `FRONTEND_ORIGIN` to your actual frontend domain
- [ ] Enable HTTPS on both services (automatic on Railway/Vercel/Render)
- [ ] Set up database backups for `fitfusion.sqlite`
- [ ] Monitor API rate limits and error logs
- [ ] For Fitbit OAuth, register OAuth app and add `FITBIT_CLIENT_ID`, `FITBIT_CLIENT_SECRET`, `FITBIT_REDIRECT_URI`
- [ ] For Apple Health, implement iOS HealthKit bridge in mobile client

---

## Quick Health Check

After deployment, test these endpoints from your frontend:

```bash
# Health check (no auth required)
curl https://fitfusion-backend.railway.app/api/health

# Register
curl -X POST https://fitfusion-backend.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","password":"TestPass123"}'

# Login
curl -X POST https://fitfusion-backend.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123"}'

# Use the token from login in your Authorization header for all other endpoints
```

---

## Next Steps

- Monitor user feedback and logs
- Scale database backups as user data grows
- Implement real Apple Health / Fitbit sync for production users
- Add analytics (Segment, Mixpanel, etc.)
- Set up error tracking (Sentry, LogRocket)
