import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SkeletonCard from '../components/SkeletonCard.jsx'
import { useRecipes } from '../hooks/useRecipes.js'

const T = {
  base:        '#0A0A0F',
  surface:     '#111118',
  s2:          '#1A1A24',
  s3:          '#22222E',
  border:      '#2A2A38',
  borderActive:'#3A3A4E',
  text:        '#F0F0F8',
  textSec:     '#8888A8',
  textMuted:   '#55556A',
  green:       '#00FF85',
  purple:      '#C084FC',
  amber:       '#F59E0B',
  blue:        '#60A5FA',
  red:         '#F87171',
}

function Pill({ children, color = 'muted' }) {
  const styles = {
    green:  { bg: '#0A2A1A', color: T.green,  border: 'rgba(0,255,133,0.18)' },
    purple: { bg: '#1E0A2A', color: T.purple, border: 'rgba(192,132,252,0.18)' },
    amber:  { bg: '#2A1A0A', color: T.amber,  border: 'rgba(245,158,11,0.18)' },
    blue:   { bg: '#0A1A2A', color: T.blue,   border: 'rgba(96,165,250,0.18)' },
    red:    { bg: '#2A0A0A', color: T.red,    border: 'rgba(248,113,113,0.18)' },
    muted:  { bg: T.s2,     color: T.textSec, border: T.border },
  }
  const s = styles[color] || styles.muted
  return (
    <span style={{
      borderRadius: 99, padding: '4px 10px',
      fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {children}
    </span>
  )
}

/* Top-border color by difficulty */
function difficultyColor(diff = '') {
  const d = diff.toLowerCase()
  if (d === 'easy') return T.green
  if (d === 'hard') return T.red
  return T.amber
}

/* Deterministic gradient from cuisine name */
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

/* Small SVG arc for fridge match % */
function MatchArc({ pct = 0 }) {
  const r = 16
  const cx = 20
  const cy = 20
  const circumference = Math.PI * r  // half circle = πr
  const offset = circumference * (1 - Math.min(pct, 100) / 100)
  return (
    <svg width="40" height="24" viewBox="0 0 40 24" style={{ overflow: 'visible' }}>
      {/* background arc */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={T.border} strokeWidth="3" strokeLinecap="round"
      />
      {/* foreground arc */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={T.blue} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
      />
    </svg>
  )
}

export default function RecipesPage() {
  const navigate = useNavigate()
  const { fetchRecipes, fetchFridge, deleteRecipe, filterRecipes, scoreRecipeByFridge, sortRecipes } = useRecipes()
  const [recipes, setRecipes] = useState([])
  const [fridgeIngredients, setFridgeIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cuisine, setCuisine] = useState('All')
  const [tag, setTag] = useState('All')
  const [maxTime, setMaxTime] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [error, setError] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [recipeData, fridgeData] = await Promise.all([fetchRecipes(), fetchFridge()])
      const fridgeNames = (fridgeData || []).map((item) => item.ingredient_name)
      setFridgeIngredients(fridgeNames)
      setRecipes((recipeData || []).map((recipe) => ({
        ...recipe,
        fridge_match_score: scoreRecipeByFridge(recipe, fridgeNames),
      })))
    } catch (loadError) {
      setError(loadError.message || 'Failed to load recipes.')
    }
    setLoading(false)
  }

  async function handleDelete(id, event) {
    event.stopPropagation()
    if (!window.confirm('Delete this recipe?')) return
    const ok = await deleteRecipe(id)
    if (!ok) { setError('Could not delete recipe.'); return }
    setRecipes((prev) => prev.filter((recipe) => recipe.id !== id))
  }

  const cuisines = useMemo(() => ['All', ...new Set(recipes.map((r) => r.cuisine).filter(Boolean))], [recipes])
  const tags = useMemo(() => ['All', ...new Set(recipes.flatMap((r) => r.tags || []))], [recipes])

  const visibleRecipes = useMemo(() => {
    const filtered = filterRecipes(recipes, { search, cuisine, tag, maxTime })
    return sortRecipes(filtered, sortBy)
  }, [recipes, search, cuisine, tag, maxTime, sortBy, filterRecipes, sortRecipes])

  /* Select styles reused */
  const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: `1px solid ${T.border}`, background: T.s2,
    color: T.text, outline: 'none',
    transition: 'border-color 0.15s',
  }

  return (
    <div data-qa="recipes-page" style={{ padding: '24px 28px', maxWidth: 1220, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div className="t-fade-1" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.textMuted, marginBottom: 6 }}>Recipe Library</div>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.03em', color: T.text }}>My Recipes</h1>
          <div data-qa="recipes-summary" style={{ color: T.textSec, fontSize: 14 }}>
            {loading ? 'Loading recipes…' : `${visibleRecipes.length} recipes shown`}
            {!!fridgeIngredients.length && (
              <span style={{ color: T.amber }}> · ranked against {fridgeIngredients.length} fridge ingredients</span>
            )}
          </div>
        </div>
        <button data-qa="recipes-add-button" onClick={() => navigate('/recipes/add')} className="t-btn-primary" style={{ padding: '12px 22px', borderRadius: 12, fontSize: 14 }}>
          Add Recipe
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 12, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: T.red, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── Filter card ── */}
      <div className="t-fade-2 t-card" style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.textMuted, marginBottom: 12 }}>
          Library Controls
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, cuisine, or tag…"
            style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = T.green; e.target.style.boxShadow = '0 0 0 3px rgba(0,255,133,0.1)' }}
            onBlur={(e) => { e.target.style.borderColor = T.border; e.target.style.boxShadow = 'none' }}
          />
          <select value={cuisine} onChange={(e) => setCuisine(e.target.value)} style={inputStyle}>
            {cuisines.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={tag} onChange={(e) => setTag(e.target.value)} style={inputStyle}>
            {tags.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <input
            type="number" min="0" value={maxTime}
            onChange={(e) => setMaxTime(e.target.value)}
            placeholder="Max time (min)"
            style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = T.green; e.target.style.boxShadow = '0 0 0 3px rgba(0,255,133,0.1)' }}
            onBlur={(e) => { e.target.style.borderColor = T.border; e.target.style.boxShadow = 'none' }}
          />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={inputStyle}>
            <option value="newest">Newest</option>
            <option value="protein">Protein</option>
            <option value="quickest">Quickest</option>
            <option value="cheapest">Cheapest</option>
            <option value="fridge-match">Fridge Match</option>
          </select>
        </div>
      </div>

      {/* ── Grid ── */}
      {loading ? (
        <div data-qa="recipes-loading" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4, 5, 6].map((item) => <SkeletonCard key={item} />)}
        </div>
      ) : !visibleRecipes.length ? (
        <div style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: 20, padding: 38, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>🥘</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px', color: T.text }}>No recipes match those filters</h2>
          <p style={{ color: T.textSec, fontSize: 14, margin: '0 0 20px', lineHeight: 1.6 }}>Try clearing a filter, widening your time limit, or adding a new recipe.</p>
          <button onClick={() => navigate('/recipes/add')} className="t-btn-primary" style={{ padding: '12px 22px', borderRadius: 12 }}>
            Add another recipe
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 18 }}>
          {visibleRecipes.map((recipe, i) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              animDelay={Math.min(i, 5) * 60}
              onNavigate={navigate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Recipe card ── */
function RecipeCard({ recipe, animDelay, onNavigate, onDelete }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      data-qa="recipe-card"
      className="t-fade"
      onClick={() => onNavigate(`/recipes/${recipe.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: 'pointer',
        background: '#111118',
        border: `1px solid ${hovered ? '#3A3A4E' : '#2A2A38'}`,
        borderRadius: 16,
        overflow: 'hidden',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered ? '0 8px 32px rgba(0,0,0,0.4)' : 'none',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        animationDelay: `${animDelay}ms`,
        /* Top accent border by difficulty */
        borderTop: `2px solid ${difficultyColor(recipe.difficulty)}`,
      }}
    >
      {/* Image / placeholder */}
      <div style={{ position: 'relative' }}>
        {recipe.image_url ? (
          <img src={recipe.image_url} alt={recipe.title} style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: 150, background: cuisineGradient(recipe.cuisine), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>🍽</div>
        )}

        {/* Fridge match arc — top right */}
        <div style={{
          position: 'absolute', top: 8, right: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          background: 'rgba(10,10,15,0.82)', backdropFilter: 'blur(6px)',
          borderRadius: 10, padding: '5px 8px 3px',
          border: '1px solid rgba(96,165,250,0.2)',
        }}>
          <MatchArc pct={recipe.fridge_match_score} />
          <div style={{ fontSize: 10, fontWeight: 700, color: '#60A5FA', marginTop: -2 }}>{recipe.fridge_match_score}%</div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#F0F0F8', lineHeight: 1.3 }}>{recipe.title}</div>
        </div>
        <div style={{ color: '#8888A8', fontSize: 12, marginBottom: 10 }}>{recipe.cuisine}{recipe.difficulty ? ` · ${recipe.difficulty}` : ''}</div>

        {recipe.source_label && (
          <div style={{ color: '#55556A', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            {recipe.source_label}{recipe.source_domain ? ` · ${recipe.source_domain}` : ''}
          </div>
        )}

        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
          <Pill color="green">{recipe.prep_time + recipe.cook_time} min</Pill>
          <Pill color="purple">{recipe.protein}g protein</Pill>
          <Pill color="amber">${Number(recipe.cost_estimate || 0).toFixed(2)}</Pill>
        </div>

        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
          {recipe.nutrition_source && <Pill color="blue">{recipe.nutrition_source}</Pill>}
          {(recipe.tags || []).slice(0, 3).map((t) => (
            <Pill key={t} color="muted">{t}</Pill>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onNavigate(`/cook/${recipe.id}`) }}
            className="t-btn-primary"
            style={{ flex: 1, padding: '9px 12px', borderRadius: 10, fontSize: 13 }}
          >
            Cook
          </button>
          <button
            onClick={(e) => onDelete(recipe.id, e)}
            style={{
              padding: '9px 12px', borderRadius: 10, fontSize: 13,
              background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
              color: '#F87171', cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(248,113,113,0.16)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(248,113,113,0.08)'}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
