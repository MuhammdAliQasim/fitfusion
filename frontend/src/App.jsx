import { useEffect, useMemo, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api'
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '')
const TOKEN_KEY = 'fitfusion_token'

const initialForms = {
  meal: { name: '', calories: 500, protein: 30 },
  workout: { title: '', mode: 'gym', durationMinutes: 45, intensity: 'moderate' },
  steps: { count: 4000 },
  weight: { kg: 80 },
  sleep: { hours: 7 },
  water: { ml: 500 }
}

const workoutModes = ['gym', 'home', 'travel', 'no_equipment']
const mealPreferences = ['budget', 'high_protein', 'weight_loss', 'muscle_gain', 'vegetarian', 'halal']

async function api(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  const isFormData = options.body instanceof FormData
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || 'Request failed')
  }

  return response.json()
}

function StatCard({ title, value, sub }) {
  return (
    <div className="card stat">
      <p className="stat-title">{title}</p>
      <h3>{value}</h3>
      {sub ? <p className="muted">{sub}</p> : null}
    </div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || '')
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' })
  const [dashboard, setDashboard] = useState(null)
  const [forms, setForms] = useState(initialForms)
  const [workoutSuggestion, setWorkoutSuggestion] = useState(null)
  const [mealPlan, setMealPlan] = useState(null)
  const [voiceText, setVoiceText] = useState('')
  const [voiceResult, setVoiceResult] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoNote, setPhotoNote] = useState('')
  const [logs, setLogs] = useState({ photos: [], weight: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [integrationMessage, setIntegrationMessage] = useState('')

  const summary = dashboard?.summary
  const coach = dashboard?.coach
  const prediction = dashboard?.prediction
  const challenges = dashboard?.challenges || []
  const leaderboard = dashboard?.leaderboard || []

  const weeklyWeightText = useMemo(() => {
    const trend = summary?.weeklyWeightTrend || []
    if (!trend.length) return 'No weight logs yet'
    return trend.map((item) => `${item.date}: ${item.kg}kg`).join(' | ')
  }, [summary])

  async function refreshDashboard() {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [dash, photos, weight] = await Promise.all([
        api('/dashboard'),
        api('/logs/photos'),
        api('/logs/weight')
      ])
      setDashboard(dash)
      setLogs({ photos, weight })
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!token) return
      ; (async () => {
        try {
          const me = await api('/auth/me')
          setUser(me)
          await refreshDashboard()
        } catch {
          localStorage.removeItem(TOKEN_KEY)
          setToken('')
          setUser(null)
        }
      })()
  }, [token])

  function updateAuthField(key, value) {
    setAuthForm((prev) => ({ ...prev, [key]: value }))
  }

  async function submitAuth() {
    setError('')
    try {
      const endpoint = authMode === 'register' ? '/auth/register' : '/auth/login'
      const payload = authMode === 'register'
        ? { name: authForm.name, email: authForm.email, password: authForm.password }
        : { email: authForm.email, password: authForm.password }
      const result = await api(endpoint, { method: 'POST', body: JSON.stringify(payload) })
      localStorage.setItem(TOKEN_KEY, result.token)
      setToken(result.token)
      setUser(result.user)
      setAuthForm({ name: '', email: '', password: '' })
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken('')
    setUser(null)
    setDashboard(null)
  }

  function updateForm(section, key, value) {
    setForms((prev) => ({ ...prev, [section]: { ...prev[section], [key]: value } }))
  }

  async function submitLog(type) {
    try {
      await api(`/logs/${type}`, {
        method: 'POST',
        body: JSON.stringify(forms[type])
      })
      await refreshDashboard()
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  async function connect(provider) {
    try {
      setIntegrationMessage('')
      if (provider === 'fitbit') {
        const oauth = await api('/integrations/fitbit/oauth/start')
        if (oauth.message) setIntegrationMessage(oauth.message)
        if (oauth.authorizationUrl) {
          window.open(oauth.authorizationUrl, '_blank', 'noopener,noreferrer')
        }
      } else if (provider === 'apple-health') {
        const result = await api('/integrations/apple-health/oauth/start')
        if (result.message) setIntegrationMessage(result.message)
      } else {
        await api(`/integrations/${provider}/connect`, { method: 'POST' })
      }
      await refreshDashboard()
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  async function syncFitbitSteps() {
    try {
      setIntegrationMessage('')
      const result = await api('/integrations/fitbit/sync-steps', { method: 'POST' })
      setIntegrationMessage(result.message || 'Fitbit steps synced.')
      await refreshDashboard()
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  async function runWorkoutGenerator(mode, quick) {
    try {
      const result = await api('/workout-generator', {
        method: 'POST',
        body: JSON.stringify({ mode, quick })
      })
      setWorkoutSuggestion(result)
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  async function runMealBuilder(preference) {
    try {
      const result = await api('/meal-builder', {
        method: 'POST',
        body: JSON.stringify({ preference })
      })
      setMealPlan(result)
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  async function sendVoiceLog() {
    try {
      const result = await api('/voice-log', {
        method: 'POST',
        body: JSON.stringify({ text: voiceText })
      })
      setVoiceResult(result)
      setVoiceText('')
      await refreshDashboard()
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  async function adjustPlan() {
    try {
      await api('/ai/adjust-plan', { method: 'POST' })
      await refreshDashboard()
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  async function joinChallenge(challengeId) {
    try {
      await api(`/gamification/challenges/${challengeId}/join`, { method: 'POST' })
      await refreshDashboard()
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  async function uploadPhoto() {
    if (!photoFile) return
    const body = new FormData()
    body.append('photo', photoFile)
    body.append('note', photoNote)

    try {
      const response = await fetch(`${API_BASE}/logs/photo`, {
        method: 'POST',
        body,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (!response.ok) throw new Error(await response.text())
      setPhotoFile(null)
      setPhotoNote('')
      await refreshDashboard()
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  if (!token) {
    return (
      <div className="app-shell auth-shell">
        <header>
          <h1>FitFusion — AI All-in-One Fitness</h1>
          <p className="muted">Secure account required for personalized plans, coach, and synced progress.</p>
        </header>

        {error ? <div className="error">{error}</div> : null}

        <section className="card auth-card">
          <h2>{authMode === 'register' ? 'Create Your Account' : 'Sign In'}</h2>
          {authMode === 'register' ? (
            <input placeholder="Full name" value={authForm.name} onChange={(e) => updateAuthField('name', e.target.value)} />
          ) : null}
          <input placeholder="Email" value={authForm.email} onChange={(e) => updateAuthField('email', e.target.value)} />
          <input type="password" placeholder="Password (min 8 chars)" value={authForm.password} onChange={(e) => updateAuthField('password', e.target.value)} />
          <button onClick={submitAuth}>{authMode === 'register' ? 'Create Account' : 'Sign In'}</button>

          <p className="muted">
            {authMode === 'register' ? 'Already have an account?' : 'Need an account?'}{' '}
            <button className="link-btn" onClick={() => setAuthMode(authMode === 'register' ? 'login' : 'register')}>
              {authMode === 'register' ? 'Sign in here' : 'Create one here'}
            </button>
          </p>
          <p className="muted">Demo seeded account: <strong>demo@fitfusion.app</strong> / <strong>demo1234</strong></p>
        </section>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="main-header">
        <h1>FitFusion</h1>
        <p className="muted">Minimal performance dashboard for nutrition, training, recovery, and live step sync.</p>
        <div className="row header-row">
          <span className="muted">Signed in as {user?.name || user?.email || 'User'}</span>
          <div className="row">
            <button className="ghost-btn" onClick={refreshDashboard}>Refresh</button>
            <button onClick={logout}>Logout</button>
          </div>
        </div>
      </header>

      {error ? <div className="error">{error}</div> : null}
      {loading ? <div className="muted">Loading dashboard...</div> : null}

      {dashboard ? (
        <>
          <section className="grid">
            <StatCard title="Calories Left" value={summary.caloriesLeft} sub={`Consumed ${summary.caloriesConsumed}`} />
            <StatCard title="Protein" value={`${summary.proteinConsumed}g`} sub={`Target ${dashboard.targets.protein}g`} />
            <StatCard title="Steps" value={summary.steps} sub={`Target ${dashboard.targets.steps}`} />
            <StatCard title="Workout Today" value={summary.workoutTodayCount} sub={`Target ${dashboard.targets.workoutMinutes} min`} />
            <StatCard title="Sleep Score" value={`${summary.sleepScore}/100`} sub={`Target ${dashboard.targets.sleepHours}h`} />
            <StatCard title="Water" value={`${summary.waterMl} ml`} sub={`Target ${dashboard.targets.waterMl} ml`} />
            <StatCard title="XP / Level" value={`${dashboard.gamification.xp} / L${dashboard.gamification.level}`} sub={`Streak ${dashboard.gamification.streak} days`} />
            <StatCard title="Integrations" value={`${dashboard.integrations.appleHealthConnected ? 'Apple✓' : 'Apple✗'} ${dashboard.integrations.fitbitConnected ? 'Fitbit✓' : 'Fitbit✗'}`} />
          </section>

          <section className="card">
            <h2>Connections</h2>
            <p><strong>Weekly weight trend:</strong> {weeklyWeightText}</p>
            <p><strong>Badges:</strong> {dashboard.gamification.badges.join(', ') || 'No badges yet'}</p>
            <div className="row wrap">
              <button onClick={() => connect('apple-health')}>Connect Apple Health</button>
              <button onClick={() => connect('fitbit')}>Connect Fitbit</button>
              <button onClick={syncFitbitSteps}>Sync Fitbit Steps Now</button>
            </div>
            {integrationMessage ? <p className="muted integration-note">{integrationMessage}</p> : null}
            <div className="integration-stack muted">
              <p><strong>Apple Health:</strong> requires iOS HealthKit bridge (web browsers cannot read Apple sensors directly).</p>
              <p><strong>Samsung Health:</strong> direct web sync is not supported by Samsung SDK; use Health Sync to Fitbit/Google Fit, then sync here.</p>
            </div>
          </section>

          <section className="two-col">
            <div className="card">
              <h2>Challenges</h2>
              <p className="muted">Join weekly goals to earn XP and badges.</p>
              <div className="challenge-list">
                {challenges.map((challenge) => {
                  const pct = Math.min(100, Math.round((challenge.progress / challenge.target) * 100))
                  return (
                    <div className="challenge-item" key={challenge.id}>
                      <div className="row challenge-head">
                        <strong>{challenge.title}</strong>
                        <span className="muted">+{challenge.rewardXp} XP</span>
                      </div>
                      <p className="muted">{challenge.progress} / {challenge.target} • {pct}%</p>
                      <div className="progress-track"><span style={{ width: `${pct}%` }} /></div>
                      {!challenge.joined ? (
                        <button onClick={() => joinChallenge(challenge.id)}>Join Challenge</button>
                      ) : challenge.completed ? (
                        <span className="pill">Completed</span>
                      ) : (
                        <span className="pill">Joined</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="card">
              <h2>Leaderboard</h2>
              <p className="muted">Competitive score = XP + streak bonus.</p>
              <div className="leaderboard-list">
                {leaderboard.map((entry) => (
                  <div className="leaderboard-row" key={`${entry.name}-${entry.rank}`}>
                    <strong>#{entry.rank} {entry.name}</strong>
                    <span className="muted">Score {entry.score} • XP {entry.xp} • 🔥 {entry.streak}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="two-col">
            <div className="card">
              <h2>Quick Logging</h2>

              <div className="form-row">
                <input placeholder="Meal name" value={forms.meal.name} onChange={(e) => updateForm('meal', 'name', e.target.value)} />
                <input type="number" value={forms.meal.calories} onChange={(e) => updateForm('meal', 'calories', Number(e.target.value))} />
                <input type="number" value={forms.meal.protein} onChange={(e) => updateForm('meal', 'protein', Number(e.target.value))} />
                <button onClick={() => submitLog('meal')}>Log Meal</button>
              </div>

              <div className="form-row">
                <input placeholder="Workout title" value={forms.workout.title} onChange={(e) => updateForm('workout', 'title', e.target.value)} />
                <select value={forms.workout.mode} onChange={(e) => updateForm('workout', 'mode', e.target.value)}>
                  {workoutModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                </select>
                <input type="number" value={forms.workout.durationMinutes} onChange={(e) => updateForm('workout', 'durationMinutes', Number(e.target.value))} />
                <button onClick={() => submitLog('workout')}>Log Workout</button>
              </div>

              <div className="row compact">
                <label>Steps <input type="number" value={forms.steps.count} onChange={(e) => updateForm('steps', 'count', Number(e.target.value))} /></label>
                <button onClick={() => submitLog('steps')}>Log Steps</button>
                <label>Weight(kg) <input type="number" step="0.1" value={forms.weight.kg} onChange={(e) => updateForm('weight', 'kg', Number(e.target.value))} /></label>
                <button onClick={() => submitLog('weight')}>Log Weight</button>
              </div>

              <div className="row compact">
                <label>Sleep(h) <input type="number" step="0.1" value={forms.sleep.hours} onChange={(e) => updateForm('sleep', 'hours', Number(e.target.value))} /></label>
                <button onClick={() => submitLog('sleep')}>Log Sleep</button>
                <label>Water(ml) <input type="number" value={forms.water.ml} onChange={(e) => updateForm('water', 'ml', Number(e.target.value))} /></label>
                <button onClick={() => submitLog('water')}>Log Water</button>
              </div>
            </div>

            <div className="card">
              <h2>AI Coach + Auto Adjustment</h2>
              <ul>
                {coach?.advice?.map((line, idx) => <li key={idx}>{line}</li>)}
              </ul>
              <p className="muted">Protein avg: {coach?.metrics?.avgProtein}g | Sleep avg: {coach?.metrics?.avgSleep}h | Weight Δ: {coach?.metrics?.weightDelta}kg</p>
              <button onClick={adjustPlan}>Auto Adjust Plan Now</button>

              <h3>Progress Prediction</h3>
              <p>{prediction?.message}</p>
              <p className="muted">30-day projected weight: {prediction?.projectedWeight30Days ?? 'N/A'}kg</p>
            </div>
          </section>

          <section className="two-col">
            <div className="card">
              <h2>Workout Generator (Gym/Home/Travel/No Equipment)</h2>
              <div className="row wrap">
                {workoutModes.map((mode) => (
                  <button key={mode} onClick={() => runWorkoutGenerator(mode, false)}>{mode}</button>
                ))}
                <button onClick={() => runWorkoutGenerator('home', true)}>15-Min Quick</button>
              </div>

              {workoutSuggestion ? (
                <div className="result-box">
                  <p><strong>Mode:</strong> {workoutSuggestion.mode}</p>
                  <p><strong>Duration:</strong> {workoutSuggestion.durationMinutes} min</p>
                  <p><strong>Focus:</strong> {workoutSuggestion.focus}</p>
                  <ul>
                    {workoutSuggestion.exercises.map((exercise) => <li key={exercise}>{exercise}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="card">
              <h2>Smart Meal Builder</h2>
              <div className="row wrap">
                {mealPreferences.map((pref) => (
                  <button key={pref} onClick={() => runMealBuilder(pref)}>{pref}</button>
                ))}
              </div>

              {mealPlan ? (
                <div className="result-box">
                  <p><strong>Plan:</strong> {mealPlan.preference}</p>
                  <p><strong>Targets:</strong> {mealPlan.targetCalories} kcal, {mealPlan.targetProtein}g protein</p>
                  <h4>Meals</h4>
                  <ul>
                    {mealPlan.meals.map((meal) => <li key={meal}>{meal}</li>)}
                  </ul>
                  <h4>Grocery List</h4>
                  <ul>
                    {mealPlan.groceryList.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>

          <section className="two-col">
            <div className="card">
              <h2>Voice Logging</h2>
              <div className="form-row">
                <input
                  placeholder='Try: "I ate 2 eggs and toast" or "I drank 1L water"'
                  value={voiceText}
                  onChange={(e) => setVoiceText(e.target.value)}
                />
                <button onClick={sendVoiceLog}>Submit Voice Log</button>
              </div>
              {voiceResult ? (
                <p className="muted">Parsed as: {voiceResult.parsed.type}</p>
              ) : null}
            </div>

            <div className="card">
              <h2>Progress Photos</h2>
              <div className="form-row">
                <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
                <input placeholder="Note" value={photoNote} onChange={(e) => setPhotoNote(e.target.value)} />
                <button onClick={uploadPhoto}>Upload Photo</button>
              </div>
              <div className="photo-grid">
                {logs.photos.slice(-6).map((photo) => (
                  <div className="photo-card" key={photo.id}>
                    {photo.url ? <img src={`${API_ORIGIN}${photo.url}`} alt="Progress" /> : null}
                    <p className="muted">{photo.date} {photo.note ? `• ${photo.note}` : ''}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}

export default App
