import { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import SkeletonCard from '../components/SkeletonCard.jsx'
import { useRecipes } from '../hooks/useRecipes.js'
import MacroHUD from '../components/shared/MacroHUD.jsx'
import { safeReadJsonResponse } from '../utils/safeReadJsonResponse.js'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
const TARGETS = {
  cut:      { calories: 1800, protein: 150, carbs: 150, fat: 60 },
  maintain: { calories: 2200, protein: 130, carbs: 220, fat: 73 },
  bulk:     { calories: 2800, protein: 180, carbs: 320, fat: 93 },
}

function getWeekStart() {
  const date = new Date()
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  return date.toISOString().split('T')[0]
}

function getTodayLabel() {
  const index = new Date().getDay()
  return DAYS[index === 0 ? 6 : index - 1]
}

function getDayDate(weekStart, dayIndex) {
  const date = new Date(weekStart)
  date.setDate(date.getDate() + dayIndex)
  return date.toISOString().split('T')[0]
}

function getCurrentSlotLabel() {
  const hour = new Date().getHours()
  if (hour < 11) return 'Breakfast'
  if (hour < 15) return 'Lunch'
  if (hour < 20) return 'Dinner'
  return 'Snack'
}

/* ── Design tokens (inline) ── */
const T = {
  base: '#0A0A0F',
  surface: '#111118',
  feature: '#13131F',
  s2: '#1A1A28',
  s3: '#1E1E30',
  border: '#2A2A38',
  borderActive: '#3A3A4E',
  text: '#F0F0F8',
  textSec: '#8888A8',
  textMuted: '#55556A',
  green: '#00FF85',
  purple: '#C084FC',
  amber: '#F59E0B',
  blue: '#60A5FA',
  red: '#F87171',
}

/* ── Reusable pill ── */
function Pill({ children, color = 'green', style }) {
  const styles = {
    green:  { bg: 'rgba(0,255,133,0.08)', color: '#B7F8D5' },
    purple: { bg: 'rgba(192,132,252,0.10)', color: '#DEC5FE' },
    amber:  { bg: 'rgba(245,158,11,0.10)', color: '#FCD34D' },
    blue:   { bg: 'rgba(96,165,250,0.10)', color: '#BFDBFE' },
    red:    { bg: 'rgba(248,113,113,0.10)', color: '#FECACA' },
    muted:  { bg: T.s2, color: T.textSec },
  }
  const s = styles[color] || styles.muted
  return (
    <span style={{
      borderRadius: 99, padding: '3px 8px',
      fontSize: 11, fontWeight: 600, letterSpacing: '0.03em',
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: s.bg, color: s.color,
      border: 'none',
      ...style,
    }}>
      {children}
    </span>
  )
}

/* ── Dot indicator ── */
function Dot({ color = T.green, size = 8 }) {
  return <span style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
}

/* ── Card wrapper ── */
function Card({ children, style, className }) {
  return (
    <div className={['dashboard-card', className].filter(Boolean).join(' ')} style={style}>
      {children}
    </div>
  )
}

/* ── Section label ── */
function Label({ children }) {
  return (
    <div className="dashboard-section-label" style={{ marginBottom: 8 }}>
      {children}
    </div>
  )
}

function getFilterTagStyle(label = '') {
  const normalized = label.toLowerCase()

  if (normalized.includes('vegetarian') || normalized.includes('vegan') || normalized.includes('plant')) {
    return { background: '#1A2A1A', color: '#86EFAC' }
  }

  if (normalized.includes('peanut') || normalized.includes('nut') || normalized.includes('shellfish')) {
    return { background: '#2A1A0A', color: '#FCD34D' }
  }

  if (normalized.includes('gluten') || normalized.includes('celiac')) {
    return { background: '#142033', color: '#93C5FD' }
  }

  if (normalized.includes('dairy') || normalized.includes('lactose')) {
    return { background: '#251A2B', color: '#F0ABFC' }
  }

  if (normalized.includes('diabetes') || normalized.includes('sugar')) {
    return { background: '#12242A', color: '#67E8F9' }
  }

  if (normalized.includes('hypertension') || normalized.includes('sodium')) {
    return { background: '#23171A', color: '#FDA4AF' }
  }

  return { background: '#1A1A28', color: '#A8A8BF' }
}

function qaSlug(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildEmptyRecommendation(profile, fridgeIngredients, recipes) {
  const activeConstraints = [
    ...(profile?.dietary_preferences || []),
    ...(profile?.allergies || []),
    ...(profile?.health_conditions || []),
  ].filter(Boolean)

  return {
    empty: true,
    title: 'No dinner match right now',
    description: `Ruokanna checked ${recipes.length} saved recipes against your ${profile?.goal || 'maintain'} goal${fridgeIngredients.length ? ` and ${fridgeIngredients.length} fridge items` : ''}.`,
    prep_time: 0,
    cook_time: 0,
    protein: 0,
    fit_analysis: {
      reasons: activeConstraints.length
        ? [`Current filters: ${activeConstraints.join(', ')}`]
        : ['Try loosening filters, adding recipes, or scanning more fridge items.'],
      fridge_match_score: 0,
    },
  }
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const {
    fetchMealPlan, fetchRecipes, fetchUserProfile, fetchFridge, fetchWeeklyMacros,
    setMealPlanSlot, clearMealPlanSlot, recommendRecipe, getSwapAlternatives,
    toggleMealLeftovers, getMealMeta, setMealStatus, scoreRecipeByFridge, sortRecipes,
  } = useRecipes()

  const weekStart = getWeekStart()
  const [activeDay, setActiveDay] = useState(getTodayLabel())
  const [mealPlan, setMealPlan] = useState({})
  const [mealMetaMap, setMealMetaMap] = useState({})
  const [recipes, setRecipes] = useState([])
  const [profile, setProfile] = useState(null)
  const [weeklyMacros, setWeeklyMacros] = useState({ days: [], totals: { cost: 0 } })
  const [fridgeIngredients, setFridgeIngredients] = useState([])
  const [showPicker, setShowPicker] = useState(null)
  const [showSwap, setShowSwap] = useState(null)
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerSort, setPickerSort] = useState('fridge-match')
  const [loading, setLoading] = useState(true)
  const [savingSlot, setSavingSlot] = useState(false)
  const [pulseRing, setPulseRing] = useState(null)
  const prevStatsRef = useRef(null)
  const [autoPlanning, setAutoPlanning] = useState(false)
  const [heroRecommendation, setHeroRecommendation] = useState(null)
  const [heroLoading, setHeroLoading] = useState(false)
  const [error, setError] = useState('')
  const [swapTab, setSwapTab] = useState('All')
  const [showGrocery, setShowGrocery] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [planData, recipesData, profileData, fridgeData, macroData] = await Promise.all([
        fetchMealPlan(weekStart),
        fetchRecipes(),
        fetchUserProfile(),
        fetchFridge(),
        fetchWeeklyMacros(weekStart),
      ])
      const fridgeNames = (fridgeData || []).map((item) => item.ingredient_name)
      const enhancedRecipes = (recipesData || []).map((recipe) => ({
        ...recipe,
        fridge_match_score: scoreRecipeByFridge(recipe, fridgeNames),
      }))
      const shapedPlan = {}
      const shapedMeta = {}
      ;(planData || []).forEach((entry) => {
        const dayIndex = DAYS.findIndex((_, index) => getDayDate(weekStart, index) === entry.date)
        if (dayIndex >= 0 && entry.recipe) shapedPlan[`${DAYS[dayIndex]}-${entry.slot}`] = entry.recipe
        if (dayIndex >= 0) shapedMeta[`${DAYS[dayIndex]}-${entry.slot}`] = entry.local_meta || getMealMeta(entry.date, entry.slot)
      })
      setProfile(profileData)
      setFridgeIngredients(fridgeNames)
      setRecipes(enhancedRecipes)
      setMealPlan(shapedPlan)
      setMealMetaMap(shapedMeta)
      setWeeklyMacros(macroData)
    } catch (loadError) {
      setError(loadError.message || 'Failed to load dashboard data.')
    }
    setLoading(false)
  }

  async function handlePickMeal(day, slot, recipe) {
    setSavingSlot(true)
    setError('')
    const date = getDayDate(weekStart, DAYS.indexOf(day))
    const ok = await setMealPlanSlot(date, slot, recipe.id)
    if (ok) { setShowPicker(null); setShowSwap(null); await loadData() }
    else setError('Could not save that meal slot.')
    setSavingSlot(false)
  }

  async function handleClearMeal(day, slot) {
    setSavingSlot(true)
    setError('')
    const date = getDayDate(weekStart, DAYS.indexOf(day))
    const ok = await clearMealPlanSlot(date, slot)
    if (ok) await loadData()
    else setError('Could not clear that meal slot.')
    setSavingSlot(false)
  }

  async function handleAutoPlan() {
    setAutoPlanning(true)
    setError('')
    try {
      const response = await fetch('/api/recipes/autoplan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, days: 7, existingRecipes: recipes }),
      })
      const plan = await safeReadJsonResponse(response, 'Auto-plan returned an invalid response.')
      if (!response.ok) throw new Error(plan.error || 'Failed to auto-plan week.')
      for (const day of DAYS) {
        for (const slot of SLOTS) {
          const date = getDayDate(weekStart, DAYS.indexOf(day))
          const recipeId = plan?.[day]?.[slot]
          if (recipeId) await setMealPlanSlot(date, slot, recipeId)
          else await clearMealPlanSlot(date, slot)
        }
      }
      await loadData()
    } catch (autoPlanError) {
      setError(autoPlanError.message || 'Failed to auto-plan week.')
    }
    setAutoPlanning(false)
  }

  async function handleJustTellMe() {
    setHeroLoading(true)
    setError('')
    try {
      const response = await fetch('/api/planner/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipes, profile, fridgeIngredients, slot: 'Dinner' }),
      })
      const data = await safeReadJsonResponse(response, 'Recommendation service returned an invalid response.')
      if (!response.ok) throw new Error(data.error || 'Failed to generate a dinner recommendation.')
      setHeroRecommendation(data.recommendation || buildEmptyRecommendation(profile, fridgeIngredients, recipes))
    } catch (recommendationError) {
      const localRecommendation = recommendRecipe({ recipes, profile: profile || {}, fridgeIngredients, slot: 'Dinner' })
      if (localRecommendation) setHeroRecommendation(localRecommendation)
      else {
        setHeroRecommendation(buildEmptyRecommendation(profile, fridgeIngredients, recipes))
        setError('')
      }
    }
    setHeroLoading(false)
  }

  async function handleSwapMeal(day, slot, meal) {
    setError('')
    try {
      const response = await fetch('/api/planner/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentRecipe: meal, recipes, profile, fridgeIngredients }),
      })
      const data = await safeReadJsonResponse(response, 'Swap ideas returned an invalid response.')
      if (!response.ok) throw new Error(data.error || 'Failed to load swap ideas.')
      setShowSwap({ day, slot, meal, alternatives: data.alternatives || [] }); setSwapTab('All')
    } catch {
      setShowSwap({ day, slot, meal, alternatives: getSwapAlternatives({ currentRecipe: meal, recipes, profile: profile || {}, fridgeIngredients }) }); setSwapTab('All')
    }
  }

  async function handleToggleLeftover(day, slot, meal) {
    const date = getDayDate(weekStart, DAYS.indexOf(day))
    const currentMeta = mealMetaMap[`${day}-${slot}`] || {}
    const nextEnabled = !currentMeta.leftovers
    toggleMealLeftovers(date, slot, nextEnabled, meal)
    if (nextEnabled) {
      const dayIndex = DAYS.indexOf(day)
      const nextDay = DAYS[dayIndex + 1]
      if (nextDay) { const nextDate = getDayDate(weekStart, dayIndex + 1); await setMealPlanSlot(nextDate, 'Lunch', meal.id) }
    }
    await loadData()
  }

  async function handleMealStatus(day, slot, status) {
    const date = getDayDate(weekStart, DAYS.indexOf(day))
    setMealStatus(date, slot, status)
    await loadData()
  }

  /* ── Derived values ── */
  const goal = profile?.goal || 'maintain'
  const targets = TARGETS[goal] || TARGETS.maintain
  const activeDayMeals = SLOTS.map((slot) => ({ slot, meal: mealPlan[`${activeDay}-${slot}`] || null }))
  const activeDayStats = weeklyMacros.days.find((day) => day.day === activeDay) || { calories: 0, protein: 0, carbs: 0, fat: 0, cost: 0 }
  
  useEffect(() => {
    if (prevStatsRef.current && prevStatsRef.current.calories !== activeDayStats.calories) {
      setPulseRing('all')
      const timer = setTimeout(() => setPulseRing(null), 1200)
      return () => clearTimeout(timer)
    }
    prevStatsRef.current = activeDayStats
  }, [activeDayStats.calories])

  const activeDayDinner = mealPlan[`${activeDay}-Dinner`] || null
  const currentSlot = getCurrentSlotLabel()
  const activeDayRecommendation = recommendRecipe({ recipes, profile: profile || {}, fridgeIngredients, slot: 'Dinner' })
  const focusMeal = mealPlan[`${activeDay}-${currentSlot}`] || activeDayDinner || activeDayRecommendation || null
  const guardrailItems = [
    ...(profile?.dietary_preferences || []),
    ...(profile?.allergies || []),
    ...(profile?.health_conditions || []),
  ]

  const pickerRecipes = useMemo(() => {
    const s = pickerSearch.trim().toLowerCase()
    const searched = recipes.filter((recipe) => {
      if (!s) return true
      return [recipe.title, recipe.cuisine, recipe.description, recipe.tags?.join(' ')].join(' ').toLowerCase().includes(s)
    })
    return sortRecipes(searched, pickerSort)
  }, [pickerSearch, pickerSort, recipes, sortRecipes])

  /* ── Provenance data (ingredients from today's meals) ── */
  const provenanceRows = useMemo(() => {
    const rows = []
    const fridgeSet = new Set((fridgeIngredients || []).map((n) => n.toLowerCase()))
    activeDayMeals.forEach(({ slot, meal }) => {
      if (!meal) return
      const ingredients = Array.isArray(meal.ingredients)
        ? meal.ingredients.map((ing) => (typeof ing === 'string' ? ing : ing.name || ing.ingredient_name || String(ing)))
        : []
      ingredients.slice(0, 4).forEach((ing) => {
        const inFridge = fridgeSet.has(ing.toLowerCase())
        rows.push({
          ingredient: ing,
          slot,
          protein: meal.protein ? `${Math.round(meal.protein / Math.max(ingredients.length, 1))}g` : '—',
          confidence: inFridge ? 95 : 75,
          status: inFridge ? 'Fridge' : 'Recipe',
        })
      })
    })
    return rows.slice(0, 12)
  }, [activeDayMeals, fridgeIngredients])

  /* ── Intelligence feed items ── */
  const feedItems = useMemo(() => {
    const { calories, protein, carbs } = activeDayStats
    const carbPct = targets.carbs > 0 ? Math.round((carbs / targets.carbs) * 100) : 0
    const carbStatus = carbPct > 110 ? 'over' : carbPct > 90 ? 'on track' : 'under'
    return [
      {
        tag: 'Carbs', tagColor: 'amber', dotColor: T.amber,
        text: `${Math.round(carbs)}/${targets.carbs}g carbs — ${carbStatus} for ${goal}`,
      },
      {
        tag: 'Protein', tagColor: 'purple', dotColor: T.purple,
        text: `${Math.round(protein)}g protein logged — ${Math.max(0, targets.protein - Math.round(protein))}g remaining today`,
      },
      {
        tag: 'Calories', tagColor: 'green', dotColor: T.green,
        text: `${Math.round(calories)} of ${targets.calories} kcal used — ${Math.round((calories / targets.calories) * 100)}% of daily target`,
      },
    ]
  }, [activeDayStats, targets, goal])

  /* ── AI insight text for hero card ── */
  const aiInsightText = useMemo(() => {
    if (!focusMeal) return 'No meal selected for this slot. Use the meal picker to plan ahead.'
    const fridgeNote = focusMeal.fridge_match_score > 0
      ? ` · uses ~${Math.round(focusMeal.fridge_match_score / 10)} fridge items`
      : ''
    return `Matches your ${targets.protein}g protein goal${fridgeNote} · aligned with ${goal} strategy`
  }, [focusMeal, targets, goal])

  /* ── Grocery list (aggregate ingredients from full week) ── */
  const groceryList = useMemo(() => {
    const map = {}
    Object.values(mealPlan).forEach((meal) => {
      if (!meal || !Array.isArray(meal.ingredients)) return
      meal.ingredients.forEach((ing) => {
        const name = typeof ing === 'string' ? ing : (ing.name || ing.ingredient_name || String(ing))
        const qty = typeof ing === 'object' ? (Number(ing.quantity) || 0) : 0
        const unit = typeof ing === 'object' ? (ing.unit || '') : ''
        const key = name.toLowerCase().trim()
        if (!key) return
        if (!map[key]) {
          map[key] = { name: name.trim(), quantity: qty, unit, category: ing.category || '' }
        } else if (unit && map[key].unit === unit) {
          map[key].quantity += qty
        }
      })
    })
    const rows = Object.values(map).sort((a, b) => {
      if (a.category && b.category && a.category !== b.category) return a.category.localeCompare(b.category)
      return a.name.localeCompare(b.name)
    })
    return rows
  }, [mealPlan])

  function groceryToText() {
    return groceryList.map((item) => {
      const qty = item.quantity > 0 ? `${item.quantity}${item.unit ? ' ' + item.unit : ''} ` : ''
      return `${qty}${item.name}`
    }).join('\n')
  }

  /* ── Cuisine gradient for missing images ── */
  function cuisineGradient(name = '') {
    const presets = [
      'linear-gradient(135deg,#1A1A24,#22222E)',
      'linear-gradient(135deg,#1A2A1A,#0A2A1A)',
      'linear-gradient(135deg,#2A1A2A,#1E0A2A)',
      'linear-gradient(135deg,#2A2A1A,#2A1A0A)',
      'linear-gradient(135deg,#1A2A2A,#0A1A2A)',
    ]
    const hash = name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
    return presets[hash % presets.length]
  }

  /* ─────────────────────────────────────────────────────────────────────────
     RENDER
  ──────────────────────────────────────────────────────────────────────────── */
  return (
    <div data-qa="dashboard-page" style={{ padding: '24px 28px', maxWidth: 1320, margin: '0 auto' }}>

      {/* ── Header strip ── */}
      <div className="t-fade-1" style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between',
        alignItems: 'flex-end', gap: 18, marginBottom: 32,
      }}>
        <div>
          <Label>Tactical Dashboard</Label>
          <h1 style={{ fontSize: 34, fontWeight: 800, margin: '4px 0 0', letterSpacing: '-0.03em', color: T.text }}>
            Weekly Planner
          </h1>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <Dot color={T.green} size={8} />
              <span style={{ color: T.text, fontWeight: 700 }}>{Math.round(activeDayStats.calories)}</span>
              <span style={{ color: T.textMuted }}>/ {targets.calories} kcal</span>
            </div>
            <div style={{ width: 1, height: 18, background: T.border }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <Dot color={T.amber} size={8} />
              <span style={{ color: T.text, fontWeight: 700 }}>${Number(weeklyMacros.totals?.cost || 0).toFixed(2)}</span>
              <span style={{ color: T.textMuted }}>/ wk</span>
            </div>
          </div>

          <button
            data-qa="dashboard-grocery-open"
            onClick={() => setShowGrocery(true)}
            className="t-btn-ghost"
            style={{ borderRadius: 99, padding: '9px 18px', fontSize: 13, fontWeight: 700 }}
          >
            Grocery List
          </button>

          <button
            data-qa="dashboard-auto-plan"
            onClick={handleAutoPlan}
            disabled={autoPlanning || !recipes.length}
            className="t-btn-ghost"
            style={{ opacity: autoPlanning || !recipes.length ? 0.5 : 1, borderRadius: 99, padding: '9px 18px', fontSize: 13, fontWeight: 700 }}
          >
            {autoPlanning ? 'Planning…' : 'Auto-plan'}
          </button>

        </div>
      </div>

      {error && (
        <div data-qa="dashboard-error" style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 12, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: T.red, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading ? (
        <div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 24 }}>
            {DAYS.map((day) => (
              <div key={day} style={{ minWidth: 80, height: 52, borderRadius: 99, border: `1px solid ${T.border}`, background: T.s2, animation: 'misePulse 1.4s ease-in-out infinite' }} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 }}>
            {SLOTS.map((slot) => <SkeletonCard key={slot} />)}
          </div>
        </div>

      /* ── Empty state ── */
      ) : recipes.length === 0 ? (
        <div className="dashboard-card" style={{ textAlign: 'center', padding: 38 }}>
          <div style={{ fontSize: 46, marginBottom: 14 }}>🍳</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px', color: T.text }}>Build your first recipe library</h2>
          <p style={{ color: T.textSec, fontSize: 15, margin: '0 0 20px', lineHeight: 1.6 }}>
            Once you save a few recipes, Ruokanna can fill your week, track your macros, and match meals to what's already in your fridge.
          </p>
          <button onClick={() => navigate('/recipes/add')} className="t-btn-primary" style={{ padding: '12px 24px', borderRadius: 12 }}>
            Add your first recipe
          </button>
        </div>

      ) : (
        <>
          {/* ── Day tabs ── */}
          <div className="t-fade-2" style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
            {DAYS.map((day) => {
              const summary = weeklyMacros.days.find((item) => item.day === day) || { calories: 0 }
              const selected = activeDay === day
              return (
                <div key={day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button data-qa={`dashboard-day-${qaSlug(day)}`} data-selected={selected ? 'true' : 'false'} onClick={() => setActiveDay(day)} style={{
                    width: 44, height: 44, borderRadius: 99,
                    border: 'none',
                    background: selected ? T.green : T.surface,
                    color: selected ? '#000' : T.textMuted,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.15s ease, color 0.15s ease',
                    fontSize: 13,
                    fontWeight: selected ? 800 : 600,
                  }}>
                    {day}
                  </button>
                  <div style={{
                    width: 4, height: 4, borderRadius: '50%',
                    background: summary.calories > 0
                      ? (selected ? '#000' : T.textMuted)
                      : (selected ? '#000' : T.s2),
                  }} />
                </div>
              )
            })}
          </div>

          {/* ══ ROW 1: Decision Card + Daily Intelligence ══ */}
          <div className="t-fade-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18, marginBottom: 18, alignItems: 'stretch' }}>

            {/* ── Decision Card (hero meal) ── */}
            <div data-qa="dashboard-hero" className="dashboard-card dashboard-card--featured" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'relative', height: 280, flexShrink: 0 }}>
                {focusMeal?.image_url ? (
                  <img
                    src={focusMeal.image_url}
                    alt={focusMeal.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '16px 16px 0 0' }}
                  />
                ) : (
                  <div style={{
                    width: '100%', height: '100%',
                    background: cuisineGradient(focusMeal?.cuisine),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 40,
                    borderRadius: '16px 16px 0 0',
                  }}>
                    🍽
                  </div>
                )}
                <div style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 140,
                  background: 'linear-gradient(to top, rgba(10,10,15,0.95) 0%, transparent 100%)',
                }} />
                <div style={{
                  position: 'absolute',
                  left: 20,
                  right: 20,
                  bottom: 80,
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.02,
                  color: '#FFFFFF',
                }}>
                  {focusMeal?.title || 'No focus meal yet'}
                </div>
                <div style={{
                  position: 'absolute',
                  left: 20,
                  right: 20,
                  bottom: 48,
                  display: 'flex',
                  gap: 6,
                  flexWrap: 'wrap',
                }}>
                  {focusMeal ? (
                    <>
                      <Pill color="green" style={{ background: 'rgba(10,10,15,0.62)', color: '#D8FCE9' }}>{focusMeal.prep_time + focusMeal.cook_time} min</Pill>
                      <Pill color="purple" style={{ background: 'rgba(10,10,15,0.62)', color: '#EBD9FE' }}>{focusMeal.protein}g protein</Pill>
                      <Pill color="blue" style={{ background: 'rgba(10,10,15,0.62)', color: '#D7EAFE' }}>{focusMeal.source_label || 'recipe'}</Pill>
                    </>
                  ) : (
                    <Pill color="muted" style={{ background: 'rgba(10,10,15,0.62)', color: '#C7C7D8' }}>No meal scheduled</Pill>
                  )}
                </div>
              </div>

              <div style={{ padding: '24px 28px 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p className="dashboard-body" style={{ margin: 0, flex: 1 }}>
                  {(focusMeal?.fit_analysis?.reasons || activeDayRecommendation?.fit_analysis?.reasons || []).length
                    ? (focusMeal?.fit_analysis?.reasons || activeDayRecommendation?.fit_analysis?.reasons).join(' • ')
                    : 'Ruokanna is ready to pick a meal based on your fridge, goal, and health filters.'}
                </p>

                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.amber, marginBottom: 6 }}>
                    AI REASONING
                  </div>
                  <div style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.6, fontStyle: 'italic' }}>{aiInsightText}</div>
                </div>

                {focusMeal && (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => navigate(`/recipes/${focusMeal.id}`)} style={{
                      flex: 1,
                      height: 44,
                      borderRadius: 10,
                      border: `1px solid ${T.border}`,
                      background: 'transparent',
                      color: T.textSec,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}>
                      Open details
                    </button>
                    <button onClick={() => navigate(`/cook/${focusMeal.id}`)} style={{
                      flex: 1,
                      height: 44,
                      borderRadius: 10,
                      border: 'none',
                      background: T.green,
                      color: '#000',
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}>
                      Cook now
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Daily Intelligence ── */}
            <div data-qa="dashboard-macro-progress" className="dashboard-card dashboard-card--featured" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <Label>Daily Macro Progress</Label>
                <MacroHUD
                  calories={activeDayStats.calories} calTarget={targets.calories}
                  protein={activeDayStats.protein} proTarget={targets.protein}
                  carbs={activeDayStats.carbs} carbTarget={targets.carbs}
                  size={140}
                  pulseRing={pulseRing}
                />
              </div>

              <div style={{ height: 1, background: T.s2 }} />

              <div>
                <Label>Intelligence Feed</Label>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {feedItems.map((item, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: '14px 0',
                      borderBottom: i === feedItems.length - 1 ? 'none' : `1px solid ${T.s2}`,
                    }}>
                      <Dot color={item.dotColor} size={10} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ marginBottom: 4, fontWeight: 700, fontSize: 13, color: T.text }}>{item.tag}</div>
                        <p style={{ margin: 0, fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>{item.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ══ ROW 2: Fridge Ready · Meal Slots · Guardrails ══ */}
          <div className="t-fade-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, marginBottom: 18, alignItems: 'start' }}>

            {/* ── Fridge Ready ── */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                <Label>Fridge Ready</Label>
                <span style={{ color: T.text, fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em' }}>
                  {fridgeIngredients.length}
                </span>
              </div>
              <p className="dashboard-body" style={{ margin: '0 0 14px' }}>
                {recipes.filter((recipe) => recipe.fridge_match_score > 0).length} recipes already match your fridge, with a {profile?.time_budget_minutes || 30} minute time budget saved to your profile.
              </p>
              {fridgeIngredients.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                  {fridgeIngredients.slice(0, 4).map((ing) => (
                    <span key={ing} style={{
                      background: T.s2,
                      border: 'none',
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 11,
                      color: T.textSec,
                    }}>{ing}</span>
                  ))}
                  {fridgeIngredients.length > 4 && (
                    <span style={{ fontSize: 11, color: T.textMuted, padding: '2px 0' }}>+{fridgeIngredients.length - 4} more</span>
                  )}
                </div>
              )}
              <button onClick={() => navigate('/fridge')} style={{
                padding: 0,
                border: 'none',
                background: 'transparent',
                color: T.green,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
              }}>
                Manage fridge →
              </button>
            </Card>

            {/* ── Meal Slots grid ── */}
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                {activeDayMeals.map(({ slot, meal }) => (
                  <div data-qa={`meal-card-${qaSlug(activeDay)}-${qaSlug(slot)}`} key={slot} className="dashboard-card" style={{ padding: 0, overflow: 'hidden', minHeight: 248, opacity: mealMetaMap[`${activeDay}-${slot}`]?.leftovers ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                    {meal ? (
                      <>
                        <div style={{ position: 'relative' }}>
                          {meal.image_url ? (
                            <img src={meal.image_url} alt={meal.title} style={{ width: '100%', height: 128, objectFit: 'cover', display: 'block' }} />
                          ) : (
                            <div style={{ width: '100%', height: 128, background: cuisineGradient(meal.cuisine), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🍽</div>
                          )}
                          <span style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(10,10,15,0.78)', color: T.textSec, fontSize: 10, padding: '4px 8px', borderRadius: 99, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{slot}</span>
                          <button data-qa={`meal-clear-${qaSlug(activeDay)}-${qaSlug(slot)}`} onClick={() => handleClearMeal(activeDay, slot)} disabled={savingSlot} style={{ position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 99, border: 'none', background: 'rgba(10,10,15,0.78)', color: T.textSec, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                        </div>
                        <div style={{ padding: '18px 20px 20px' }}>
                          <div data-qa="meal-card-title" className="dashboard-card-title" style={{ marginBottom: 10 }}>{meal.title}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                            <Pill color="green">{meal.prep_time + meal.cook_time} min</Pill>
                            <Pill color="purple">{meal.protein}g</Pill>
                            <Pill color="amber">€{Number(meal.cost_estimate || 0).toFixed(2)}</Pill>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                            <button data-qa={`meal-leftovers-${qaSlug(activeDay)}-${qaSlug(slot)}`} onClick={() => handleToggleLeftover(activeDay, slot, meal)} style={{ padding: '6px 10px', borderRadius: 99, border: 'none', background: mealMetaMap[`${activeDay}-${slot}`]?.leftovers ? 'rgba(245,158,11,0.12)' : T.s2, color: mealMetaMap[`${activeDay}-${slot}`]?.leftovers ? T.amber : T.textSec, cursor: 'pointer', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                              {mealMetaMap[`${activeDay}-${slot}`]?.leftovers ? <>Leftovers <span style={{fontSize:12}}>⤿</span></> : 'Leftovers'}
                            </button>
                            <button data-qa={`meal-cooked-${qaSlug(activeDay)}-${qaSlug(slot)}`} onClick={() => handleMealStatus(activeDay, slot, 'cooked')} style={{ padding: '6px 10px', borderRadius: 99, border: 'none', background: mealMetaMap[`${activeDay}-${slot}`]?.status === 'cooked' ? 'rgba(0,255,133,0.12)' : T.s2, color: mealMetaMap[`${activeDay}-${slot}`]?.status === 'cooked' ? T.green : T.textSec, cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>
                              Cooked
                            </button>
                            <button data-qa={`meal-skipped-${qaSlug(activeDay)}-${qaSlug(slot)}`} onClick={() => handleMealStatus(activeDay, slot, 'skipped')} style={{ padding: '6px 10px', borderRadius: 99, border: 'none', background: mealMetaMap[`${activeDay}-${slot}`]?.status === 'skipped' ? 'rgba(248,113,113,0.12)' : T.s2, color: mealMetaMap[`${activeDay}-${slot}`]?.status === 'skipped' ? T.red : T.textSec, cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>
                              Skipped
                            </button>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button data-qa={`meal-cook-${qaSlug(activeDay)}-${qaSlug(slot)}`} onClick={() => navigate(`/cook/${meal.id}`)} style={{ flex: 1, height: 38, borderRadius: 10, border: 'none', background: T.green, color: '#000', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Cook</button>
                            <button data-qa={`meal-swap-${qaSlug(activeDay)}-${qaSlug(slot)}`} onClick={() => handleSwapMeal(activeDay, slot, meal)} style={{ minWidth: 74, height: 38, borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', color: T.textSec, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Swap</button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div style={{ height: '100%', minHeight: 248, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: '24px 28px', textAlign: 'center', background: 'transparent' }}>
                        <div className="dashboard-section-label" style={{ marginBottom: 10 }}>{slot}</div>
                        <div style={{ fontSize: 22, marginBottom: 12, color: T.border }}>+</div>
                        <button data-qa={`dashboard-add-meal-${qaSlug(activeDay)}-${qaSlug(slot)}`} onClick={() => setShowPicker({ day: activeDay, slot })} style={{ padding: '8px 14px', borderRadius: 99, border: 'none', background: T.s2, color: T.textSec, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                          Add meal
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Active Guardrails ── */}
            <Card>
              <Label>Health Filters</Label>
              <div className="dashboard-card-title" style={{ marginBottom: 12 }}>
                {guardrailItems.length ? 'Active guardrails' : 'Not configured'}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {guardrailItems.slice(0, 6).map((item) => {
                  const pillStyle = getFilterTagStyle(item)
                  return (
                    <span key={item} style={{
                      borderRadius: 99,
                      padding: '3px 9px',
                      fontSize: 11,
                      fontWeight: 600,
                      border: 'none',
                      background: pillStyle.background,
                      color: pillStyle.color,
                    }}>
                      {item}
                    </span>
                  )
                })}
              </div>
              <p className="dashboard-body" style={{ margin: '0 0 14px' }}>
                {guardrailItems.join(' · ') || 'Set dietary preferences, allergies, and health conditions to filter recommendations.'}
              </p>
              <button onClick={() => navigate('/macros')} style={{
                padding: 0,
                border: 'none',
                background: 'transparent',
                color: T.textSec,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
              }}>
                Edit filters →
              </button>
            </Card>
          </div>

          {/* ══ ROW 3: Provenance Engine ══ */}
          <div className="t-fade-5 dashboard-card" style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 14 }}>
              <Label>Provenance Engine</Label>
              <div className="dashboard-card-title">Ingredient confidence tracking for today's meals</div>
            </div>

            {provenanceRows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 12px', color: T.textMuted, fontSize: 13 }}>
                No ingredients to track — add meals to your day to see provenance data.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'DM Sans, sans-serif' }}>
                  <thead>
                    <tr>
                      {['Source Confidence', 'Ingredient', 'Protein Est.', 'Slot', 'Status'].map((col) => (
                        <th key={col} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.textMuted, borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap' }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {provenanceRows.map((row, i) => {
                      const confColor = row.confidence >= 80 ? T.green : row.confidence >= 50 ? T.amber : T.red
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? T.surface : T.s2 }}>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 13, color: confColor, fontWeight: 700 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: confColor, display: 'inline-block' }} />
                              {row.confidence}%
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 13, color: T.text, fontWeight: 600 }}>{row.ingredient}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 13, color: T.textSec }}>{row.protein}</td>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: T.textMuted }}>{row.slot}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <Pill color={row.status === 'Fridge' ? 'green' : 'blue'}>{row.status}</Pill>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══ Just Tell Me FAB ══ */}
      <button
        data-qa="dashboard-just-tell-me"
        onClick={handleJustTellMe}
        disabled={heroLoading || !recipes.length}
        title="Just Tell Me — get tonight's dinner recommendation"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 50,
          background: '#00FF85', color: '#000',
          fontWeight: 800, fontSize: 14,
          border: 'none', borderRadius: 99,
          padding: '14px 24px',
          cursor: recipes.length ? 'pointer' : 'default',
          opacity: heroLoading || !recipes.length ? 0.6 : 1,
          transition: 'transform 0.15s ease',
        }}
        onMouseEnter={(e) => { if (recipes.length) e.currentTarget.style.transform = 'scale(1.03)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        {heroLoading ? '✦ Thinking…' : '✦ Just Tell Me'}
      </button>

      {/* ══ MODALS ══ */}

      {/* Recipe Picker */}
      {showPicker && (
        <div onClick={() => setShowPicker(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}>
          <div data-qa="meal-picker-modal" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 680, maxHeight: '86vh', overflow: 'auto', background: T.s2, border: `1px solid ${T.border}`, borderRadius: 20, padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 18 }}>
              <div>
                <div style={{ color: T.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{showPicker.day} · {showPicker.slot}</div>
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: T.text }}>Pick a recipe</h3>
              </div>
              <button onClick={() => setShowPicker(null)} style={{ border: `1px solid ${T.border}`, background: 'transparent', color: T.text, width: 32, height: 32, borderRadius: 999, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 14 }}>
              <input data-qa="meal-picker-search" value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} placeholder="Search recipes…" className="t-input" style={{ width: '100%' }} />
              <select data-qa="meal-picker-sort" value={pickerSort} onChange={(e) => setPickerSort(e.target.value)} className="t-input" style={{ width: '100%' }}>
                <option value="fridge-match">Fridge match</option>
                <option value="protein">Protein</option>
                <option value="quickest">Quickest</option>
                <option value="cheapest">Cheapest</option>
                <option value="newest">Newest</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pickerRecipes.map((recipe) => (
                <button data-qa={`meal-picker-option-${qaSlug(recipe.title)}`} key={recipe.id} onClick={() => handlePickMeal(showPicker.day, showPicker.slot, recipe)} disabled={savingSlot} style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%', textAlign: 'left', padding: 12, borderRadius: 14, border: `1px solid ${T.border}`, background: T.surface, color: T.text, cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = T.borderActive}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = T.border}>
                  {recipe.image_url
                    ? <img src={recipe.image_url} alt={recipe.title} style={{ width: 80, height: 64, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />
                    : <div style={{ width: 80, height: 64, borderRadius: 10, background: cuisineGradient(recipe.cuisine), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🍽</div>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6, color: T.text }}>{recipe.title}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      <Pill color="green">{recipe.prep_time + recipe.cook_time} min</Pill>
                      <Pill color="purple">{recipe.protein}g protein</Pill>
                      <Pill color="amber">{recipe.fridge_match_score}% match</Pill>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {!pickerRecipes.length && (
              <div style={{ textAlign: 'center', padding: '32px 12px', color: T.textSec, fontSize: 14 }}>
                No recipes matched that search. Try a broader term.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Swap */}
      {showSwap && (
        <div onClick={() => setShowSwap(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 55 }}>
          <div data-qa="swap-modal" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 760, background: T.s2, border: `1px solid ${T.border}`, borderRadius: 20, padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ color: T.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{showSwap.day} · {showSwap.slot}</div>
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: T.text }}>I Don't Feel Like It</h3>
              </div>
              <button onClick={() => setShowSwap(null)} style={{ border: `1px solid ${T.border}`, background: 'transparent', color: T.text, width: 32, height: 32, borderRadius: 999, cursor: 'pointer' }}>✕</button>
            </div>
            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {['All', 'Fastest', 'Cheapest', 'Best Fit'].map((tab) => (
                <button data-qa={`swap-filter-${qaSlug(tab)}`} key={tab} onClick={() => setSwapTab(tab)} style={{
                  padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  border: `1px solid ${swapTab === tab ? T.green : T.border}`,
                  background: swapTab === tab ? 'rgba(0,255,133,0.1)' : 'transparent',
                  color: swapTab === tab ? T.green : T.textSec,
                  transition: 'all 0.15s',
                }}>{tab}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {(showSwap.alternatives || []).filter((item) => swapTab === 'All' || item.mode === swapTab).map((item) => (
                <button data-qa={`swap-option-${qaSlug(item.mode)}-${qaSlug(item.recipe?.title)}`} key={`${item.mode}-${item.recipe?.id}`} onClick={() => handlePickMeal(showSwap.day, showSwap.slot, item.recipe)} style={{ width: '100%', textAlign: 'left', padding: 16, borderRadius: 16, border: `1px solid ${T.border}`, background: T.surface, color: T.text, cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = T.borderActive}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = T.border}>
                  <div style={{ color: T.textMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{item.mode}</div>
                  <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8, color: T.text }}>{item.recipe?.title}</div>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 8 }}>
                    <Pill color="green">{item.recipe?.prep_time + item.recipe?.cook_time} min</Pill>
                    <Pill color="purple">{item.recipe?.protein}g protein</Pill>
                    <Pill color="amber">{item.recipe?.fit_analysis?.fridge_match_score || item.recipe?.fridge_match_score || 0}% match</Pill>
                  </div>
                  <div style={{ color: T.textSec, fontSize: 13, lineHeight: 1.5 }}>
                    {(item.recipe?.fit_analysis?.reasons || []).join(' • ') || 'Balanced against your saved filters.'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hero recommendation */}
      {heroRecommendation && (
        <div onClick={() => setHeroRecommendation(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 60 }}>
          <div data-qa="just-tell-me-modal" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 820, background: T.s2, border: `1px solid ${T.border}`, borderRadius: 24, overflow: 'hidden' }}>
            <div style={{ padding: 28, background: 'radial-gradient(circle at top left, rgba(0,255,133,0.14), transparent 46%)' }}>
              <div data-qa={heroRecommendation.empty ? 'just-tell-me-empty' : 'just-tell-me-result'} style={{ color: T.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                {heroRecommendation.empty ? 'Dinner Guidance' : "Tonight's Recommendation"}
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 10, color: T.text, letterSpacing: '-0.03em' }}>{heroRecommendation.title}</div>
              <p style={{ color: T.textSec, fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>{heroRecommendation.description}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                {heroRecommendation.empty ? (
                  <>
                    <Pill color="green">Refresh your fridge</Pill>
                    <Pill color="purple">Loosen filters</Pill>
                    <Pill color="amber">Add more dinner recipes</Pill>
                  </>
                ) : (
                  <>
                    <Pill color="green">{heroRecommendation.prep_time + heroRecommendation.cook_time} min</Pill>
                    <Pill color="purple">{heroRecommendation.protein}g protein</Pill>
                    <Pill color="amber">{heroRecommendation.fit_analysis?.fridge_match_score || 0}% fridge match</Pill>
                  </>
                )}
              </div>
              <p style={{ color: T.textSec, fontSize: 13, lineHeight: 1.6, marginBottom: 22 }}>
                {(heroRecommendation.fit_analysis?.reasons || []).join(' • ') || heroRecommendation.macro_explainer}
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                {heroRecommendation.id ? (
                  <>
                    <button data-qa="just-tell-me-view-details" onClick={() => navigate(`/recipes/${heroRecommendation.id}`)} className="t-btn-ghost" style={{ flex: 1, padding: '13px 16px', borderRadius: 12, fontSize: 14 }}>
                      View details
                    </button>
                    <button data-qa="just-tell-me-cook" onClick={() => navigate(`/cook/${heroRecommendation.id}`)} className="t-btn-primary" style={{ flex: 1, padding: '13px 16px', borderRadius: 12, fontSize: 14 }}>
                      Cook tonight
                    </button>
                  </>
                ) : (
                  <>
                    <button data-qa="just-tell-me-open-fridge" onClick={() => navigate('/fridge')} className="t-btn-ghost" style={{ flex: 1, padding: '13px 16px', borderRadius: 12, fontSize: 14 }}>
                      Open fridge
                    </button>
                    <button data-qa="just-tell-me-open-recipes" onClick={() => navigate('/recipes')} className="t-btn-primary" style={{ flex: 1, padding: '13px 16px', borderRadius: 12, fontSize: 14 }}>
                      Review recipes
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Grocery List Modal ══ */}
      {showGrocery && (
        <div onClick={() => setShowGrocery(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 60 }}>
          <div data-qa="grocery-modal" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 580, maxHeight: '82vh', display: 'flex', flexDirection: 'column', background: T.s2, border: `1px solid ${T.border}`, borderRadius: 20, overflow: 'hidden' }}>
            <div style={{ padding: '20px 22px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.textMuted, marginBottom: 4 }}>This Week</div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.text }}>Grocery List</h3>
              </div>
              <button onClick={() => setShowGrocery(false)} style={{ border: `1px solid ${T.border}`, background: 'transparent', color: T.text, width: 32, height: 32, borderRadius: 999, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>
              {groceryList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 12px', color: T.textSec, fontSize: 14 }}>
                  No meals planned this week yet. Add meals to the planner first.
                </div>
              ) : (() => {
                /* Group by category */
                const groups = {}
                groceryList.forEach((item) => {
                  const cat = item.category || 'Other'
                  if (!groups[cat]) groups[cat] = []
                  groups[cat].push(item)
                })
                return Object.entries(groups).map(([cat, items]) => (
                  <div key={cat} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.textMuted, marginBottom: 8 }}>{cat}</div>
                    {items.map((item) => (
                      <div data-qa="grocery-item" key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: T.surface, border: `1px solid ${T.border}`, marginBottom: 6 }}>
                        <span style={{ fontSize: 14, color: T.text, fontWeight: 600 }}>{item.name}</span>
                        <span style={{ fontSize: 13, color: T.textSec, fontWeight: 500 }}>
                          {item.quantity > 0 ? `${item.quantity}${item.unit ? ' ' + item.unit : ''}` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                ))
              })()}
            </div>

            <div style={{ padding: '14px 22px', borderTop: `1px solid ${T.border}` }}>
              <button
                onClick={() => navigator.clipboard?.writeText(groceryToText()).catch(() => {})}
                className="t-btn-primary"
                style={{ width: '100%', padding: '12px', borderRadius: 10, fontSize: 14 }}
              >
                Copy to clipboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
