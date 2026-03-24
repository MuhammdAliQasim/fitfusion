const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { FitFusionDb } = require('./db');
const {
    todayISO,
    addXp,
    generateWorkout,
    generateMealPlan,
    analyzeAndCoach,
    autoAdjustPlan,
    predictProgress,
    parseVoiceLog,
    ensureChallenges,
    updateChallengeProgress,
    getLeaderboard
} = require('./logic');

const app = express();
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

const db = new FitFusionDb();

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const upload = multer({ dest: UPLOAD_DIR });

app.use(helmet());
app.use(compression());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: false }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

function createToken(user) {
    return jwt.sign({ sub: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function authRequired(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        const user = db.getUserById(Number(payload.sub));
        if (!user) return res.status(401).json({ error: 'Invalid token user' });
        req.user = user;
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

function buildDashboardPayload(userId) {
    const state = db.getUserState(userId);
    state.gamification = ensureChallenges(state.gamification);

    const today = todayISO();
    const mealsToday = state.logs.meals.filter((m) => m.date === today);
    const waterToday = state.logs.water.filter((w) => w.date === today);
    const stepsToday = state.logs.steps.filter((s) => s.date === today);
    const sleepLast = state.logs.sleep.at(-1);
    const workoutToday = state.logs.workouts.filter((w) => w.date === today);
    const weightRecent = state.logs.weight.slice(-7);

    const caloriesConsumed = mealsToday.reduce((sum, m) => sum + Number(m.calories || 0), 0);
    const proteinConsumed = mealsToday.reduce((sum, m) => sum + Number(m.protein || 0), 0);
    const waterMl = waterToday.reduce((sum, w) => sum + Number(w.ml || 0), 0);
    const steps = stepsToday.reduce((sum, s) => sum + Number(s.count || 0), 0);

    return {
        profile: state.profile,
        targets: state.dailyTargets,
        summary: {
            caloriesLeft: state.dailyTargets.calories - caloriesConsumed,
            caloriesConsumed,
            proteinConsumed,
            steps,
            workoutTodayCount: workoutToday.length,
            sleepScore: sleepLast ? Math.min(100, Math.round((sleepLast.hours / state.dailyTargets.sleepHours) * 100)) : 0,
            waterMl,
            weeklyWeightTrend: weightRecent
        },
        gamification: state.gamification,
        challenges: state.gamification.challenges,
        leaderboard: getLeaderboard(state),
        integrations: {
            appleHealthConnected: state.integrations.appleHealthConnected,
            fitbitConnected: state.integrations.fitbitConnected
        },
        coach: analyzeAndCoach(state),
        prediction: predictProgress(state)
    };
}

function appendLogForUser(userId, type, payload) {
    const item = db.appendLog(userId, type, payload);
    const state = db.getUserState(userId);
    const updatedGamification = updateChallengeProgress(addXp(state.gamification, 20), type, payload);
    db.saveGamification(userId, updatedGamification);
    return item;
}

app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'fitfusion-backend', secure: true, database: 'sqlite' });
});

app.post('/api/auth/register', async (req, res) => {
    const { email, password, name } = req.body || {};
    if (!email || !password || !name) return res.status(400).json({ error: 'name, email, and password are required' });
    if (String(password).length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });

    const existing = db.getUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = db.createUser({ email, passwordHash, name });
    const token = createToken(user);
    res.status(201).json({ token, user });
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const user = db.getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const safeUser = db.getUserById(user.id);
    const token = createToken(safeUser);
    res.json({ token, user: safeUser });
});

app.get('/api/auth/me', authRequired, (req, res) => {
    res.json(req.user);
});

app.get('/api/dashboard', authRequired, (req, res) => {
    res.json(buildDashboardPayload(req.user.id));
});

app.post('/api/profile', authRequired, (req, res) => {
    const updated = db.updateProfile(req.user.id, req.body || {});
    res.json(updated);
});

app.post('/api/targets', authRequired, (req, res) => {
    const updated = db.updateTargets(req.user.id, req.body || {});
    res.json(updated);
});

app.post('/api/logs/meal', authRequired, (req, res) => {
    const item = appendLogForUser(req.user.id, 'meals', req.body || {});
    res.status(201).json(item);
});

app.post('/api/logs/workout', authRequired, (req, res) => {
    const item = appendLogForUser(req.user.id, 'workouts', req.body || {});
    res.status(201).json(item);
});

app.post('/api/logs/steps', authRequired, (req, res) => {
    const item = appendLogForUser(req.user.id, 'steps', req.body || {});
    res.status(201).json(item);
});

app.post('/api/logs/weight', authRequired, (req, res) => {
    const item = appendLogForUser(req.user.id, 'weight', req.body || {});
    res.status(201).json(item);
});

app.post('/api/logs/sleep', authRequired, (req, res) => {
    const item = appendLogForUser(req.user.id, 'sleep', req.body || {});
    res.status(201).json(item);
});

app.post('/api/logs/water', authRequired, (req, res) => {
    const item = appendLogForUser(req.user.id, 'water', req.body || {});
    res.status(201).json(item);
});

app.post('/api/logs/photo', authRequired, upload.single('photo'), (req, res) => {
    const item = appendLogForUser(req.user.id, 'photos', {
        date: req.body.date || todayISO(),
        note: req.body.note || '',
        url: req.file ? `/uploads/${req.file.filename}` : null
    });
    res.status(201).json(item);
});

app.get('/api/logs/:type', authRequired, (req, res) => {
    const map = {
        meal: 'meals',
        meals: 'meals',
        workout: 'workouts',
        workouts: 'workouts',
        steps: 'steps',
        weight: 'weight',
        sleep: 'sleep',
        water: 'water',
        photos: 'photos',
        voice: 'voice'
    };
    const type = map[req.params.type];
    if (!type) return res.status(404).json({ error: 'Log type not found' });
    res.json(db.getLogsByType(req.user.id, type));
});

app.post('/api/voice-log', authRequired, (req, res) => {
    const text = req.body.text || '';
    const parsed = parseVoiceLog(text);

    appendLogForUser(req.user.id, 'voice', { text, parsed });

    if (parsed.type === 'water') appendLogForUser(req.user.id, 'water', parsed.payload);
    if (parsed.type === 'meal') appendLogForUser(req.user.id, 'meals', parsed.payload);
    if (parsed.type === 'workout') appendLogForUser(req.user.id, 'workouts', parsed.payload);

    res.json({ text, parsed });
});

app.post('/api/workout-generator', authRequired, (req, res) => {
    const state = db.getUserState(req.user.id);
    const workouts7 = state.logs.workouts.filter((w) => new Date(w.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const suggestion = generateWorkout({
        mode: req.body.mode || 'home',
        quick: Boolean(req.body.quick),
        goal: state.profile.goal,
        missedWorkouts: Math.max(0, 4 - workouts7.length)
    });
    res.json(suggestion);
});

app.post('/api/meal-builder', authRequired, (req, res) => {
    const state = db.getUserState(req.user.id);
    const plan = generateMealPlan({
        preference: req.body.preference || 'high_protein',
        calories: state.dailyTargets.calories,
        protein: state.dailyTargets.protein
    });
    res.json(plan);
});

app.get('/api/ai/coach', authRequired, (req, res) => {
    const state = db.getUserState(req.user.id);
    res.json(analyzeAndCoach(state));
});

app.post('/api/ai/adjust-plan', authRequired, (req, res) => {
    const state = db.getUserState(req.user.id);
    const adjustment = autoAdjustPlan(state);
    db.updateTargets(req.user.id, adjustment.updatedTargets);
    res.json(adjustment);
});

app.get('/api/ai/prediction', authRequired, (req, res) => {
    const state = db.getUserState(req.user.id);
    res.json(predictProgress(state));
});

app.get('/api/gamification/challenges', authRequired, (req, res) => {
    const state = db.getUserState(req.user.id);
    res.json(ensureChallenges(state.gamification).challenges);
});

app.post('/api/gamification/challenges/:id/join', authRequired, (req, res) => {
    const challenge = db.joinChallenge(req.user.id, req.params.id);
    if (!challenge) return res.status(404).json({ error: 'Challenge not found' });
    res.json({ ...challenge, completed: Boolean(challenge.completed), joined: Boolean(challenge.joined) });
});

app.get('/api/gamification/leaderboard', authRequired, (req, res) => {
    const state = db.getUserState(req.user.id);
    res.json(getLeaderboard(state));
});

app.post('/api/integrations/apple-health/connect', authRequired, (req, res) => {
    const integrations = db.updateIntegrations(req.user.id, { appleHealthConnected: true });
    res.json({ appleHealthConnected: integrations.appleHealthConnected, fitbitConnected: integrations.fitbitConnected });
});

app.get('/api/integrations/apple-health/oauth/start', authRequired, (req, res) => {
    const integrations = db.updateIntegrations(req.user.id, { appleHealthConnected: true });
    res.json({
        mode: 'healthkit-device',
        message: 'Apple Health sync is performed on iOS via HealthKit permission and device bridge; local demo marks account as connected.',
        integrations: {
            appleHealthConnected: integrations.appleHealthConnected,
            fitbitConnected: integrations.fitbitConnected
        }
    });
});

app.get('/api/integrations/fitbit/oauth/start', authRequired, (req, res) => {
    const clientId = process.env.FITBIT_CLIENT_ID;
    const redirectUri = process.env.FITBIT_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        const integrations = db.updateIntegrations(req.user.id, { fitbitConnected: true });
        return res.json({
            mode: 'demo',
            message: 'Fitbit OAuth env vars are missing; demo mode connected this account locally.',
            integrations: {
                appleHealthConnected: integrations.appleHealthConnected,
                fitbitConnected: integrations.fitbitConnected
            }
        });
    }

    const state = db.createOAuthState(req.user.id, 'fitbit');
    const scope = encodeURIComponent('activity heartrate location nutrition profile settings sleep social weight');
    const authUrl = `https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${encodeURIComponent(state)}`;

    res.json({ mode: 'oauth', authorizationUrl: authUrl });
});

app.get('/api/integrations/fitbit/oauth/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).send('Missing code/state');

    const stateRow = db.consumeOAuthState(String(state), 'fitbit');
    if (!stateRow) return res.status(400).send('Invalid OAuth state');

    const clientId = process.env.FITBIT_CLIENT_ID;
    const clientSecret = process.env.FITBIT_CLIENT_SECRET;
    const redirectUri = process.env.FITBIT_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
        db.updateIntegrations(Number(stateRow.userId), { fitbitConnected: true });
        return res.send('Fitbit connected in local demo mode (missing OAuth env).');
    }

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenResponse = await fetch('https://api.fitbit.com/oauth2/token', {
        method: 'POST',
        headers: {
            Authorization: `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            code: String(code),
            grant_type: 'authorization_code',
            redirect_uri: redirectUri
        })
    });

    if (!tokenResponse.ok) {
        const details = await tokenResponse.text();
        return res.status(400).send(`Fitbit token exchange failed: ${details}`);
    }

    const tokens = await tokenResponse.json();
    db.updateIntegrations(Number(stateRow.userId), {
        fitbitConnected: true,
        fitbitAccessToken: tokens.access_token,
        fitbitRefreshToken: tokens.refresh_token,
        fitbitTokenExpiresAt: new Date(Date.now() + Number(tokens.expires_in || 0) * 1000).toISOString(),
        fitbitScope: tokens.scope
    });

    res.send('Fitbit connected successfully. You can return to FitFusion.');
});

app.post('/api/integrations/:provider/connect', authRequired, (req, res) => {
    const provider = req.params.provider;
    if (provider === 'apple-health') {
        const integrations = db.updateIntegrations(req.user.id, { appleHealthConnected: true });
        return res.json({ appleHealthConnected: integrations.appleHealthConnected, fitbitConnected: integrations.fitbitConnected });
    }
    if (provider === 'fitbit') {
        const integrations = db.updateIntegrations(req.user.id, { fitbitConnected: true });
        return res.json({ appleHealthConnected: integrations.appleHealthConnected, fitbitConnected: integrations.fitbitConnected });
    }
    return res.status(404).json({ error: 'Provider not supported' });
});

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`FitFusion backend listening on http://localhost:${PORT}`);
});
