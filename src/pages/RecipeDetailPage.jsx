import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRecipes } from '../hooks/useRecipes.js'
import TacticalCard from '../components/common/TacticalCard.jsx'
import StatusChip from '../components/common/StatusChip.jsx'
import IntelligenceGrain from '../components/common/IntelligenceGrain.jsx'
import { THEME } from '../theme/styles.js'

export default function RecipeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { fetchRecipeById, fetchUserProfile, fetchFridge, getRecipeFitAnalysis } = useRecipes()
  const [recipe, setRecipe] = useState(null)
  const [fitAnalysis, setFitAnalysis] = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      const [recipeData, profile, fridge] = await Promise.all([
        fetchRecipeById(id),
        fetchUserProfile(),
        fetchFridge(),
      ])

      setRecipe(recipeData)
      setFitAnalysis(recipeData ? getRecipeFitAnalysis(recipeData, profile || {}, (fridge || []).map((item) => item.ingredient_name)) : null)
      setLoaded(true)
    }

    load()
  }, [id])

  if (!loaded) return <div style={{ padding: 28, color: '#555' }}>Loading...</div>
  if (!recipe) return (
    <div data-qa="recipe-detail-page" style={{ padding: 28, maxWidth: 680, margin: '0 auto' }}>
      <button onClick={() => navigate('/recipes')} style={{ background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer', marginBottom: 16 }}>←</button>
      <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 18, padding: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🍽</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Recipe not found</div>
        <div style={{ color: '#9CA3AF', fontSize: 14, marginBottom: 20 }}>This recipe may have been deleted or doesn't belong to your account.</div>
        <button onClick={() => navigate('/recipes')} style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: '#00FF85', color: '#000', fontWeight: 800, cursor: 'pointer' }}>Back to recipes</button>
      </div>
    </div>
  )

  return (
    <div data-qa="recipe-detail-page" style={{ padding: 28, maxWidth: 680, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button onClick={() => navigate('/recipes')} style={{ background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer' }}>←</button>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, flex: 1 }}>{recipe.title}</h1>
        <button data-qa="recipe-detail-cook-now" onClick={() => navigate(`/cook/${recipe.id}`, { state: { fromPath: `/recipes/${recipe.id}` } })} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#00FF85', color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Cook Now</button>
      </div>
      {recipe.image_url && <img src={recipe.image_url} alt={recipe.title} style={{ width: '100%', height: 280, objectFit: 'cover', borderRadius: 16, marginBottom: 20 }} />}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatusChip label={recipe.source_label} status="neutral" />
        <StatusChip label={`⏱ ${recipe.prep_time + recipe.cook_time}m`} status="fresh" />
        <StatusChip label={`💪 ${recipe.protein}g`} status="fresh" />
        <StatusChip label={`${recipe.calories} kcal`} status="neutral" />
        
        {/* Source Confidence Badge native in header */}
        <StatusChip 
          label={`Confidence: ${Math.round((recipe.source_confidence || 0) * 100)}%`} 
          status={(recipe.source_confidence || 0) < 0.8 ? 'expiring' : 'fresh'} 
        />
      </div>
      {recipe.description && <p style={{ color: '#888', fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>{recipe.description}</p>}
      <div style={{ display: 'grid', gap: 14, marginBottom: 24 }}>
        <TacticalCard title="Provenance Engine" accentColor={THEME.purple} style={{ borderRadius: 18, marginBottom: 14 }}>
          <div style={{ color: '#E5E7EB', fontSize: 14, lineHeight: 1.6 }}>{recipe.macro_explainer}</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 14 }}>
            <div style={{ color: '#E5E7EB', fontSize: 14 }}>
              Calories: <IntelligenceGrain value={`${recipe.calories} kcal`} source={recipe.nutrition_source} explanation={recipe.macro_explainer} color={THEME.green} />
            </div>
            <div style={{ color: '#E5E7EB', fontSize: 14 }}>
              Protein: <IntelligenceGrain value={`${recipe.protein}g`} source={recipe.nutrition_source} explanation={recipe.macro_explainer} color={THEME.purple} />
            </div>
            <div style={{ color: '#E5E7EB', fontSize: 14 }}>
              Cost: <IntelligenceGrain value={`$${Number(recipe.cost_estimate || 0).toFixed(2)}`} source={recipe.cost_confidence} explanation="Cost is an estimate based on inferred ingredient spend, not a live grocery price." color={THEME.amber} />
            </div>
          </div>
        </TacticalCard>
        {fitAnalysis && (
          <TacticalCard subtitle="Fit Analysis" title="Why this fits" accentColor={THEME.amber} style={{ borderRadius: 18 }}>
            {fitAnalysis.allowed ? (
              <div style={{ color: '#E5E7EB', fontSize: 14, lineHeight: 1.6 }}>
                {fitAnalysis.reasons.length ? fitAnalysis.reasons.join(' • ') : 'This recipe currently passes your saved profile filters.'}
              </div>
            ) : (
              <div style={{ color: '#FCA5A5', fontSize: 14, lineHeight: 1.6 }}>
                Filtered out by: {fitAnalysis.blocked.join(', ')}
              </div>
            )}
          </TacticalCard>
        )}
      </div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ color: '#555', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 12 }}>Ingredients</div>
        {recipe.ingredients?.map((ing, i) => <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #1A1A1A', fontSize: 14, color: '#ccc' }}><span style={{ color: '#fff', fontWeight: 600 }}>{ing.quantity} {ing.unit}</span> {ing.name}</div>)}
      </div>
      <div>
        <div style={{ color: '#555', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 16 }}>Instructions</div>
        {recipe.steps?.sort((a, b) => (a.order_num || 0) - (b.order_num || 0)).map((step, i) => (
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
