# FitFusion Deployment — Step-by-Step Walkthrough

## STEP 1: Create GitHub Repository (2 min)

1. Go to https://github.com/new
2. **Repository name**: `fitfusion`
3. **Description**: "All-in-one AI fitness platform"
4. **Visibility**: Public (so you can share the URL)
5. Click **Create repository**
6. Copy the **HTTPS URL** (looks like: `https://github.com/YOUR_USERNAME/fitfusion.git`)

---

## STEP 2: Push Your Code to GitHub (3 min)

Open **PowerShell** and run these commands one by one:

```powershell
# Navigate to your project
cd "c:\Users\maliq\OneDrive\Documents\fitfusion"

# Initialize git (one-time)
git init

# Configure git with your info
git config user.email "your.email@gmail.com"
git config user.name "Your Name"

# Stage all files
git add .

# Create first commit
git commit -m "FitFusion: production-ready fitness app"

# Add GitHub as remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/fitfusion.git

# Rename branch to main
git branch -M main

# Push to GitHub
git push -u origin main
```

**✓ Your code is now on GitHub!**

---

## STEP 3: Deploy Backend to Railway (3 min)

1. **Go to https://railway.app**

2. **Sign up**: Click "Start with GitHub" (easiest)
   - Authorize Railway to access your GitHub
   - Connect your account

3. **Create New Project**:
   - Click **New Project** button
   - Select **Deploy from GitHub**
   - Find and select your `fitfusion` repo
   - Click **Deploy**

4. **Configure Backend**:
   - Railway detects Node.js project
   - Click **Settings** (gear icon)
   - Under **Root Directory**, enter: `backend`
   - Save

5. **Add Environment Variables**:
   - In Railway dashboard, go to **Variables**
   - Click **Add Variable** and enter each:
   
   | Name | Value |
   |------|-------|
   | `PORT` | `4000` |
   | `JWT_SECRET` | `your_secure_random_string_here_minimum_32_characters_abc123xyz` |
   | `JWT_EXPIRY` | `7d` |
   | `FRONTEND_ORIGIN` | `https://fitfusion.vercel.app` |
   | `DEMO_EMAIL` | `demo@fitfusion.app` |

6. **Deploy**:
   - Railway builds automatically (takes ~2-3 min)
   - Wait for green checkmark ✓
   - Click on your project → look for **Domain**
   - Copy the URL (e.g., `https://fitfusion-api.railway.app`)
   - **SAVE THIS URL** — you need it for the frontend!

**✓ Backend is live!**

---

## STEP 4: Deploy Frontend to Vercel (3 min)

1. **Go to https://vercel.com/dashboard**

2. **Sign up**: Click "Continue with GitHub"
   - Authorize Vercel
   - Connect GitHub account

3. **Create New Project**:
   - Click **Add New...** → **Project**
   - Find and select your `fitfusion` repo
   - Click **Import**

4. **Configure Frontend**:
   - **Framework Preset**: Select `Vite`
   - **Root Directory**: Enter `frontend`
   - Click **Deploy**

5. **Add Environment Variable** BEFORE deploying:
   - Go to **Settings** → **Environment Variables**
   - Add variable:
     - **Name**: `VITE_API_BASE`
     - **Value**: Paste your **Railway backend URL** from STEP 3 (e.g., `https://fitfusion-api.railway.app/api`)
   - Click **Save**

6. **Deploy**:
   - Click **Deploy** button
   - Wait for build to complete (~2 min)
   - You'll see: `Congratulations! Your site is ready`
   - Click the **Production URL** (e.g., `https://fitfusion.vercel.app`)

**✓ Frontend is live!**

---

## STEP 5: Test Your Live App (2 min)

1. **Open your Vercel URL** in browser
   - You see the FitFusion login screen

2. **Sign up**:
   - Click **Create Your Account**
   - Name: `Your Name`
   - Email: `you@example.com`
   - Password: `YourPassword123` (min 8 chars)
   - Click **Create Account**

3. **OR use the demo account**:
   - Email: `demo@fitfusion.app`
   - Password: `demo1234`
   - Click **Sign In**

4. **You're in!** You should see the dashboard with:
   - Calories Left
   - Protein
   - Steps
   - Workout Today
   - Sleep Score
   - Water
   - XP / Level
   - Integrations

5. **Try these actions**:
   - **Log a meal**: Enter meal name, calories, protein → Click **Log Meal**
   - **Generate a workout**: Click **Gym** → See exercises
   - **Build a meal plan**: Click **high_protein** → See meals + grocery list
   - **Check AI Coach**: Scroll down to see advice
   - **Join challenges**: Click **Join Challenge** → Earn XP
   - **View leaderboard**: See your rank

---

## STEP 6: Share Your Live App (1 min)

Your **Vercel URL** is your live app:
- Example: `https://fitfusion.vercel.app`

**Share this link with:**
- Friends to test
- Investors/stakeholders
- Social media
- Portfolio

---

## Troubleshooting

### "Frontend can't connect to backend"
- **Fix**: In Vercel dashboard, check `VITE_API_BASE` env var
- Make sure it matches your Railway URL + `/api` at the end
- Redeploy frontend after fixing

### "Login fails / says 'Invalid credentials'"
- **Fix**: The demo account was seeded in Railway
- Use: `demo@fitfusion.app` / `demo1234`
- Or create a new account

### "Photos won't upload"
- **Fix**: Make sure Railway backend is running
- Check Railway dashboard for errors (red logs)

### "Leaderboard shows 0 entries"
- **Normal**: Leaderboard auto-populates as users log data
- Log some data → refresh → leaderboard updates

---

## What Each Button Does

| Feature | Action |
|---------|--------|
| **Log Meal** | Track food, calories, protein |
| **Log Workout** | Record exercise session |
| **Log Steps** | Track daily steps |
| **Log Weight** | Record weight for predictions |
| **Log Sleep** | Track sleep hours |
| **Log Water** | Track water intake |
| **Upload Photo** | Add progress photos to gallery |
| **Gym/Home/Travel** | Generate workout for that mode |
| **15-Min Quick** | Generate short workout |
| **Budget/High Protein** | Generate meal plan by preference |
| **Submit Voice Log** | Simulate voice input (e.g., "I drank 1L water") |
| **Auto Adjust Plan** | AI updates your targets based on performance |
| **Connect Apple Health** | Toggle Apple Health (demo mode) |
| **Connect Fitbit** | Toggle Fitbit (demo mode) |
| **Join Challenge** | Participate in weekly goal |

---

## Demo Data (If Using Demo Account)

The demo account (`demo@fitfusion.app` / `demo1234`) comes pre-loaded with:
- **3 days of sample logs**: meals, workouts, weight, sleep, water
- **AI coach recommendations**: based on real patterns
- **Challenge progress**: 5900/7000ml hydration, 27,300/70,000 steps
- **Leaderboard**: Shows your rank vs demo users (Lena, Omar, Zoya)

---

## What Happens After Deployment

✅ **Your app is live 24/7**
✅ **Anyone can visit your Vercel URL anytime**
✅ **New users can sign up and test**
✅ **Each user's data is secure and isolated**
✅ **Database persists on Railway**
✅ **Automatic backups on Railway**

---

## Next Steps (Optional)

If you want to enhance further:

1. **Set up real Fitbit OAuth**:
   - Register app at https://fitbit.com/oauth2/simple
   - Add `FITBIT_CLIENT_ID`, `FITBIT_CLIENT_SECRET` to Railway env vars

2. **Add error tracking**:
   - Sign up at https://sentry.io
   - Add Sentry token to frontend

3. **Monitor performance**:
   - Railway dashboard shows API metrics
   - Vercel dashboard shows frontend analytics

4. **Enable custom domain**:
   - Vercel: Settings → Domains → Add custom domain
   - Railway: Not needed; Vercel handles frontend

---

## That's It! 🎉

Your FitFusion app is now live and testable.

**Share your Vercel URL** with the world and get feedback!

Questions? Check:
- Railway logs: https://railway.app (click your project → Logs)
- Vercel logs: https://vercel.com/dashboard (click your project → Deployments → View Build Logs)
