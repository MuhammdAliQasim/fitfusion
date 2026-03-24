const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const Database = require('better-sqlite3');

const DB_FILE = path.join(__dirname, '..', 'data', 'fitfusion.sqlite');
const LEGACY_JSON_PATH = path.join(__dirname, '..', 'data', 'db.json');

const DEFAULT_PROFILE = {
    name: 'New User',
    goal: 'fat_loss',
    startWeightKg: 82,
    targetWeightKg: 75,
    heightCm: 178,
    activityLevel: 'moderate'
};

const DEFAULT_TARGETS = {
    calories: 2200,
    protein: 160,
    steps: 10000,
    waterMl: 3000,
    sleepHours: 8,
    workoutMinutes: 45
};

const DEFAULT_GAMIFICATION = {
    xp: 0,
    level: 1,
    badges: [],
    streak: 0,
    lastActiveDate: null
};

function defaultChallenges() {
    return [
        {
            challengeId: 'hydration_hustle',
            title: 'Hydration Hustle',
            metric: 'waterMl',
            target: 7000,
            rewardXp: 120,
            period: 'weekly',
            progress: 0,
            completed: false,
            joined: true
        },
        {
            challengeId: 'step_storm',
            title: 'Step Storm',
            metric: 'steps',
            target: 70000,
            rewardXp: 180,
            period: 'weekly',
            progress: 0,
            completed: false,
            joined: true
        },
        {
            challengeId: 'protein_lock',
            title: 'Protein Lock',
            metric: 'protein',
            target: 1000,
            rewardXp: 140,
            period: 'weekly',
            progress: 0,
            completed: false,
            joined: false
        }
    ];
}

function parseJsonValue(value, fallback) {
    try {
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
}

class FitFusionDb {
    constructor() {
        this.db = new Database(DB_FILE);
        this.db.pragma('journal_mode = WAL');
        this.initialize();
    }

    initialize() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS profiles (
                user_id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                goal TEXT NOT NULL,
                start_weight_kg REAL NOT NULL,
                target_weight_kg REAL NOT NULL,
                height_cm REAL NOT NULL,
                activity_level TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS targets (
                user_id INTEGER PRIMARY KEY,
                calories INTEGER NOT NULL,
                protein INTEGER NOT NULL,
                steps INTEGER NOT NULL,
                water_ml INTEGER NOT NULL,
                sleep_hours REAL NOT NULL,
                workout_minutes INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS logs (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                date TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_logs_user_type_date ON logs(user_id, type, date);

            CREATE TABLE IF NOT EXISTS gamification (
                user_id INTEGER PRIMARY KEY,
                xp INTEGER NOT NULL,
                level INTEGER NOT NULL,
                badges_json TEXT NOT NULL,
                streak INTEGER NOT NULL,
                last_active_date TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS challenges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                challenge_id TEXT NOT NULL,
                title TEXT NOT NULL,
                metric TEXT NOT NULL,
                target INTEGER NOT NULL,
                reward_xp INTEGER NOT NULL,
                period TEXT NOT NULL,
                progress INTEGER NOT NULL,
                completed INTEGER NOT NULL,
                joined INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                UNIQUE(user_id, challenge_id)
            );

            CREATE TABLE IF NOT EXISTS integrations (
                user_id INTEGER PRIMARY KEY,
                apple_health_connected INTEGER NOT NULL DEFAULT 0,
                fitbit_connected INTEGER NOT NULL DEFAULT 0,
                fitbit_access_token TEXT,
                fitbit_refresh_token TEXT,
                fitbit_token_expires_at TEXT,
                fitbit_scope TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS oauth_states (
                state TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                provider TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        `);

        this.seedDemoUserFromLegacyJson();
    }

    seedDemoUserFromLegacyJson() {
        const usersCount = this.db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
        if (usersCount > 0) return;

        let legacy = null;
        if (fs.existsSync(LEGACY_JSON_PATH)) {
            legacy = parseJsonValue(fs.readFileSync(LEGACY_JSON_PATH, 'utf8'), null);
        }

        const user = this.createUser({
            email: process.env.DEMO_EMAIL || 'demo@fitfusion.app',
            passwordHash: process.env.DEMO_PASSWORD_HASH || '$2b$12$yGywE6kQf5W0xQQ8Q8X5heNLU85Mt2rtI8BGG99nmCaTKtyfO3O5G',
            name: legacy?.profile?.name || 'Alex'
        });

        if (!legacy) return;

        this.updateProfile(user.id, {
            name: legacy.profile?.name || DEFAULT_PROFILE.name,
            goal: legacy.profile?.goal || DEFAULT_PROFILE.goal,
            startWeightKg: Number(legacy.profile?.startWeightKg ?? DEFAULT_PROFILE.startWeightKg),
            targetWeightKg: Number(legacy.profile?.targetWeightKg ?? DEFAULT_PROFILE.targetWeightKg),
            heightCm: Number(legacy.profile?.heightCm ?? DEFAULT_PROFILE.heightCm),
            activityLevel: legacy.profile?.activityLevel || DEFAULT_PROFILE.activityLevel
        });

        this.updateTargets(user.id, {
            calories: Number(legacy.dailyTargets?.calories ?? DEFAULT_TARGETS.calories),
            protein: Number(legacy.dailyTargets?.protein ?? DEFAULT_TARGETS.protein),
            steps: Number(legacy.dailyTargets?.steps ?? DEFAULT_TARGETS.steps),
            waterMl: Number(legacy.dailyTargets?.waterMl ?? DEFAULT_TARGETS.waterMl),
            sleepHours: Number(legacy.dailyTargets?.sleepHours ?? DEFAULT_TARGETS.sleepHours),
            workoutMinutes: Number(legacy.dailyTargets?.workoutMinutes ?? DEFAULT_TARGETS.workoutMinutes)
        });

        const allLogs = legacy.logs || {};
        for (const [type, items] of Object.entries(allLogs)) {
            if (!Array.isArray(items)) continue;
            for (const item of items) {
                const { id, date, ...payload } = item;
                this.appendLog(user.id, type, {
                    id: id || randomUUID(),
                    date,
                    ...payload
                });
            }
        }

        if (legacy.gamification) {
            this.saveGamification(user.id, {
                xp: Number(legacy.gamification.xp ?? DEFAULT_GAMIFICATION.xp),
                level: Number(legacy.gamification.level ?? DEFAULT_GAMIFICATION.level),
                badges: Array.isArray(legacy.gamification.badges) ? legacy.gamification.badges : [],
                streak: Number(legacy.gamification.streak ?? DEFAULT_GAMIFICATION.streak),
                lastActiveDate: legacy.gamification.lastActiveDate || null,
                challenges: Array.isArray(legacy.gamification.challenges)
                    ? legacy.gamification.challenges.map((item) => ({
                        id: item.id,
                        title: item.title,
                        metric: item.metric,
                        target: Number(item.target),
                        rewardXp: Number(item.rewardXp),
                        period: item.period || 'weekly',
                        progress: Number(item.progress || 0),
                        completed: Boolean(item.completed),
                        joined: Boolean(item.joined)
                    }))
                    : defaultChallenges().map((item) => ({
                        id: item.challengeId,
                        title: item.title,
                        metric: item.metric,
                        target: item.target,
                        rewardXp: item.rewardXp,
                        period: item.period,
                        progress: item.progress,
                        completed: item.completed,
                        joined: item.joined
                    }))
            });
        }

        if (legacy.integrations) {
            this.updateIntegrations(user.id, {
                appleHealthConnected: Boolean(legacy.integrations.appleHealthConnected),
                fitbitConnected: Boolean(legacy.integrations.fitbitConnected)
            });
        }
    }

    createUser({ email, passwordHash, name }) {
        const now = new Date().toISOString();
        const transaction = this.db.transaction(() => {
            const userResult = this.db
                .prepare('INSERT INTO users (email, password_hash, name, created_at) VALUES (?, ?, ?, ?)')
                .run(email.toLowerCase(), passwordHash, name, now);
            const userId = userResult.lastInsertRowid;

            this.db
                .prepare('INSERT INTO profiles (user_id, name, goal, start_weight_kg, target_weight_kg, height_cm, activity_level) VALUES (?, ?, ?, ?, ?, ?, ?)')
                .run(userId, name, DEFAULT_PROFILE.goal, DEFAULT_PROFILE.startWeightKg, DEFAULT_PROFILE.targetWeightKg, DEFAULT_PROFILE.heightCm, DEFAULT_PROFILE.activityLevel);

            this.db
                .prepare('INSERT INTO targets (user_id, calories, protein, steps, water_ml, sleep_hours, workout_minutes) VALUES (?, ?, ?, ?, ?, ?, ?)')
                .run(userId, DEFAULT_TARGETS.calories, DEFAULT_TARGETS.protein, DEFAULT_TARGETS.steps, DEFAULT_TARGETS.waterMl, DEFAULT_TARGETS.sleepHours, DEFAULT_TARGETS.workoutMinutes);

            this.db
                .prepare('INSERT INTO gamification (user_id, xp, level, badges_json, streak, last_active_date) VALUES (?, ?, ?, ?, ?, ?)')
                .run(userId, DEFAULT_GAMIFICATION.xp, DEFAULT_GAMIFICATION.level, JSON.stringify(DEFAULT_GAMIFICATION.badges), DEFAULT_GAMIFICATION.streak, DEFAULT_GAMIFICATION.lastActiveDate);

            for (const challenge of defaultChallenges()) {
                this.db
                    .prepare('INSERT INTO challenges (user_id, challenge_id, title, metric, target, reward_xp, period, progress, completed, joined) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
                    .run(userId, challenge.challengeId, challenge.title, challenge.metric, challenge.target, challenge.rewardXp, challenge.period, challenge.progress, challenge.completed ? 1 : 0, challenge.joined ? 1 : 0);
            }

            this.db.prepare('INSERT INTO integrations (user_id, apple_health_connected, fitbit_connected) VALUES (?, 0, 0)').run(userId);

            return Number(userId);
        });

        const userId = transaction();
        return this.getUserById(userId);
    }

    getUserByEmail(email) {
        const row = this.db
            .prepare('SELECT id, email, password_hash AS passwordHash, name, created_at AS createdAt FROM users WHERE email = ?')
            .get(String(email || '').toLowerCase());
        return row || null;
    }

    getUserById(userId) {
        const row = this.db
            .prepare('SELECT id, email, name, created_at AS createdAt FROM users WHERE id = ?')
            .get(userId);
        return row || null;
    }

    updateProfile(userId, patch) {
        const current = this.getProfile(userId);
        const next = { ...current, ...patch };
        this.db
            .prepare('UPDATE profiles SET name = ?, goal = ?, start_weight_kg = ?, target_weight_kg = ?, height_cm = ?, activity_level = ? WHERE user_id = ?')
            .run(next.name, next.goal, Number(next.startWeightKg), Number(next.targetWeightKg), Number(next.heightCm), next.activityLevel, userId);
        this.db.prepare('UPDATE users SET name = ? WHERE id = ?').run(next.name, userId);
        return this.getProfile(userId);
    }

    updateTargets(userId, patch) {
        const current = this.getTargets(userId);
        const next = { ...current, ...patch };
        this.db
            .prepare('UPDATE targets SET calories = ?, protein = ?, steps = ?, water_ml = ?, sleep_hours = ?, workout_minutes = ? WHERE user_id = ?')
            .run(Number(next.calories), Number(next.protein), Number(next.steps), Number(next.waterMl), Number(next.sleepHours), Number(next.workoutMinutes), userId);
        return this.getTargets(userId);
    }

    getProfile(userId) {
        const row = this.db
            .prepare('SELECT name, goal, start_weight_kg AS startWeightKg, target_weight_kg AS targetWeightKg, height_cm AS heightCm, activity_level AS activityLevel FROM profiles WHERE user_id = ?')
            .get(userId);
        return row || { ...DEFAULT_PROFILE };
    }

    getTargets(userId) {
        const row = this.db
            .prepare('SELECT calories, protein, steps, water_ml AS waterMl, sleep_hours AS sleepHours, workout_minutes AS workoutMinutes FROM targets WHERE user_id = ?')
            .get(userId);
        return row || { ...DEFAULT_TARGETS };
    }

    getLogsByType(userId, type) {
        const rows = this.db
            .prepare('SELECT id, date, payload_json AS payloadJson FROM logs WHERE user_id = ? AND type = ? ORDER BY date ASC, created_at ASC')
            .all(userId, type);
        return rows.map((row) => ({ id: row.id, date: row.date, ...parseJsonValue(row.payloadJson, {}) }));
    }

    appendLog(userId, type, payload) {
        const date = payload.date || new Date().toISOString().slice(0, 10);
        const now = new Date().toISOString();
        const id = payload.id || randomUUID();
        const cleanPayload = { ...payload };
        delete cleanPayload.id;
        delete cleanPayload.date;

        this.db
            .prepare('INSERT INTO logs (id, user_id, type, date, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            .run(id, userId, type, date, JSON.stringify(cleanPayload), now);

        return { id, date, ...cleanPayload };
    }

    getGamification(userId) {
        const row = this.db
            .prepare('SELECT xp, level, badges_json AS badgesJson, streak, last_active_date AS lastActiveDate FROM gamification WHERE user_id = ?')
            .get(userId);

        const challenges = this.db
            .prepare('SELECT challenge_id AS id, title, metric, target, reward_xp AS rewardXp, period, progress, completed, joined FROM challenges WHERE user_id = ? ORDER BY id ASC')
            .all(userId)
            .map((item) => ({
                ...item,
                completed: Boolean(item.completed),
                joined: Boolean(item.joined)
            }));

        if (!row) {
            return {
                ...DEFAULT_GAMIFICATION,
                challenges: defaultChallenges().map((item) => ({
                    id: item.challengeId,
                    title: item.title,
                    metric: item.metric,
                    target: item.target,
                    rewardXp: item.rewardXp,
                    period: item.period,
                    progress: item.progress,
                    completed: item.completed,
                    joined: item.joined
                }))
            };
        }

        return {
            xp: Number(row.xp),
            level: Number(row.level),
            badges: parseJsonValue(row.badgesJson, []),
            streak: Number(row.streak),
            lastActiveDate: row.lastActiveDate,
            challenges
        };
    }

    saveGamification(userId, gamification) {
        const transaction = this.db.transaction(() => {
            this.db
                .prepare('UPDATE gamification SET xp = ?, level = ?, badges_json = ?, streak = ?, last_active_date = ? WHERE user_id = ?')
                .run(
                    Number(gamification.xp),
                    Number(gamification.level),
                    JSON.stringify(Array.isArray(gamification.badges) ? gamification.badges : []),
                    Number(gamification.streak),
                    gamification.lastActiveDate || null,
                    userId
                );

            this.db.prepare('DELETE FROM challenges WHERE user_id = ?').run(userId);
            for (const challenge of gamification.challenges || []) {
                this.db
                    .prepare('INSERT INTO challenges (user_id, challenge_id, title, metric, target, reward_xp, period, progress, completed, joined) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
                    .run(
                        userId,
                        challenge.id,
                        challenge.title,
                        challenge.metric,
                        Number(challenge.target),
                        Number(challenge.rewardXp),
                        challenge.period || 'weekly',
                        Number(challenge.progress || 0),
                        challenge.completed ? 1 : 0,
                        challenge.joined ? 1 : 0
                    );
            }
        });

        transaction();
        return this.getGamification(userId);
    }

    joinChallenge(userId, challengeId) {
        this.db.prepare('UPDATE challenges SET joined = 1 WHERE user_id = ? AND challenge_id = ?').run(userId, challengeId);
        return this.db
            .prepare('SELECT challenge_id AS id, title, metric, target, reward_xp AS rewardXp, period, progress, completed, joined FROM challenges WHERE user_id = ? AND challenge_id = ?')
            .get(userId, challengeId);
    }

    getIntegrations(userId) {
        const row = this.db
            .prepare('SELECT apple_health_connected AS appleHealthConnected, fitbit_connected AS fitbitConnected, fitbit_access_token AS fitbitAccessToken, fitbit_refresh_token AS fitbitRefreshToken, fitbit_token_expires_at AS fitbitTokenExpiresAt, fitbit_scope AS fitbitScope FROM integrations WHERE user_id = ?')
            .get(userId);

        if (!row) {
            return {
                appleHealthConnected: false,
                fitbitConnected: false,
                fitbitAccessToken: null,
                fitbitRefreshToken: null,
                fitbitTokenExpiresAt: null,
                fitbitScope: null
            };
        }

        return {
            ...row,
            appleHealthConnected: Boolean(row.appleHealthConnected),
            fitbitConnected: Boolean(row.fitbitConnected)
        };
    }

    updateIntegrations(userId, patch) {
        const current = this.getIntegrations(userId);
        const next = { ...current, ...patch };
        this.db
            .prepare('UPDATE integrations SET apple_health_connected = ?, fitbit_connected = ?, fitbit_access_token = ?, fitbit_refresh_token = ?, fitbit_token_expires_at = ?, fitbit_scope = ? WHERE user_id = ?')
            .run(
                next.appleHealthConnected ? 1 : 0,
                next.fitbitConnected ? 1 : 0,
                next.fitbitAccessToken || null,
                next.fitbitRefreshToken || null,
                next.fitbitTokenExpiresAt || null,
                next.fitbitScope || null,
                userId
            );
        return this.getIntegrations(userId);
    }

    createOAuthState(userId, provider) {
        const state = randomUUID();
        this.db.prepare('INSERT INTO oauth_states (state, user_id, provider, created_at) VALUES (?, ?, ?, ?)').run(state, userId, provider, new Date().toISOString());
        return state;
    }

    consumeOAuthState(state, provider) {
        const row = this.db.prepare('SELECT state, user_id AS userId, provider FROM oauth_states WHERE state = ?').get(state);
        if (!row || row.provider !== provider) return null;
        this.db.prepare('DELETE FROM oauth_states WHERE state = ?').run(state);
        return row;
    }

    getUserState(userId) {
        return {
            profile: this.getProfile(userId),
            dailyTargets: this.getTargets(userId),
            logs: {
                meals: this.getLogsByType(userId, 'meals'),
                workouts: this.getLogsByType(userId, 'workouts'),
                steps: this.getLogsByType(userId, 'steps'),
                weight: this.getLogsByType(userId, 'weight'),
                sleep: this.getLogsByType(userId, 'sleep'),
                water: this.getLogsByType(userId, 'water'),
                photos: this.getLogsByType(userId, 'photos'),
                voice: this.getLogsByType(userId, 'voice')
            },
            gamification: this.getGamification(userId),
            integrations: this.getIntegrations(userId)
        };
    }
}

module.exports = {
    FitFusionDb,
    DEFAULT_PROFILE,
    DEFAULT_TARGETS
};
