import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecipes } from '../hooks/useRecipes.js'
import TacticalCard from '../components/common/TacticalCard.jsx'
import StatusChip from '../components/common/StatusChip.jsx'
import { THEME } from '../theme/styles.js'
import { safeReadJsonResponse } from '../utils/safeReadJsonResponse.js'

export default function FridgePage() {
  const navigate = useNavigate()
  const { fetchFridge, updateFridge, fetchRecipesByFridgeMatch } = useRecipes()
  const [activeTab, setActiveTab] = useState('ingredients')
  const [fridgeItems, setFridgeItems] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [cookNowRecipes, setCookNowRecipes] = useState([])
  const [newItem, setNewItem] = useState('')
  const [scanning, setScanning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [scanNotice, setScanNotice] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData(nextIngredients) {
    setLoading(true)
    setError('')

    try {
      const rawItems = await fetchFridge()
      setFridgeItems(rawItems)
      const ingredientNames = nextIngredients || rawItems.map((item) => item.ingredient_name)
      const recipeData = await fetchRecipesByFridgeMatch(ingredientNames)
      setIngredients(ingredientNames)
      setCookNowRecipes(recipeData)
    } catch (loadError) {
      setError(loadError.message || 'Failed to load fridge data.')
    }

    setLoading(false)
  }

  async function persistIngredients(nextIngredients) {
    const ok = await updateFridge(nextIngredients)
    if (!ok) {
      setError('Could not update your fridge.')
      return
    }

    await loadData(nextIngredients)
  }

  async function handleScan(file) {
    setScanning(true)
    setError('')
    setScanNotice('')

    try {
      const { base64, mimeType } = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve({
          base64: reader.result.split(',')[1],
          mimeType: file.type || 'image/jpeg',
        })
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const response = await fetch('/api/fridge/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType }),
      })

      const data = await safeReadJsonResponse(response, 'Fridge scan returned an invalid response.')
      if (!response.ok) throw new Error(data.error || 'Scan failed')

      const merged = [...new Set([...ingredients, ...(data.ingredients || [])])]
      await persistIngredients(merged)
      setScanNotice(
        data.source === 'dev-fallback'
          ? `Detected ${data.ingredients?.length || 0} ingredients using the local-dev fallback scan.`
          : `Detected ${data.ingredients?.length || 0} ingredients from your upload.`,
      )
    } catch (scanError) {
      setError(scanError.message || 'Failed to scan image.')
    }

    setScanning(false)
  }

  async function addItem() {
    const trimmed = newItem.trim().toLowerCase()
    if (!trimmed) return

    await persistIngredients([...new Set([...ingredients, trimmed])])
    setNewItem('')
  }

  async function removeItem(item) {
    await persistIngredients(ingredients.filter((ingredient) => ingredient !== item))
  }

  async function clearAllIngredients() {
    if (!window.confirm('Clear all fridge ingredients?')) return
    await persistIngredients([])
  }

  const topMatches = useMemo(() => cookNowRecipes.filter((recipe) => recipe.fridge_match_score > 0), [cookNowRecipes])
  const pantryReadiness = cookNowRecipes.length ? Math.round((topMatches.length / cookNowRecipes.length) * 100) : 0

  const sortedFridge = useMemo(() => {
    return [...fridgeItems].sort((a, b) => {
      if (!a.expiry_date) return 1;
      if (!b.expiry_date) return -1;
      return new Date(a.expiry_date) - new Date(b.expiry_date);
    })
  }, [fridgeItems])

  const { priorityItems, normalItems } = useMemo(() => {
    const now = new Date()
    const THREEDAYS = 3 * 24 * 60 * 60 * 1000
    const prio = []
    const norm = []
    sortedFridge.forEach(item => {
      if (item.expiry_date && (new Date(item.expiry_date) - now) < THREEDAYS) prio.push(item)
      else norm.push(item)
    })
    return { priorityItems: prio, normalItems: norm }
  }, [sortedFridge])

  return (
    <div data-qa="fridge-page" style={{ padding: 28, maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: '0 0 8px' }}>Fridge</h1>
          <p style={{ color: '#9CA3AF', fontSize: 14, margin: 0 }}>Scan ingredients, add them manually, and see what you can cook right now.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, background: '#111', border: '1px solid #2A2A2A', borderRadius: 14, padding: 4 }}>
          {[['ingredients', 'Ingredients'], ['cook-now', 'Cook Now']].map(([id, label]) => (
            <button data-qa={`fridge-tab-${id}`} key={id} onClick={() => setActiveTab(id)} style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: 'none',
              background: activeTab === id ? '#1A1A1A' : 'transparent',
              color: activeTab === id ? '#fff' : '#6B7280',
              cursor: 'pointer',
              fontWeight: 700,
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div data-qa="fridge-error" style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 14, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5', fontSize: 13 }}>
          {error}
        </div>
      )}

      {scanNotice && (
        <div data-qa="fridge-scan-notice" style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 14, background: 'rgba(0,255,133,0.08)', border: '1px solid rgba(0,255,133,0.22)', color: '#86EFAC', fontSize: 13 }}>
          {scanNotice}
        </div>
      )}

      {activeTab === 'ingredients' ? (
        <>
          <TacticalCard subtitle="Fridge Scanner" title="Scan or drop a fridge photo" accentColor={THEME.green} style={{ marginBottom: 20 }}>
          <div
            data-qa="fridge-upload-zone"
            onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              const file = event.dataTransfer.files[0]
              if (file) handleScan(file)
            }}
            style={{
              border: `2px dashed ${dragging ? '#00FF85' : '#2A2A2A'}`,
              borderRadius: 20,
              padding: '42px 24px',
              textAlign: 'center',
              background: dragging ? 'rgba(0,255,133,0.05)' : '#111',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <input data-qa="fridge-upload-input" type="file" accept="image/*" onChange={(event) => event.target.files[0] && handleScan(event.target.files[0])} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
            {scanning ? (
              <div>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🔎</div>
                <div style={{ color: '#00FF85', fontWeight: 800, marginBottom: 6 }}>Scanning with the Ruokanna engine...</div>
                <div style={{ color: '#9CA3AF', fontSize: 13 }}>Looking for visible produce, proteins, and pantry staples.</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📸</div>
                <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>Drop in a fridge photo</div>
                <div style={{ color: '#9CA3AF', fontSize: 14 }}>Or click to upload and let Ruokanna detect ingredients automatically.</div>
              </div>
            )}
          </div>
          </TacticalCard>

          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <input
              data-qa="fridge-manual-input"
              value={newItem}
              onChange={(event) => setNewItem(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && addItem()}
              placeholder="Add an ingredient manually..."
              style={{ flex: 1, minWidth: 220, padding: '12px 14px', borderRadius: 12, border: '1px solid #2A2A2A', background: '#111', color: '#fff', outline: 'none' }}
            />
            <button data-qa="fridge-add-item" onClick={addItem} style={{ padding: '12px 18px', borderRadius: 12, border: 'none', background: '#00FF85', color: '#000', fontWeight: 800, cursor: 'pointer' }}>
              Add
            </button>
            <button data-qa="fridge-clear-all" onClick={clearAllIngredients} disabled={!ingredients.length} style={{ padding: '12px 18px', borderRadius: 12, border: '1px solid #2A2A2A', background: 'transparent', color: ingredients.length ? '#fff' : '#4B5563', cursor: ingredients.length ? 'pointer' : 'default' }}>
              Clear all
            </button>
          </div>

          {loading ? (
            <div style={{ color: '#9CA3AF', textAlign: 'center', padding: 34 }}>Loading ingredients...</div>
          ) : !ingredients.length ? (
            <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 18, padding: 28, textAlign: 'center', color: '#9CA3AF' }}>
              No ingredients saved yet.
            </div>
          ) : (
            <TacticalCard subtitle="Inventory" title={`${ingredients.length} ingredients saved`} accentColor={THEME.green}>
              {priorityItems.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ color: THEME.amber, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Priority Use (Expiring Soon)</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {priorityItems.map((item) => (
                      <div data-qa="fridge-ingredient-tag" key={item.id || item.ingredient_name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <StatusChip label={item.ingredient_name} status="expiring" style={{ textTransform: 'capitalize' }} />
                        <button data-qa="fridge-remove-item" onClick={() => removeItem(item.ingredient_name)} style={{ background: 'transparent', border: 'none', color: '#6B7280', cursor: 'pointer', padding: 0 }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div style={{ color: '#6B7280', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>All Ingredients</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {normalItems.map((item) => (
                    <div data-qa="fridge-ingredient-tag" key={item.id || item.ingredient_name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StatusChip label={item.ingredient_name} status="fresh" style={{ textTransform: 'capitalize' }} />
                      <button data-qa="fridge-remove-item" onClick={() => removeItem(item.ingredient_name)} style={{ background: 'transparent', border: 'none', color: '#6B7280', cursor: 'pointer', padding: 0 }}>×</button>
                    </div>
                  ))}
                  {normalItems.length === 0 && priorityItems.length > 0 && (
                    <span style={{ color: '#555' }}>No other ingredients.</span>
                  )}
                </div>
              </div>
            </TacticalCard>
          )}
        </>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <div style={{ color: '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Cook Now</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>Best matches from your saved recipes</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatusChip label={`${topMatches.length} recipes with a fridge match`} type="cost" />
              <StatusChip label={`Pantry readiness ${pantryReadiness}%`} type="match" />
            </div>
          </div>

          {loading ? (
            <div style={{ color: '#9CA3AF', textAlign: 'center', padding: 34 }}>Loading matches...</div>
          ) : !cookNowRecipes.length ? (
            <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 18, padding: 28, textAlign: 'center', color: '#9CA3AF' }}>
              Save a few recipes first and this tab will rank them against your fridge.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              {cookNowRecipes.map((recipe) => (
                <TacticalCard data-qa="fridge-recipe-card" key={recipe.id} accentColor={recipe.fridge_match_score > 50 ? THEME.green : THEME.amber} style={{ borderRadius: 18, overflow: 'hidden', padding: 0 }}>
                  {recipe.image_url ? (
                    <img src={recipe.image_url} alt={recipe.title} style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ width: '100%', height: 150, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>🍲</div>
                  )}
                  <div style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                      <div style={{ fontWeight: 800, fontSize: 16 }}>{recipe.title}</div>
                      <div style={{ color: '#FFB347', fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap' }}>{recipe.fridge_match_score}% match</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                      <StatusChip label={`${recipe.prep_time + recipe.cook_time} min`} type="match" />
                      <StatusChip label={`${recipe.protein}g protein`} type="protein" />
                    </div>
                    <div style={{ color: '#9CA3AF', fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
                      {recipe.fridge_match_score > 0
                        ? `Ruokanna matched this against about ${recipe.fridge_match_score}% of the ingredient list from your fridge.`
                        : 'This recipe currently has no direct ingredient overlap with your fridge.'}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => navigate(`/recipes/${recipe.id}`)} style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1px solid #2A2A2A', background: 'transparent', color: '#fff', cursor: 'pointer' }}>
                        View
                      </button>
                      <button data-qa={`fridge-cook-${recipe.id}`} onClick={() => navigate(`/cook/${recipe.id}`)} style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: 'none', background: '#00FF85', color: '#000', fontWeight: 800, cursor: 'pointer' }}>
                        Cook
                      </button>
                    </div>
                  </div>
                </TacticalCard>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
