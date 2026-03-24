# FitFusion

FitFusion is an all-in-one health and fitness platform with a full frontend + backend implementation.

This version is production-hardened with:

- JWT authentication (register/login/me)
- User-scoped data isolation
- SQLite persistent database
- Security middleware (`helmet`, rate limit, compression)
- OAuth-ready Fitbit integration flow + Apple Health device-bridge entrypoint

## What is included

- Workout tracker (gym + home + travel + no-equipment)
- Calorie + protein tracker
- Step tracker
- Weight tracker
- Sleep tracker
- Water tracker
- Progress photos upload + gallery
- Apple Health / Fitbit integration endpoints (OAuth-ready Fitbit, HealthKit bridge-ready Apple)
- AI personal coach recommendations
- Automatic plan adjustment engine
- All-in-one dashboard
- Smart meal builder + grocery list (budget/high-protein/weight-loss/muscle-gain/vegetarian/halal)
- Progress prediction engine
- Voice logging parser
- Gamification (XP, levels, streaks, badges, weekly challenges, leaderboard)

## Project structure

- `backend/` Express API server with SQLite datastore + auth/security middleware
- `frontend/` React + Vite app for dashboard and all user workflows

## Run locally

### 1) Backend

```powershell
Set-Location "c:\Users\maliq\OneDrive\Documents\fitfusion\backend"
Copy-Item ".env.example" ".env" -ErrorAction SilentlyContinue
npm install
npm start
```

Backend runs on `http://localhost:4000`.

### 2) Frontend

```powershell
Set-Location "c:\Users\maliq\OneDrive\Documents\fitfusion\frontend"
Copy-Item ".env.example" ".env" -ErrorAction SilentlyContinue
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

## Authentication

- Register or login from the frontend auth screen.
- Seeded local demo account:
	- Email: `demo@fitfusion.app`
	- Password: `demo1234`

Auth APIs:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

## Backend API highlights

- `GET /api/dashboard` – unified dashboard payload
- `POST /api/logs/meal`
- `POST /api/logs/workout`
- `POST /api/logs/steps`
- `POST /api/logs/weight`
- `POST /api/logs/sleep`
- `POST /api/logs/water`
- `POST /api/logs/photo` (multipart upload)
- `POST /api/voice-log`
- `POST /api/workout-generator`
- `POST /api/meal-builder`
- `GET /api/ai/coach`
- `POST /api/ai/adjust-plan`
- `GET /api/ai/prediction`
- `GET /api/gamification/challenges`
- `POST /api/gamification/challenges/:id/join`
- `GET /api/gamification/leaderboard`
- `GET /api/integrations/apple-health/oauth/start`
- `POST /api/integrations/apple-health/connect`
- `GET /api/integrations/fitbit/oauth/start`
- `GET /api/integrations/fitbit/oauth/callback`
- `POST /api/integrations/fitbit/connect`

All APIs except `/api/health` and `/api/auth/*` require `Authorization: Bearer <token>`.

## Fitbit OAuth setup (optional for real sync)

Set these in `backend/.env`:

- `FITBIT_CLIENT_ID`
- `FITBIT_CLIENT_SECRET`
- `FITBIT_REDIRECT_URI` (default callback path is already in `.env.example`)

Without Fitbit OAuth env vars, backend falls back to local demo-connect mode.

## Production notes

- Use a strong `JWT_SECRET` in production.
- Restrict `FRONTEND_ORIGIN` to your deployed frontend domain.
- Persist `backend/data/fitfusion.sqlite` on durable storage.
- For Apple Health, implement iOS HealthKit bridge in your mobile client and post synced metrics to backend.

## Tests

Backend unit tests cover core AI and generation logic.

```powershell
Set-Location "c:\Users\maliq\OneDrive\Documents\fitfusion\backend"
npm test
```

## Notes

- Data persists in `backend/data/fitfusion.sqlite`.
- Uploads are stored in `backend/uploads/`.
- `backend/data/db.json` is kept as legacy seed source for first-run demo migration.
