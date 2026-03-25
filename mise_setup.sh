#!/bin/bash
set -e

echo "🍴 Setting up Mise..."

# Create directory structure
mkdir -p src/{components,pages,hooks,lib}
mkdir -p server/routes

# ── vite.config.js ──────────────────────────────────────────────────────────
cat > vite.config.js << 'ENDOFFILE'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})
ENDOFFILE

# ── index.html ───────────────────────────────────────────────────────────────
cat > index.html << 'ENDOFFILE'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mise</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
ENDOFFILE

# ── tailwind.config.js ───────────────────────────────────────────────────────
cat > tailwind.config.js << 'ENDOFFILE'
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
}
ENDOFFILE

# ── postcss.config.js ────────────────────────────────────────────────────────
cat > postcss.config.js << 'ENDOFFILE'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
ENDOFFILE

# ── .gitignore ───────────────────────────────────────────────────────────────
cat > .gitignore << 'ENDOFFILE'
node_modules
.env
dist
.DS_Store
ENDOFFILE

# ── src/index.css ────────────────────────────────────────────────────────────
cat > src/index.css << 'ENDOFFILE'
@tailwind base;
@tailwind components;
@tailwind utilities;

* { box-sizing: border-box; }

body {
  background: #0A0A0A;
  color: #fff;
  font-family: 'DM Sans', sans-serif;
  margin: 0;
}

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: #111; }
::-webkit-scrollbar-thumb { background: #2A2A2A; border-radius: 99px; }
ENDOFFILE

# ── src/lib/supabase.js ──────────────────────────────────────────────────────
cat > src/lib/supabase.js << 'ENDOFFILE'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = createClient(supabaseUrl, supabasePublishableKey)
ENDOFFILE

# ── src/hooks/useAuth.jsx ────────────────────────────────────────────────────
cat > src/hooks/useAuth.jsx << 'ENDOFFILE'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signUp = (email, password) =>
    supabase.auth.signUp({ email, password })

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({ provider: 'google' })

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
ENDOFFILE

# ── src/hooks/useRecipes.js ──────────────────────────────────────────────────
cat > src/hooks/useRecipes.js << 'ENDOFFILE'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useRecipes() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchRecipes = async (filters = {}) => {
    setLoading(true)
    let query = supabase
      .from('recipes')
      .select('*, ingredients(*), steps(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (filters.cuisine) query = query.eq('cuisine', filters.cuisine)
    if (filters.maxTime) query = query.lte('prep_time', filters.maxTime)

    const { data, error } = await query
    setLoading(false)
    if (error) { setError(error.message); return [] }
    return data
  }

  const fetchRecipeById = async (id) => {
    const { data, error } = await supabase
      .from('recipes')
      .select('*, ingredients(*), steps(*)')
      .eq('id', id)
      .single()
    if (error) return null
    return data
  }

  const saveRecipe = async (recipe) => {
    const { data: recipeData, error: recipeError } = await supabase
      .from('recipes')
      .insert({
        user_id: user.id,
        title: recipe.title,
        source_url: recipe.source_url || null,
        image_url: recipe.image_url || null,
        prep_time: recipe.prep_time || 0,
        cook_time: recipe.cook_time || 0,
        servings: recipe.servings || 2,
        cuisine: recipe.cuisine || 'Other',
        difficulty: recipe.difficulty || 'Medium',
        cost_estimate: recipe.cost_estimate || 0,
        calories: recipe.calories || 0,
        protein: recipe.protein || 0,
        carbs: recipe.carbs || 0,
        fat: recipe.fat || 0,
        goals: recipe.goals || [],
        description: recipe.description || '',
      })
      .select()
      .single()

    if (recipeError) { setError(recipeError.message); return null }

    if (recipe.ingredients?.length) {
      await supabase.from('ingredients').insert(
        recipe.ingredients.map(ing => ({
          recipe_id: recipeData.id,
          name: ing.name,
          quantity: ing.quantity || '',
          unit: ing.unit || '',
          calories: ing.calories || 0,
        }))
      )
    }

    if (recipe.steps?.length) {
      await supabase.from('steps').insert(
        recipe.steps.map((step, i) => ({
          recipe_id: recipeData.id,
          order_num: i + 1,
          instruction: step.instruction,
          timer_seconds: step.timer_seconds || null,
        }))
      )
    }

    return recipeData
  }

  const deleteRecipe = async (id) => {
    const { error } = await supabase.from('recipes').delete().eq('id', id)
    return !error
  }

  const fetchMealPlan = async (weekStart) => {
    const { data, error } = await supabase
      .from('meal_plan')
      .select('*, recipes(id, title, image_url, prep_time, calories, protein, cost_estimate)')
      .eq('user_id', user.id)
      .gte('date', weekStart)
      .lte('date', new Date(new Date(weekStart).getTime() + 6 * 86400000).toISOString().split('T')[0])
    if (error) return []
    return data
  }

  const setMealPlanSlot = async (date, slot, recipeId) => {
    const { error } = await supabase
      .from('meal_plan')
      .upsert({
        user_id: user.id,
        date,
        slot,
        recipe_id: recipeId,
      }, { onConflict: 'user_id,date,slot' })
    return !error
  }

  const fetchUserProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    return data
  }

  const updateUserProfile = async (updates) => {
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, ...updates })
    return !error
  }

  const fetchFridge = async () => {
    const { data } = await supabase
      .from('user_fridge')
      .select('*')
      .eq('user_id', user.id)
    return data || []
  }

  const updateFridge = async (ingredients) => {
    await supabase.from('user_fridge').delete().eq('user_id', user.id)
    if (ingredients.length) {
      await supabase.from('user_fridge').insert(
        ingredients.map(name => ({ user_id: user.id, ingredient_name: name }))
      )
    }
  }

  return {
    loading, error,
    fetchRecipes, fetchRecipeById, saveRecipe, deleteRecipe,
    fetchMealPlan, setMealPlanSlot,
    fetchUserProfile, updateUserProfile,
    fetchFridge, updateFridge,
  }
}
ENDOFFILE

# ── src/main.jsx ─────────────────────────────────────────────────────────────
cat > src/main.jsx << 'ENDOFFILE'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth.jsx'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
ENDOFFILE

# ── src/App.jsx ──────────────────────────────────────────────────────────────
cat > src/App.jsx << 'ENDOFFILE'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth.jsx'
import AuthPage from './pages/AuthPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import RecipesPage from './pages/RecipesPage.jsx'
import AddRecipePage from './pages/AddRecipePage.jsx'
import RecipeDetailPage from './pages/RecipeDetailPage.jsx'
import CookModePage from './pages/CookModePage.jsx'
import MacrosPage from './pages/MacrosPage.jsx'
import FridgePage from './pages/FridgePage.jsx'
import ChatPage from './pages/ChatPage.jsx'
import Layout from './components/Layout.jsx'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0A0A0A' }}>
      <div style={{ color: '#00FF85', fontSize: 14, fontWeight: 700 }}>Loading...</div>
    </div>
  )
  return user ? children : <Navigate to="/auth" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="recipes" element={<RecipesPage />} />
        <Route path="recipes/add" element={<AddRecipePage />} />
        <Route path="recipes/:id" element={<RecipeDetailPage />} />
        <Route path="cook/:id" element={<CookModePage />} />
        <Route path="macros" element={<MacrosPage />} />
        <Route path="fridge" element={<FridgePage />} />
        <Route path="chat" element={<ChatPage />} />
      </Route>
    </Routes>
  )
}
ENDOFFILE

# ── src/components/Layout.jsx ────────────────────────────────────────────────
cat > src/components/Layout.jsx << 'ENDOFFILE'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

const NAV = [
  { to: '/', label: 'Dashboard', icon: '⊞' },
  { to: '/recipes', label: 'Recipes', icon: '📖' },
  { to: '/macros', label: 'Macros', icon: '📊' },
  { to: '/fridge', label: 'Fridge', icon: '🧊' },
  { to: '/chat', label: 'Assistant', icon: '✦' },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0A0A0A' }}>
      <aside style={{
        width: 220, borderRight: '1px solid #1A1A1A',
        display: 'flex', flexDirection: 'column',
        padding: '24px 16px', position: 'sticky', top: 0, height: '100vh'
      }}>
        <div style={{ marginBottom: 32 }}>
          <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>
            mise<span style={{ color: '#00FF85' }}>.</span>
          </span>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {NAV.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10,
              background: isActive ? '#1A1A1A' : 'transparent',
              color: isActive ? '#00FF85' : '#555',
              textDecoration: 'none', fontSize: 14, fontWeight: 600,
              transition: 'all 0.15s'
            })}>
              <span>{icon}</span> {label}
            </NavLink>
          ))}
        </nav>
        <div style={{ borderTop: '1px solid #1A1A1A', paddingTop: 16 }}>
          <div style={{ fontSize: 12, color: '#444', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email}
          </div>
          <button onClick={handleSignOut} style={{
            width: '100%', padding: '8px 12px', borderRadius: 8,
            border: '1px solid #2A2A2A', background: 'transparent',
            color: '#555', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit'
          }}>Sign out</button>
        </div>
      </aside>
      <main style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  )
}
ENDOFFILE

# ── src/pages/AuthPage.jsx ───────────────────────────────────────────────────
cat > src/pages/AuthPage.jsx << 'ENDOFFILE'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

export default function AuthPage() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password)
    setLoading(false)
    if (error) { setError(error.message); return }
    if (mode === 'signup') { setError('Check your email to confirm your account.'); return }
    navigate('/')
  }

  const input = {
    width: '100%', padding: '12px 16px', borderRadius: 10,
    border: '1px solid #2A2A2A', background: '#111',
    color: '#fff', fontSize: 15, fontFamily: 'inherit', outline: 'none',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 8 }}>
            mise<span style={{ color: '#00FF85' }}>.</span>
          </div>
          <div style={{ color: '#555', fontSize: 15 }}>Your AI meal planning assistant</div>
        </div>
        <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 20, padding: 32 }}>
          <div style={{ display: 'flex', marginBottom: 24, background: '#111', borderRadius: 10, padding: 4 }}>
            {['signin', 'signup'].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                background: mode === m ? '#2A2A2A' : 'transparent',
                color: mode === m ? '#fff' : '#555',
                fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit'
              }}>{m === 'signin' ? 'Sign In' : 'Sign Up'}</button>
            ))}
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input style={input} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
            <input style={input} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            {error && <div style={{ color: error.includes('Check') ? '#00FF85' : '#ef4444', fontSize: 13, textAlign: 'center' }}>{error}</div>}
            <button type="submit" disabled={loading} style={{
              padding: '14px', borderRadius: 12, border: 'none',
              background: '#00FF85', color: '#000', fontSize: 15, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1
            }}>{loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Create Account'}</button>
          </form>
          <div style={{ margin: '20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: '#2A2A2A' }} />
            <span style={{ color: '#444', fontSize: 13 }}>or</span>
            <div style={{ flex: 1, height: 1, background: '#2A2A2A' }} />
          </div>
          <button onClick={signInWithGoogle} style={{
            width: '100%', padding: '12px', borderRadius: 12,
            border: '1px solid #2A2A2A', background: 'transparent',
            color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}>
            <span>G</span> Continue with Google
          </button>
        </div>
      </div>
    </div>
  )
}
ENDOFFILE

# ── src/pages/DashboardPage.jsx ──────────────────────────────────────────────
cat > src/pages/DashboardPage.jsx << 'ENDOFFILE'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecipes } from '../hooks/useRecipes.js'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack']

function getWeekStart() {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

function getDayDate(weekStart, dayIndex) {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + dayIndex)
  return d.toISOString().split('T')[0]
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { fetchMealPlan, fetchRecipes, setMealPlanSlot, fetchUserProfile } = useRecipes()
  const [activeDay, setActiveDay] = useState('Mon')
  const [mealPlan, setMealPlan] = useState({})
  const [recipes, setRecipes] = useState([])
  const [profile, setProfile] = useState(null)
  const [showPicker, setShowPicker] = useState(null)
  const weekStart = getWeekStart()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [planData, recipesData, profileData] = await Promise.all([
      fetchMealPlan(weekStart),
      fetchRecipes(),
      fetchUserProfile(),
    ])
    setProfile(profileData)
    setRecipes(recipesData || [])
    const shaped = {}
    planData?.forEach(entry => {
      const dayIndex = DAYS.findIndex((_, i) => getDayDate(weekStart, i) === entry.date)
      if (dayIndex >= 0) shaped[`${DAYS[dayIndex]}-${entry.slot}`] = entry.recipes
    })
    setMealPlan(shaped)
  }

  async function handlePickMeal(day, slot, recipe) {
    const date = getDayDate(weekStart, DAYS.indexOf(day))
    await setMealPlanSlot(date, slot, recipe.id)
    setMealPlan(prev => ({ ...prev, [`${day}-${slot}`]: recipe }))
    setShowPicker(null)
  }

  const activeDayMeals = SLOTS.map(slot => ({ slot, meal: mealPlan[`${activeDay}-${slot}`] || null }))
  const todayTotals = activeDayMeals.reduce((acc, { meal }) => ({
    calories: acc.calories + (meal?.calories || 0),
    protein: acc.protein + (meal?.protein || 0),
  }), { calories: 0, protein: 0 })

  const goal = profile?.goal || 'maintain'
  const calTarget = { cut: 1800, maintain: 2200, bulk: 2800 }[goal] || 2200

  return (
    <div style={{ padding: 28, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>This Week</h1>
          <div style={{ color: '#555', fontSize: 14 }}>Goal: <span style={{ color: '#00FF85', fontWeight: 700, textTransform: 'capitalize' }}>{goal}</span></div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{todayTotals.calories}<span style={{ fontSize: 13, color: '#444', fontWeight: 400 }}>/{calTarget} kcal</span></div>
          <div style={{ fontSize: 13, color: '#c084fc' }}>{todayTotals.protein}g protein today</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
        {DAYS.map(day => (
          <button key={day} onClick={() => setActiveDay(day)} style={{
            padding: '8px 18px', borderRadius: 10, border: 'none',
            background: activeDay === day ? '#00FF85' : '#1A1A1A',
            color: activeDay === day ? '#000' : '#666',
            fontWeight: 700, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit'
          }}>{day}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
        {activeDayMeals.map(({ slot, meal }) => (
          <div key={slot} style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 14, overflow: 'hidden', minHeight: 200 }}>
            {meal ? (
              <>
                <div style={{ position: 'relative' }}>
                  {meal.image_url
                    ? <img src={meal.image_url} alt={meal.title} style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} />
                    : <div style={{ width: '100%', height: 110, background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🍽</div>
                  }
                  <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.7)', color: '#888', fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>{slot}</span>
                </div>
                <div style={{ padding: '10px 12px 12px' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{meal.title}</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                    {meal.prep_time > 0 && <span style={{ background: '#1E2A1E', color: '#00FF85', fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>⏱ {meal.prep_time}m</span>}
                    {meal.protein > 0 && <span style={{ background: '#2A1E2A', color: '#c084fc', fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>💪 {meal.protein}g</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => navigate(`/cook/${meal.id}`)} style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', background: '#00FF85', color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cook</button>
                    <button onClick={() => setShowPicker({ day: activeDay, slot })} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #2A2A2A', background: 'transparent', color: '#888', fontSize: 12, cursor: 'pointer' }}>⟳</button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ height: '100%', minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 }}>
                <span style={{ color: '#333', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{slot}</span>
                <button onClick={() => setShowPicker({ day: activeDay, slot })} style={{ padding: '8px 16px', borderRadius: 8, border: '1px dashed #2A2A2A', background: 'transparent', color: '#555', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add meal</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {showPicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowPicker(null)}>
          <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 20, padding: 24, maxWidth: 480, width: '100%', maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>Pick {showPicker.slot}</h3>
              <button onClick={() => setShowPicker(null)} style={{ background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            {recipes.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#555', padding: '32px 0' }}>
                No recipes yet. <span style={{ color: '#00FF85', cursor: 'pointer' }} onClick={() => navigate('/recipes/add')}>Add some →</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recipes.map(recipe => (
                  <div key={recipe.id} onClick={() => handlePickMeal(showPicker.day, showPicker.slot, recipe)}
                    style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#111', border: '1px solid #2A2A2A', borderRadius: 12, padding: 12, cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#00FF85'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = '#2A2A2A'}
                  >
                    {recipe.image_url
                      ? <img src={recipe.image_url} alt={recipe.title} style={{ width: 64, height: 50, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                      : <div style={{ width: 64, height: 50, borderRadius: 8, background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🍽</div>
                    }
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{recipe.title}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span style={{ background: '#1E2A1E', color: '#00FF85', fontSize: 11, padding: '2px 7px', borderRadius: 99, fontWeight: 600 }}>⏱ {recipe.prep_time}m</span>
                        <span style={{ background: '#2A1E2A', color: '#c084fc', fontSize: 11, padding: '2px 7px', borderRadius: 99, fontWeight: 600 }}>💪 {recipe.protein}g</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
ENDOFFILE

# ── src/pages/RecipesPage.jsx ────────────────────────────────────────────────
cat > src/pages/RecipesPage.jsx << 'ENDOFFILE'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecipes } from '../hooks/useRecipes.js'

export default function RecipesPage() {
  const navigate = useNavigate()
  const { fetchRecipes, deleteRecipe } = useRecipes()
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchRecipes().then(data => { setRecipes(data || []); setLoading(false) })
  }, [])

  const filtered = recipes.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.cuisine?.toLowerCase().includes(search.toLowerCase())
  )

  async function handleDelete(id, e) {
    e.stopPropagation()
    if (!confirm('Delete this recipe?')) return
    await deleteRecipe(id)
    setRecipes(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div style={{ padding: 28, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>My Recipes</h1>
        <button onClick={() => navigate('/recipes/add')} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#00FF85', color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add Recipe</button>
      </div>
      <input style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #2A2A2A', background: '#111', color: '#fff', fontSize: 14, fontFamily: 'inherit', outline: 'none', marginBottom: 20 }}
        placeholder="Search recipes..." value={search} onChange={e => setSearch(e.target.value)} />
      {loading ? (
        <div style={{ color: '#555', textAlign: 'center', padding: 48 }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 64 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🍽</div>
          <div style={{ color: '#555', fontSize: 16, marginBottom: 20 }}>No recipes yet</div>
          <button onClick={() => navigate('/recipes/add')} style={{ padding: '12px 28px', borderRadius: 12, border: 'none', background: '#00FF85', color: '#000', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>Add your first recipe</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {filtered.map(recipe => (
            <div key={recipe.id} onClick={() => navigate(`/recipes/${recipe.id}`)}
              style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = ''}
            >
              {recipe.image_url
                ? <img src={recipe.image_url} alt={recipe.title} style={{ width: '100%', height: 130, objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: 130, background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>🍽</div>
              }
              <div style={{ padding: '12px 14px 14px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{recipe.title}</div>
                <div style={{ color: '#555', fontSize: 12, marginBottom: 8 }}>{recipe.cuisine} · {recipe.difficulty}</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                  {recipe.prep_time > 0 && <span style={{ background: '#1E2A1E', color: '#00FF85', fontSize: 11, padding: '2px 7px', borderRadius: 99, fontWeight: 600 }}>⏱ {recipe.prep_time}m</span>}
                  {recipe.protein > 0 && <span style={{ background: '#2A1E2A', color: '#c084fc', fontSize: 11, padding: '2px 7px', borderRadius: 99, fontWeight: 600 }}>💪 {recipe.protein}g</span>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button onClick={() => navigate(`/cook/${recipe.id}`)} style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: '#00FF85', color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cook</button>
                  <button onClick={e => handleDelete(recipe.id, e)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #2A2A2A', background: 'transparent', color: '#555', fontSize: 12, cursor: 'pointer' }}>🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
ENDOFFILE

# ── src/pages/AddRecipePage.jsx ──────────────────────────────────────────────
cat > src/pages/AddRecipePage.jsx << 'ENDOFFILE'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecipes } from '../hooks/useRecipes.js'

export default function AddRecipePage() {
  const navigate = useNavigate()
  const { saveRecipe } = useRecipes()
  const [tab, setTab] = useState('url')
  const [url, setUrl] = useState('')
  const [aiPrompt, setAiPrompt] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [manual, setManual] = useState({
    title: '', cuisine: '', prep_time: '', cook_time: '', servings: '2',
    calories: '', protein: '', carbs: '', fat: '', cost_estimate: '',
    difficulty: 'Medium', description: '',
    ingredients: [{ name: '', quantity: '', unit: '' }],
    steps: [{ instruction: '', timer_seconds: '' }],
  })

  async function handleExtract() {
    if (!url) return
    setExtracting(true); setError('')
    try {
      const res = await fetch('/api/recipes/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPreview(data)
    } catch (e) { setError(e.message) }
    setExtracting(false)
  }

  async function handleGenerate() {
    if (!aiPrompt) return
    setExtracting(true); setError('')
    try {
      const res = await fetch('/api/recipes/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: aiPrompt }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPreview(data)
    } catch (e) { setError(e.message) }
    setExtracting(false)
  }

  async function handleSave() {
    setSaving(true)
    const recipe = tab === 'manual' ? { ...manual, prep_time: Number(manual.prep_time), cook_time: Number(manual.cook_time), servings: Number(manual.servings), calories: Number(manual.calories), protein: Number(manual.protein), carbs: Number(manual.carbs), fat: Number(manual.fat), cost_estimate: Number(manual.cost_estimate), goals: [] } : preview
    const saved = await saveRecipe(recipe)
    setSaving(false)
    if (saved) navigate('/recipes')
    else setError('Failed to save recipe')
  }

  const inputStyle = { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid #2A2A2A', background: '#111', color: '#fff', fontSize: 14, fontFamily: 'inherit', outline: 'none' }

  return (
    <div style={{ padding: 28, maxWidth: 680, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <button onClick={() => navigate('/recipes')} style={{ background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer' }}>←</button>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Add Recipe</h1>
      </div>
      <div style={{ display: 'flex', gap: 4, background: '#111', borderRadius: 12, padding: 4, marginBottom: 24 }}>
        {[['url', '🔗 From URL'], ['ai', '✦ AI Generate'], ['manual', '✏️ Manual']].map(([t, label]) => (
          <button key={t} onClick={() => { setTab(t); setPreview(null); setError('') }} style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', background: tab === t ? '#1A1A1A' : 'transparent', color: tab === t ? '#fff' : '#555', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
        ))}
      </div>

      {tab === 'url' && !preview && (
        <div>
          <p style={{ color: '#555', fontSize: 14, marginBottom: 16 }}>Paste a URL from any recipe website.</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input style={{ ...inputStyle, flex: 1 }} type="url" placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleExtract()} />
            <button onClick={handleExtract} disabled={extracting} style={{ padding: '11px 20px', borderRadius: 10, border: 'none', background: '#00FF85', color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>{extracting ? '...' : 'Extract'}</button>
          </div>
          {extracting && <div style={{ color: '#00FF85', fontSize: 13 }}>Reading recipe... ~10 seconds</div>}
          {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
        </div>
      )}

      {tab === 'ai' && !preview && (
        <div>
          <p style={{ color: '#555', fontSize: 14, marginBottom: 16 }}>Describe what you want and AI will create the full recipe.</p>
          <textarea style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} placeholder="e.g. High protein chicken bowl under 30 minutes..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} />
          <button onClick={handleGenerate} disabled={extracting || !aiPrompt} style={{ width: '100%', marginTop: 12, padding: '13px', borderRadius: 12, border: 'none', background: '#00FF85', color: '#000', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', opacity: (!aiPrompt || extracting) ? 0.6 : 1 }}>{extracting ? 'Generating...' : '✦ Generate Recipe'}</button>
          {error && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{error}</div>}
        </div>
      )}

      {tab === 'manual' && !preview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input style={inputStyle} placeholder="Recipe title" value={manual.title} onChange={e => setManual(m => ({ ...m, title: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input style={inputStyle} placeholder="Cuisine" value={manual.cuisine} onChange={e => setManual(m => ({ ...m, cuisine: e.target.value }))} />
            <input style={inputStyle} type="number" placeholder="Prep time (min)" value={manual.prep_time} onChange={e => setManual(m => ({ ...m, prep_time: e.target.value }))} />
            <input style={inputStyle} type="number" placeholder="Calories" value={manual.calories} onChange={e => setManual(m => ({ ...m, calories: e.target.value }))} />
            <input style={inputStyle} type="number" placeholder="Protein (g)" value={manual.protein} onChange={e => setManual(m => ({ ...m, protein: e.target.value }))} />
          </div>
          <div>
            <div style={{ color: '#555', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Ingredients</div>
            {manual.ingredients.map((ing, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input style={{ ...inputStyle, flex: 2 }} placeholder="Ingredient" value={ing.name} onChange={e => setManual(m => { const a = [...m.ingredients]; a[i] = { ...a[i], name: e.target.value }; return { ...m, ingredients: a } })} />
                <input style={{ ...inputStyle, flex: 1 }} placeholder="Amount" value={ing.quantity} onChange={e => setManual(m => { const a = [...m.ingredients]; a[i] = { ...a[i], quantity: e.target.value }; return { ...m, ingredients: a } })} />
              </div>
            ))}
            <button onClick={() => setManual(m => ({ ...m, ingredients: [...m.ingredients, { name: '', quantity: '', unit: '' }] }))} style={{ background: 'none', border: '1px dashed #2A2A2A', color: '#555', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>+ Add ingredient</button>
          </div>
          <div>
            <div style={{ color: '#555', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Steps</div>
            {manual.steps.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <span style={{ color: '#00FF85', fontWeight: 700, fontSize: 13, paddingTop: 12, minWidth: 20 }}>{i + 1}</span>
                <textarea style={{ ...inputStyle, flex: 1, minHeight: 60, resize: 'vertical' }} placeholder="Instruction..." value={step.instruction} onChange={e => setManual(m => { const a = [...m.steps]; a[i] = { ...a[i], instruction: e.target.value }; return { ...m, steps: a } })} />
              </div>
            ))}
            <button onClick={() => setManual(m => ({ ...m, steps: [...m.steps, { instruction: '', timer_seconds: '' }] }))} style={{ background: 'none', border: '1px dashed #2A2A2A', color: '#555', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>+ Add step</button>
          </div>
          <button onClick={handleSave} disabled={saving || !manual.title} style={{ padding: '14px', borderRadius: 12, border: 'none', background: '#00FF85', color: '#000', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', opacity: (!manual.title || saving) ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Save Recipe'}</button>
        </div>
      )}

      {preview && (
        <div>
          <div style={{ background: '#111', border: '1px solid #2A2A2A', borderRadius: 16, padding: 24, marginBottom: 20 }}>
            {preview.image_url && <img src={preview.image_url} alt={preview.title} style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 12, marginBottom: 16 }} />}
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{preview.title}</h2>
            <p style={{ color: '#666', fontSize: 14, marginBottom: 16 }}>{preview.description}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              <span style={{ background: '#1E2A1E', color: '#00FF85', fontSize: 12, padding: '4px 10px', borderRadius: 99, fontWeight: 600 }}>⏱ {preview.prep_time}m</span>
              <span style={{ background: '#2A1E2A', color: '#c084fc', fontSize: 12, padding: '4px 10px', borderRadius: 99, fontWeight: 600 }}>💪 {preview.protein}g</span>
              <span style={{ background: '#1A1A2A', color: '#60a5fa', fontSize: 12, padding: '4px 10px', borderRadius: 99, fontWeight: 600 }}>{preview.calories} kcal</span>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: '#555', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Ingredients</div>
              {preview.ingredients?.map((ing, i) => <div key={i} style={{ color: '#ccc', fontSize: 14, padding: '4px 0', borderBottom: '1px solid #1A1A1A' }}>{ing.quantity} {ing.unit} {ing.name}</div>)}
            </div>
            <div>
              <div style={{ color: '#555', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Steps</div>
              {preview.steps?.map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                  <span style={{ color: '#00FF85', fontWeight: 800, fontSize: 14, minWidth: 20 }}>{i + 1}</span>
                  <span style={{ color: '#ccc', fontSize: 14, lineHeight: 1.5 }}>{step.instruction}</span>
                </div>
              ))}
            </div>
          </div>
          {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setPreview(null)} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1px solid #2A2A2A', background: 'transparent', color: '#888', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>← Try Again</button>
            <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: '#00FF85', color: '#000', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>{saving ? 'Saving...' : '✓ Save Recipe'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
ENDOFFILE

# ── src/pages/RecipeDetailPage.jsx ──────────────────────────────────────────
cat > src/pages/RecipeDetailPage.jsx << 'ENDOFFILE'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRecipes } from '../hooks/useRecipes.js'

export default function RecipeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { fetchRecipeById } = useRecipes()
  const [recipe, setRecipe] = useState(null)

  useEffect(() => { fetchRecipeById(id).then(setRecipe) }, [id])

  if (!recipe) return <div style={{ padding: 28, color: '#555' }}>Loading...</div>

  return (
    <div style={{ padding: 28, maxWidth: 680, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button onClick={() => navigate('/recipes')} style={{ background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer' }}>←</button>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, flex: 1 }}>{recipe.title}</h1>
        <button onClick={() => navigate(`/cook/${recipe.id}`)} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#00FF85', color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Cook Now</button>
      </div>
      {recipe.image_url && <img src={recipe.image_url} alt={recipe.title} style={{ width: '100%', height: 280, objectFit: 'cover', borderRadius: 16, marginBottom: 20 }} />}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <span style={{ background: '#1E2A1E', color: '#00FF85', fontSize: 13, padding: '5px 12px', borderRadius: 99, fontWeight: 600 }}>⏱ {recipe.prep_time}m</span>
        <span style={{ background: '#2A1E2A', color: '#c084fc', fontSize: 13, padding: '5px 12px', borderRadius: 99, fontWeight: 600 }}>💪 {recipe.protein}g</span>
        <span style={{ background: '#1A1A2A', color: '#60a5fa', fontSize: 13, padding: '5px 12px', borderRadius: 99, fontWeight: 600 }}>{recipe.calories} kcal</span>
      </div>
      {recipe.description && <p style={{ color: '#888', fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>{recipe.description}</p>}
      <div style={{ marginBottom: 24 }}>
        <div style={{ color: '#555', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 12 }}>Ingredients</div>
        {recipe.ingredients?.map((ing, i) => <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #1A1A1A', fontSize: 14, color: '#ccc' }}><span style={{ color: '#fff', fontWeight: 600 }}>{ing.quantity} {ing.unit}</span> {ing.name}</div>)}
      </div>
      <div>
        <div style={{ color: '#555', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 16 }}>Instructions</div>
        {recipe.steps?.sort((a, b) => a.order_num - b.order_num).map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div style={{ width: 28, height: 28, borderRadius: 99, background: '#1A1A1A', border: '1px solid #2A2A2A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00FF85', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{i + 1}</div>
            <div>
              <p style={{ color: '#ccc', fontSize: 15, lineHeight: 1.6, margin: 0 }}>{step.instruction}</p>
              {step.timer_seconds && <span style={{ color: '#FFB347', fontSize: 12, marginTop: 4, display: 'block' }}>⏱ {Math.floor(step.timer_seconds / 60)} min</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
ENDOFFILE

# ── src/pages/CookModePage.jsx ───────────────────────────────────────────────
cat > src/pages/CookModePage.jsx << 'ENDOFFILE'
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRecipes } from '../hooks/useRecipes.js'

export default function CookModePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { fetchRecipeById } = useRecipes()
  const [recipe, setRecipe] = useState(null)
  const [step, setStep] = useState(0)
  const [timeLeft, setTimeLeft] = useState(null)
  const [running, setRunning] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    fetchRecipeById(id).then(r => { if (r) { setRecipe(r); setTimeLeft(r.steps?.[0]?.timer_seconds || null) } })
  }, [id])

  const steps = recipe?.steps?.sort((a, b) => a.order_num - b.order_num) || []
  const current = steps[step]

  useEffect(() => {
    if (!current) return
    setTimeLeft(current.timer_seconds || null)
    setRunning(false)
    clearInterval(timerRef.current)
  }, [step])

  useEffect(() => {
    if (running && timeLeft > 0) { timerRef.current = setInterval(() => setTimeLeft(t => t - 1), 1000) }
    else if (timeLeft === 0) setRunning(false)
    return () => clearInterval(timerRef.current)
  }, [running, timeLeft])

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  if (!recipe) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#555' }}>Loading...</div>

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <button onClick={() => navigate(-1)} style={{ position: 'fixed', top: 20, left: 20, background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#888', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
      <div style={{ textAlign: 'center', maxWidth: 580, width: '100%' }}>
        <div style={{ color: '#444', fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{recipe.title}</div>
        <div style={{ color: '#555', fontSize: 14, marginBottom: 24 }}>Step {step + 1} of {steps.length}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 32 }}>
          {steps.map((_, i) => <div key={i} onClick={() => setStep(i)} style={{ width: i === step ? 24 : 8, height: 8, borderRadius: 99, background: i <= step ? '#00FF85' : '#2A2A2A', transition: 'all 0.3s', cursor: 'pointer' }} />)}
        </div>
        <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 20, padding: '40px 48px', marginBottom: 32 }}>
          <p style={{ fontSize: 26, fontWeight: 600, color: '#fff', lineHeight: 1.5, margin: 0 }}>{current?.instruction}</p>
        </div>
        {current?.timer_seconds && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 56, fontWeight: 800, color: running ? '#00FF85' : '#fff', letterSpacing: '0.05em', transition: 'color 0.3s' }}>{fmt(timeLeft ?? current.timer_seconds)}</div>
            <button onClick={() => setRunning(r => !r)} style={{ marginTop: 12, padding: '12px 32px', borderRadius: 12, background: running ? '#2A2A2A' : '#00FF85', color: running ? '#fff' : '#000', border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {running ? '⏸ Pause' : timeLeft === 0 ? '✓ Done' : '▶ Start Timer'}
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} style={{ padding: '14px 28px', borderRadius: 12, border: '1px solid #2A2A2A', background: '#1A1A1A', color: step === 0 ? '#333' : '#fff', fontSize: 15, fontWeight: 600, cursor: step === 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}>← Back</button>
          {step < steps.length - 1
            ? <button onClick={() => setStep(s => s + 1)} style={{ padding: '14px 32px', borderRadius: 12, border: 'none', background: '#00FF85', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Next →</button>
            : <button onClick={() => navigate('/recipes')} style={{ padding: '14px 32px', borderRadius: 12, border: 'none', background: '#00FF85', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>🎉 Done!</button>
          }
        </div>
      </div>
    </div>
  )
}
ENDOFFILE

# ── src/pages/MacrosPage.jsx ─────────────────────────────────────────────────
cat > src/pages/MacrosPage.jsx << 'ENDOFFILE'
import { useState, useEffect } from 'react'
import { useRecipes } from '../hooks/useRecipes.js'

const TARGETS = {
  cut:      { calories: 1800, protein: 150, carbs: 150, fat: 60 },
  maintain: { calories: 2200, protein: 130, carbs: 220, fat: 73 },
  bulk:     { calories: 2800, protein: 180, carbs: 320, fat: 93 },
}

function Bar({ label, value, max, color }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#888', marginBottom: 6 }}>
        <span>{label}</span>
        <span style={{ color: '#fff', fontWeight: 600 }}>{value}g <span style={{ color: '#444' }}>/ {max}g</span></span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: '#2A2A2A' }}>
        <div style={{ width: `${Math.min((value / max) * 100, 100)}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.6s' }} />
      </div>
    </div>
  )
}

export default function MacrosPage() {
  const { fetchUserProfile, updateUserProfile } = useRecipes()
  const [goal, setGoal] = useState('maintain')
  const [saved, setSaved] = useState(false)

  useEffect(() => { fetchUserProfile().then(p => { if (p?.goal) setGoal(p.goal) }) }, [])

  async function handleSave(newGoal) {
    setGoal(newGoal)
    await updateUserProfile({ goal: newGoal })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const targets = TARGETS[goal]

  return (
    <div style={{ padding: 28, maxWidth: 560, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Macro Autopilot</h1>
      <p style={{ color: '#555', fontSize: 14, marginBottom: 28 }}>Set your goal once. Mise adjusts everything automatically.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['cut', 'maintain', 'bulk'].map(g => (
          <button key={g} onClick={() => handleSave(g)} style={{ flex: 1, padding: '13px 0', borderRadius: 12, border: 'none', background: goal === g ? '#00FF85' : '#1A1A1A', color: goal === g ? '#000' : '#888', fontWeight: 700, fontSize: 14, cursor: 'pointer', textTransform: 'capitalize', fontFamily: 'inherit' }}>{g}</button>
        ))}
      </div>
      {saved && <div style={{ color: '#00FF85', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>✓ Goal saved</div>}
      <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 16, padding: 24 }}>
        <div style={{ color: '#555', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20 }}>Daily Targets — {goal}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28 }}>
          {[['Calories', targets.calories, 'kcal', '#00FF85'], ['Protein', targets.protein, 'g', '#c084fc'], ['Carbs', targets.carbs, 'g', '#60a5fa'], ['Fat', targets.fat, 'g', '#fb923c']].map(([l, v, u, c]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: c }}>{v}<span style={{ fontSize: 12 }}>{u}</span></div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
        <Bar label="Protein" value={0} max={targets.protein} color="#c084fc" />
        <Bar label="Carbs" value={0} max={targets.carbs} color="#60a5fa" />
        <Bar label="Fat" value={0} max={targets.fat} color="#fb923c" />
      </div>
    </div>
  )
}
ENDOFFILE

# ── src/pages/FridgePage.jsx ─────────────────────────────────────────────────
cat > src/pages/FridgePage.jsx << 'ENDOFFILE'
import { useState, useEffect } from 'react'
import { useRecipes } from '../hooks/useRecipes.js'

export default function FridgePage() {
  const { fetchFridge, updateFridge } = useRecipes()
  const [ingredients, setIngredients] = useState([])
  const [newItem, setNewItem] = useState('')
  const [scanning, setScanning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    fetchFridge().then(data => { setIngredients(data.map(d => d.ingredient_name)); setLoading(false) })
  }, [])

  async function handleScan(file) {
    setScanning(true)
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/fridge/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: base64 }) })
      const data = await res.json()
      if (data.ingredients) {
        const merged = [...new Set([...ingredients, ...data.ingredients])]
        setIngredients(merged)
        await updateFridge(merged)
      }
    } catch (e) { console.error(e) }
    setScanning(false)
  }

  async function addItem() {
    if (!newItem.trim()) return
    const updated = [...new Set([...ingredients, newItem.trim().toLowerCase()])]
    setIngredients(updated)
    await updateFridge(updated)
    setNewItem('')
  }

  async function removeItem(item) {
    const updated = ingredients.filter(i => i !== item)
    setIngredients(updated)
    await updateFridge(updated)
  }

  return (
    <div style={{ padding: 28, maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Fridge</h1>
      <p style={{ color: '#555', fontSize: 14, marginBottom: 28 }}>Scan your fridge or add ingredients manually.</p>
      <div onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleScan(f) }}
        style={{ border: `2px dashed ${dragging ? '#00FF85' : '#2A2A2A'}`, borderRadius: 16, padding: '40px 24px', textAlign: 'center', background: dragging ? '#0A1A0E' : '#111', cursor: 'pointer', transition: 'all 0.2s', marginBottom: 24, position: 'relative' }}>
        <input type="file" accept="image/*" onChange={e => e.target.files[0] && handleScan(e.target.files[0])} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
        {scanning ? (
          <div><div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div><div style={{ color: '#00FF85', fontWeight: 700 }}>Scanning with AI...</div></div>
        ) : (
          <div><div style={{ fontSize: 36, marginBottom: 10 }}>📸</div><div style={{ color: '#fff', fontWeight: 700, marginBottom: 4 }}>Drop a fridge photo here</div><div style={{ color: '#555', fontSize: 13 }}>or click to upload — AI detects ingredients</div></div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input style={{ flex: 1, padding: '11px 14px', borderRadius: 10, border: '1px solid #2A2A2A', background: '#111', color: '#fff', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
          placeholder="Add ingredient manually..." value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem()} />
        <button onClick={addItem} style={{ padding: '11px 20px', borderRadius: 10, border: 'none', background: '#00FF85', color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Add</button>
      </div>
      {loading ? <div style={{ color: '#555', textAlign: 'center', padding: 32 }}>Loading...</div>
        : ingredients.length === 0 ? <div style={{ color: '#555', textAlign: 'center', padding: 32 }}>No ingredients yet</div>
        : (
          <div>
            <div style={{ color: '#555', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{ingredients.length} ingredients</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ingredients.map(ing => (
                <div key={ing} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 99, padding: '7px 14px' }}>
                  <span style={{ fontSize: 13, color: '#ccc', textTransform: 'capitalize' }}>{ing}</span>
                  <button onClick={() => removeItem(ing)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  )
}
ENDOFFILE

# ── src/pages/ChatPage.jsx ───────────────────────────────────────────────────
cat > src/pages/ChatPage.jsx << 'ENDOFFILE'
import { useState, useEffect, useRef } from 'react'
import { useRecipes } from '../hooks/useRecipes.js'

export default function ChatPage() {
  const { fetchUserProfile, fetchFridge, fetchRecipes } = useRecipes()
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hey! I'm your Mise cooking assistant. Ask me anything — recipe ideas, substitutions, or what to cook with what you have." }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState({})
  const bottomRef = useRef(null)

  useEffect(() => {
    Promise.all([fetchUserProfile(), fetchFridge(), fetchRecipes()]).then(([profile, fridge, recipes]) => {
      setContext({ goal: profile?.goal, fridge: fridge.map(f => f.ingredient_name), recipes: recipes.slice(0, 20) })
    })
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send() {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [...messages, userMsg], context }) })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.message || 'Sorry, something went wrong.' }])
    } catch { setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }]) }
    setLoading(false)
  }

  const SUGGESTIONS = ["What can I cook with chicken and rice?", "Give me a high protein breakfast idea", "How do I substitute butter in baking?"]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', maxWidth: 680, margin: '0 auto', padding: '28px 28px 0' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, flexShrink: 0 }}>AI Assistant</h1>
      <p style={{ color: '#555', fontSize: 14, marginBottom: 20, flexShrink: 0 }}>Ask anything about cooking or meal planning.</p>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 20 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
            <div style={{ maxWidth: '80%', padding: '12px 16px', borderRadius: 16, background: msg.role === 'user' ? '#00FF85' : '#1A1A1A', color: msg.role === 'user' ? '#000' : '#ccc', fontSize: 14, lineHeight: 1.6, borderBottomRightRadius: msg.role === 'user' ? 4 : 16, borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 16 }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && <div style={{ padding: '12px 16px', color: '#555', fontSize: 14 }}>Thinking...</div>}
        <div ref={bottomRef} />
      </div>
      {messages.length === 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, flexShrink: 0 }}>
          {SUGGESTIONS.map(s => <button key={s} onClick={() => setInput(s)} style={{ padding: '7px 14px', borderRadius: 99, border: '1px solid #2A2A2A', background: 'transparent', color: '#888', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{s}</button>)}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, paddingBottom: 24, flexShrink: 0, borderTop: '1px solid #1A1A1A', paddingTop: 16 }}>
        <input style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: '1px solid #2A2A2A', background: '#111', color: '#fff', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
          placeholder="Ask anything..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
        <button onClick={send} disabled={loading || !input.trim()} style={{ padding: '12px 20px', borderRadius: 12, border: 'none', background: input.trim() ? '#00FF85' : '#1A1A1A', color: input.trim() ? '#000' : '#555', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Send</button>
      </div>
    </div>
  )
}
ENDOFFILE

# ── server/index.js ──────────────────────────────────────────────────────────
cat > server/index.js << 'ENDOFFILE'
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { recipeRouter } from './routes/recipes.js'
import { fridgeRouter } from './routes/fridge.js'
import { chatRouter } from './routes/chat.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json({ limit: '10mb' }))
app.use('/api/recipes', recipeRouter)
app.use('/api/fridge', fridgeRouter)
app.use('/api/chat', chatRouter)
app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.listen(PORT, () => console.log(`Mise server running on http://localhost:${PORT}`))
ENDOFFILE

# ── server/routes/recipes.js ─────────────────────────────────────────────────
cat > server/routes/recipes.js << 'ENDOFFILE'
import { Router } from 'express'
import axios from 'axios'
import * as cheerio from 'cheerio'
import OpenAI from 'openai'

export const recipeRouter = Router()
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

recipeRouter.post('/extract', async (req, res) => {
  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'URL required' })
  try {
    const { data: html } = await axios.get(url, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } })
    const $ = cheerio.load(html)
    $('script, style, nav, footer, header, aside').remove()
    const pageText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 6000)
    const pageTitle = $('title').text() || 'Recipe'
    const imageUrl = $('meta[property="og:image"]').attr('content') || $('img').first().attr('src') || null

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `Extract the recipe from the webpage text and return ONLY valid JSON with this structure: { "title": string, "description": string, "cuisine": string, "difficulty": "Easy|Medium|Hard", "prep_time": number, "cook_time": number, "servings": number, "calories": number, "protein": number, "carbs": number, "fat": number, "cost_estimate": number, "goals": array, "ingredients": [{ "name": string, "quantity": string, "unit": string, "calories": number }], "steps": [{ "instruction": string, "timer_seconds": number|null }] }. If no recipe found return { "error": "No recipe found" }.` },
        { role: 'user', content: `Title: ${pageTitle}\n\n${pageText}` }
      ]
    })
    const parsed = JSON.parse(completion.choices[0].message.content)
    if (parsed.error) return res.status(422).json({ error: parsed.error })
    res.json({ ...parsed, source_url: url, image_url: imageUrl })
  } catch (err) {
    res.status(500).json({ error: 'Failed to extract recipe. Try a different URL.' })
  }
})

recipeRouter.post('/generate', async (req, res) => {
  const { prompt, goal, maxTime } = req.body
  if (!prompt) return res.status(400).json({ error: 'Prompt required' })
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `Generate a complete recipe and return ONLY valid JSON: { "title": string, "description": string, "cuisine": string, "difficulty": string, "prep_time": number, "cook_time": number, "servings": 2, "calories": number, "protein": number, "carbs": number, "fat": number, "cost_estimate": number, "goals": array, "ingredients": [{ "name": string, "quantity": string, "unit": string, "calories": number }], "steps": [{ "instruction": string, "timer_seconds": number|null }] }` },
        { role: 'user', content: `Create a recipe for: ${prompt}. ${goal ? `Goal: ${goal}.` : ''} ${maxTime ? `Max time: ${maxTime} min.` : ''}` }
      ]
    })
    const parsed = JSON.parse(completion.choices[0].message.content)
    res.json({ ...parsed, source_url: null, image_url: null })
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate recipe.' })
  }
})
ENDOFFILE

# ── server/routes/fridge.js ──────────────────────────────────────────────────
cat > server/routes/fridge.js << 'ENDOFFILE'
import { Router } from 'express'
import OpenAI from 'openai'

export const fridgeRouter = Router()
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

fridgeRouter.post('/scan', async (req, res) => {
  const { image } = req.body
  if (!image) return res.status(400).json({ error: 'Image required' })
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'List all food ingredients visible in this image. Return ONLY JSON: { "ingredients": ["item1", "item2"] }' }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}` } }] }],
      response_format: { type: 'json_object' },
      max_tokens: 500,
    })
    res.json(JSON.parse(response.choices[0].message.content))
  } catch (err) {
    res.status(500).json({ error: 'Failed to scan image.' })
  }
})
ENDOFFILE

# ── server/routes/chat.js ────────────────────────────────────────────────────
cat > server/routes/chat.js << 'ENDOFFILE'
import { Router } from 'express'
import OpenAI from 'openai'

export const chatRouter = Router()
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

chatRouter.post('/', async (req, res) => {
  const { messages, context } = req.body
  const systemPrompt = `You are Mise, a friendly AI cooking assistant. Help with recipe suggestions, cooking questions, substitutions, and meal planning.${context?.goal ? ` User goal: ${context.goal}.` : ''}${context?.fridge?.length ? ` Fridge: ${context.fridge.join(', ')}.` : ''} Be concise and practical.`
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 600,
    })
    res.json({ message: completion.choices[0].message.content })
  } catch (err) {
    res.status(500).json({ error: 'Chat failed.' })
  }
})
ENDOFFILE

echo ""
echo "✅ All files created!"
echo ""
echo "Next steps:"
echo "  1. Run: npm install"
echo "  2. Run: nano .env  and add your keys"
echo "  3. Set up Supabase (run supabase_schema.sql in SQL editor)"
echo "  4. Run: npm run dev"
