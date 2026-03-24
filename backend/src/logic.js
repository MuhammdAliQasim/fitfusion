const DAY_MS = 24 * 60 * 60 * 1000;

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

function average(values) {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getLastNDays(entries, n, dateKey = 'date') {
    const end = new Date();
    const start = new Date(end.getTime() - (n - 1) * DAY_MS);
    return entries.filter((entry) => {
        const value = entry[dateKey] || todayISO();
        const date = new Date(value);
        return date >= start && date <= end;
    });
}

function calculateLevel(xp) {
    return Math.max(1, Math.floor(Math.sqrt(xp / 100)) + 1);
}

function addXp(gamification, points) {
    const today = todayISO();
    const next = { ...gamification };
    next.xp += points;
    next.level = calculateLevel(next.xp);

    if (next.lastActiveDate !== today) {
        if (next.lastActiveDate) {
            const diff = Math.round((new Date(today) - new Date(next.lastActiveDate)) / DAY_MS);
            next.streak = diff === 1 ? next.streak + 1 : 1;
        } else {
            next.streak = 1;
        }
        next.lastActiveDate = today;
    }

    if (next.streak >= 7 && !next.badges.includes('7-Day Streak')) {
        next.badges.push('7-Day Streak');
    }
    if (next.level >= 5 && !next.badges.includes('Level 5')) {
        next.badges.push('Level 5');
    }

    return next;
}

function generateWorkout({ mode, quick, goal, missedWorkouts }) {
    const baseMinutes = quick ? 15 : 45;
    const adjustedMinutes = missedWorkouts >= 2 ? Math.max(20, baseMinutes - 10) : baseMinutes;

    const templates = {
        gym: ['Squat 4x6', 'Bench Press 4x8', 'Row 4x10', 'Plank 3x45s'],
        home: ['Push-ups 4x12', 'Split Squat 4x10', 'Band Row 4x12', 'Dead Bug 3x12'],
        travel: ['Hotel Circuit x5', 'Incline Push-ups 4x15', 'Air Squats 4x20', 'Walking Lunges 3x16'],
        no_equipment: ['Burpees 4x10', 'Bodyweight Squats 4x20', 'Mountain Climbers 4x30s', 'Hollow Hold 3x30s']
    };

    const selected = templates[mode] || templates.home;

    return {
        mode,
        durationMinutes: adjustedMinutes,
        focus: goal === 'muscle_gain' ? 'strength_hypertrophy' : 'fat_loss_conditioning',
        exercises: selected
    };
}

function generateMealPlan({ preference, calories, protein }) {
    const presets = {
        budget: ['Oats + milk + banana', 'Chicken rice bowl', 'Greek yogurt + peanuts', 'Egg wrap'],
        high_protein: ['Egg white omelette', 'Chicken quinoa bowl', 'Protein yogurt parfait', 'Salmon + potatoes'],
        weight_loss: ['Veg omelette', 'Turkey salad', 'Cottage cheese snack', 'Lean beef stir-fry'],
        muscle_gain: ['Peanut butter oats', 'Chicken pasta', 'Protein shake + fruit', 'Rice + salmon + avocado'],
        vegetarian: ['Tofu scramble', 'Lentil bowl', 'Paneer wrap', 'Chickpea curry + rice'],
        halal: ['Halal chicken shawarma bowl', 'Beef kebab plate', 'Egg + labneh toast', 'Grilled fish + couscous']
    };

    const meals = presets[preference] || presets.high_protein;
    return {
        preference,
        targetCalories: calories,
        targetProtein: protein,
        meals,
        groceryList: ['Protein source', 'Complex carbs', 'Vegetables', 'Healthy fats', 'Hydration essentials']
    };
}

function analyzeAndCoach(db) {
    const targets = db.dailyTargets;
    const meals7 = getLastNDays(db.logs.meals, 7);
    const sleep7 = getLastNDays(db.logs.sleep, 7);
    const water3 = getLastNDays(db.logs.water, 3);
    const workouts7 = getLastNDays(db.logs.workouts, 7);
    const weight14 = getLastNDays(db.logs.weight, 14);

    const avgProtein = average(meals7.map((m) => Number(m.protein || 0)));
    const avgSleep = average(sleep7.map((s) => Number(s.hours || 0)));
    const avgWater = average(water3.map((w) => Number(w.ml || 0)));
    const workoutsDone = workouts7.length;

    let weightDelta = 0;
    if (weight14.length >= 2) {
        const sorted = [...weight14].sort((a, b) => new Date(a.date) - new Date(b.date));
        weightDelta = Number(sorted[sorted.length - 1].kg) - Number(sorted[0].kg);
    }

    const advice = [];
    if (avgSleep && avgSleep < 6) advice.push('You slept under 6h recently: do a lighter workout today.');
    if (avgProtein && avgProtein < targets.protein * 0.8) {
        advice.push(`Protein is low: add about ${Math.round(targets.protein - avgProtein)}g protein today.`);
    }
    if (avgWater && avgWater < targets.waterMl * 0.7) {
        advice.push('Hydration is low: drink 750ml more water before evening.');
    }
    if (weightDelta > 0.8) advice.push('Weight trend is rising: reduce daily calories by ~200 for next week.');
    if (workoutsDone <= 2) advice.push('Adherence is low: use 15-20 minute sessions to rebuild consistency.');
    if (!advice.length) advice.push('Great balance this week. Keep the current plan and progressive overload.');

    return {
        advice,
        metrics: {
            avgProtein: Math.round(avgProtein),
            avgSleep: Number(avgSleep.toFixed(1)),
            avgWater: Math.round(avgWater),
            workoutsDone,
            weightDelta: Number(weightDelta.toFixed(2))
        }
    };
}

function autoAdjustPlan(db) {
    const nextTargets = { ...db.dailyTargets };
    const coach = analyzeAndCoach(db);

    if (coach.metrics.weightDelta > 0.8) {
        nextTargets.calories = Math.max(1400, nextTargets.calories - 200);
    }

    if (coach.metrics.workoutsDone <= 2) {
        nextTargets.workoutMinutes = Math.max(20, nextTargets.workoutMinutes - 10);
    }

    if (coach.metrics.avgSleep && coach.metrics.avgSleep < 6) {
        nextTargets.workoutMinutes = Math.max(20, nextTargets.workoutMinutes - 5);
    }

    if (coach.metrics.avgProtein && coach.metrics.avgProtein < db.dailyTargets.protein * 0.8) {
        nextTargets.protein += 20;
    }

    return {
        previousTargets: db.dailyTargets,
        updatedTargets: nextTargets,
        reasons: coach.advice
    };
}

function predictProgress(db) {
    const weights = getLastNDays(db.logs.weight, 30);
    if (weights.length < 2) {
        return {
            message: 'Add more weight logs for accurate prediction.',
            etaWeeks: null,
            projectedWeight30Days: null
        };
    }

    const sorted = [...weights].sort((a, b) => new Date(a.date) - new Date(b.date));
    const first = Number(sorted[0].kg);
    const last = Number(sorted[sorted.length - 1].kg);
    const days = Math.max(1, Math.round((new Date(sorted[sorted.length - 1].date) - new Date(sorted[0].date)) / DAY_MS));
    const dailyRate = (last - first) / days;

    const target = Number(db.profile.targetWeightKg);
    const current = last;

    let etaWeeks = null;
    if (dailyRate < 0) {
        const daysToGoal = (target - current) / dailyRate;
        etaWeeks = daysToGoal > 0 ? Math.round((daysToGoal / 7) * 10) / 10 : 0;
    }

    const projectedWeight30Days = Math.round((current + dailyRate * 30) * 10) / 10;

    return {
        message: etaWeeks
            ? `At this pace, you may reach ${target}kg in about ${etaWeeks} weeks.`
            : 'Current trend is not moving toward your target yet.',
        etaWeeks,
        projectedWeight30Days,
        dailyRate: Number(dailyRate.toFixed(3))
    };
}

function parseVoiceLog(text) {
    const normalized = String(text || '').toLowerCase();

    if (normalized.includes('drank') || normalized.includes('water')) {
        const liters = normalized.match(/(\d+(?:\.\d+)?)\s*l/);
        const ml = liters ? Math.round(Number(liters[1]) * 1000) : 250;
        return { type: 'water', payload: { ml } };
    }

    if (normalized.includes('ate') || normalized.includes('meal')) {
        const proteinMatch = normalized.match(/(\d+)\s*g\s*protein/);
        return {
            type: 'meal',
            payload: {
                name: text,
                calories: 450,
                protein: proteinMatch ? Number(proteinMatch[1]) : 25
            }
        };
    }

    if (normalized.includes('workout') || normalized.includes('chest') || normalized.includes('run')) {
        const durationMatch = normalized.match(/(\d+)\s*min/);
        return {
            type: 'workout',
            payload: {
                title: text,
                mode: 'gym',
                durationMinutes: durationMatch ? Number(durationMatch[1]) : 30,
                intensity: 'moderate'
            }
        };
    }

    return { type: 'note', payload: { text } };
}

function defaultChallenges() {
    return [
        {
            id: 'hydration_hustle',
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
            id: 'step_storm',
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
            id: 'protein_lock',
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

function ensureChallenges(gamification) {
    if (!Array.isArray(gamification.challenges) || !gamification.challenges.length) {
        return {
            ...gamification,
            challenges: defaultChallenges()
        };
    }
    return gamification;
}

function challengeDeltaForLog(type, payload) {
    if (type === 'water') return { metric: 'waterMl', value: Number(payload.ml || 0) };
    if (type === 'steps') return { metric: 'steps', value: Number(payload.count || 0) };
    if (type === 'meals') return { metric: 'protein', value: Number(payload.protein || 0) };
    return null;
}

function updateChallengeProgress(gamification, logType, payload) {
    const prepared = ensureChallenges(gamification);
    const delta = challengeDeltaForLog(logType, payload);

    if (!delta || delta.value <= 0) {
        return prepared;
    }

    let next = { ...prepared, challenges: prepared.challenges.map((item) => ({ ...item })) };

    for (const challenge of next.challenges) {
        if (!challenge.joined || challenge.completed || challenge.metric !== delta.metric) continue;
        challenge.progress = Math.min(challenge.target, Number(challenge.progress || 0) + delta.value);
        if (challenge.progress >= challenge.target) {
            challenge.completed = true;
            next = addXp(next, challenge.rewardXp);
            if (!next.badges.includes(challenge.title)) {
                next.badges.push(challenge.title);
            }
        }
    }

    return next;
}

function getLeaderboard(db) {
    const selfScore = db.gamification.xp + db.gamification.streak * 25;
    const contenders = [
        { name: 'FitFusion Pro - Lena', xp: 1880, streak: 12 },
        { name: 'FitFusion Pro - Omar', xp: 1420, streak: 8 },
        { name: db.profile.name || 'You', xp: db.gamification.xp, streak: db.gamification.streak },
        { name: 'FitFusion Pro - Zoya', xp: 860, streak: 6 }
    ].map((entry) => ({
        ...entry,
        score: entry.name === (db.profile.name || 'You') ? selfScore : entry.xp + entry.streak * 25
    }));

    return contenders
        .sort((a, b) => b.score - a.score)
        .map((entry, index) => ({
            rank: index + 1,
            ...entry
        }));
}

module.exports = {
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
};
