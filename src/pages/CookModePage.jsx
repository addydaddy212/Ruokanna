import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useRecipes } from '../hooks/useRecipes.js'

function isRecipeDetailPath(pathname = '') {
  return /^\/recipes\/[^/]+$/.test(pathname)
}

export default function CookModePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { fetchRecipeById } = useRecipes()
  const [recipe, setRecipe] = useState(null)
  const [step, setStep] = useState(0)
  const [timeLeft, setTimeLeft] = useState(null)
  const [running, setRunning] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [completed, setCompleted] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    fetchRecipeById(id).then(r => {
      if (r) {
        setRecipe(r)
        setTimeLeft(r.steps?.[0]?.timer_seconds || null)
      }
      setLoaded(true)
    })
  }, [id])

  const steps = recipe?.steps?.sort((a, b) => (a.order_num || 0) - (b.order_num || 0)) || []
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
  const fromPath = location.state?.fromPath || ''

  function handleBackPage() {
    if (isRecipeDetailPath(fromPath)) {
      navigate(fromPath)
      return
    }

    if (recipe?.id) {
      navigate(`/recipes/${recipe.id}`)
      return
    }

    navigate('/recipes')
  }

  if (!loaded) return <div data-qa="cook-mode-loading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#555' }}>Loading...</div>
  if (!recipe) return (
    <div data-qa="cook-mode-missing" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0A0A0A', gap: 16 }}>
      <div style={{ fontSize: 36 }}>🍽</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Recipe not found</div>
      <div style={{ color: '#9CA3AF', fontSize: 14 }}>This recipe may have been deleted or doesn't exist.</div>
      <button onClick={() => navigate('/recipes')} style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: '#00FF85', color: '#000', fontWeight: 800, cursor: 'pointer' }}>Back to recipes</button>
    </div>
  )

  if (completed) return (
    <div data-qa="cook-complete" style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 72, marginBottom: 24 }}>🎉</div>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#55556A', marginBottom: 10 }}>{recipe.title}</div>
      <h1 style={{ fontSize: 36, fontWeight: 800, color: '#F0F0F8', margin: '0 0 12px', letterSpacing: '-0.03em' }}>You cooked it!</h1>
      <div style={{ fontSize: 14, color: '#8888A8', marginBottom: 32 }}>
        Total time: <span style={{ color: '#00FF85', fontWeight: 700 }}>{(recipe.prep_time || 0) + (recipe.cook_time || 0)} min</span>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button data-qa="cook-complete-back" onClick={() => navigate('/recipes')} style={{ padding: '13px 24px', borderRadius: 12, border: '1px solid #2A2A38', background: 'transparent', color: '#F0F0F8', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          Back to recipes
        </button>
        <button onClick={() => {}} style={{ padding: '13px 24px', borderRadius: 12, border: 'none', background: '#00FF85', color: '#000', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
          Rate this meal
        </button>
      </div>
    </div>
  )

  return (
    <div data-qa="cook-mode-page" style={{ minHeight: '100vh', background: '#000000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <button data-qa="cook-back-page" onClick={handleBackPage} style={{ position: 'fixed', top: 20, left: 20, background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#888', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
      
      {/* AI Sous Chef Floating Action */}
      <button 
        onClick={() => navigate('/chat', { state: { contextRecipeId: recipe.id, currentStep: current?.instruction } })} 
        style={{
          position: 'fixed', bottom: 32, right: 32,
          background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(12px)', border: '1px solid #333', color: '#00FF85', 
          padding: '16px 24px', borderRadius: 99, fontSize: 16, fontWeight: 800, cursor: 'pointer', 
          boxShadow: '0 8px 32px rgba(0,255,133,0.2)', transition: 'transform 0.2s', zIndex: 50
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        💬 AI Sous Chef
      </button>

      <div style={{ textAlign: 'center', maxWidth: 880, width: '100%' }}>
        <div style={{ color: '#444', fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{recipe.title}</div>
        <div data-qa="cook-progress-label" style={{ color: '#555', fontSize: 14, marginBottom: 24 }}>Step {step + 1} of {steps.length}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 32 }}>
          {steps.map((_, i) => <div key={i} onClick={() => setStep(i)} style={{ width: i === step ? 32 : 12, height: 12, borderRadius: 99, background: i <= step ? '#00FF85' : '#2A2A2A', transition: 'all 0.3s', cursor: 'pointer' }} />)}
        </div>
        <div style={{ background: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: 24, padding: '60px 48px', marginBottom: 32 }}>
          <p data-qa="cook-step-text" style={{ fontSize: 44, fontWeight: 800, color: '#fff', lineHeight: 1.3, margin: 0, letterSpacing: '-0.02em' }}>{current?.instruction}</p>
        </div>
        {current?.timer_seconds && (
          <div data-qa="cook-timer" style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 56, fontWeight: 800, color: running ? '#00FF85' : '#fff', letterSpacing: '0.05em', transition: 'color 0.3s' }}>{fmt(timeLeft ?? current.timer_seconds)}</div>
            <button data-qa="cook-timer-toggle" onClick={() => setRunning(r => !r)} style={{ marginTop: 12, padding: '12px 32px', borderRadius: 12, background: running ? '#2A2A2A' : '#00FF85', color: running ? '#fff' : '#000', border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {running ? '⏸ Pause' : timeLeft === 0 ? '✓ Done' : '▶ Start Timer'}
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button data-qa="cook-step-back" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} style={{ padding: '14px 28px', borderRadius: 12, border: '1px solid #2A2A2A', background: '#1A1A1A', color: step === 0 ? '#333' : '#fff', fontSize: 15, fontWeight: 600, cursor: step === 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}>← Back</button>
          {step < steps.length - 1
            ? <button data-qa="cook-step-next" onClick={() => setStep(s => s + 1)} style={{ padding: '14px 32px', borderRadius: 12, border: 'none', background: '#00FF85', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Next →</button>
            : <button data-qa="cook-step-done" onClick={() => setCompleted(true)} style={{ padding: '14px 32px', borderRadius: 12, border: 'none', background: '#00FF85', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>🎉 Done!</button>
          }
        </div>
      </div>
    </div>
  )
}
