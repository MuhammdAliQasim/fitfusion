const test = require('node:test');
const assert = require('node:assert/strict');

const { parseVoiceLog, generateWorkout, generateMealPlan, predictProgress, updateChallengeProgress, getLeaderboard } = require('./logic');

test('parseVoiceLog parses water logs', () => {
    const parsed = parseVoiceLog('I drank 1.5L water');
    assert.equal(parsed.type, 'water');
    assert.equal(parsed.payload.ml, 1500);
});

test('generateWorkout returns quick plan duration', () => {
    const plan = generateWorkout({ mode: 'home', quick: true, goal: 'fat_loss', missedWorkouts: 0 });
    assert.equal(plan.durationMinutes, 15);
    assert.equal(plan.mode, 'home');
});

test('generateMealPlan contains grocery list', () => {
    const mealPlan = generateMealPlan({ preference: 'halal', calories: 2200, protein: 160 });
    assert.ok(mealPlan.meals.length > 0);
    assert.ok(mealPlan.groceryList.length > 0);
});

test('predictProgress returns projection with enough data', () => {
    const db = {
        profile: { targetWeightKg: 75 },
        logs: {
            weight: [
                { date: '2026-03-01', kg: 82 },
                { date: '2026-03-24', kg: 80.5 }
            ]
        }
    };

    const prediction = predictProgress(db);
    assert.ok(prediction.projectedWeight30Days !== null);
});

test('updateChallengeProgress advances joined challenge', () => {
    const gamification = {
        xp: 0,
        level: 1,
        badges: [],
        streak: 0,
        lastActiveDate: null,
        challenges: [
            {
                id: 'hydration_hustle',
                title: 'Hydration Hustle',
                metric: 'waterMl',
                target: 2000,
                rewardXp: 100,
                progress: 1500,
                completed: false,
                joined: true
            }
        ]
    };

    const updated = updateChallengeProgress(gamification, 'water', { ml: 700 });
    assert.equal(updated.challenges[0].progress, 2000);
    assert.equal(updated.challenges[0].completed, true);
});

test('getLeaderboard returns ranked entries', () => {
    const db = {
        profile: { name: 'Alex' },
        gamification: { xp: 500, streak: 4 }
    };

    const board = getLeaderboard(db);
    assert.ok(board.length >= 3);
    assert.equal(board[0].rank, 1);
});
