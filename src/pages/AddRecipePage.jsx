import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecipes } from '../hooks/useRecipes.js'
import TacticalCard from '../components/common/TacticalCard.jsx'
import StatusChip from '../components/common/StatusChip.jsx'
import ExtractionPulse from '../components/shared/ExtractionPulse.jsx'
import { THEME, inputStyle as sharedInputStyle, glassCardStyle } from '../theme/styles.js'
import { safeReadJsonResponse } from '../utils/safeReadJsonResponse.js'

const GENERATION_STEPS = [
  'Reading recipe...',
  'Extracting ingredients...',
  'Estimating macros...',
  'Almost done...',
]

function isYouTubeUrl(url) {
  return /(?:youtube\.com|youtu\.be)/i.test(url || '')
}

function isInstagramUrl(url) {
  return /instagram\.com/i.test(url || '')
}

function formatError(message) {
  if (!message) return 'Something went wrong while building this recipe.'
  if (message.toLowerCase().includes('quota')) return 'The AI provider is out of quota right now. Try again after the quota window resets.'
  if (message.toLowerCase().includes('429')) return 'The AI provider is rate-limited right now. Please retry in a moment.'
  if (message.toLowerCase().includes('transcript')) return 'Ruokanna could not find usable subtitles for that YouTube video.'
  if (message.toLowerCase().includes('instagram')) return 'Instagram recipe extraction is not supported yet. Ruokanna needs subtitles or captions to convert videos into recipes.'
  return message
}

function toNumber(value) {
  return value === '' ? 0 : Number(value) || 0
}

export default function AddRecipePage() {
  const navigate = useNavigate()
  const { saveRecipe, error: recipeError } = useRecipes()
  const [tab, setTab] = useState('url')
  const [url, setUrl] = useState('')
  const [aiPrompt, setAiPrompt] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractStep, setExtractStep] = useState(0)
  const [streamLines, setStreamLines] = useState([])
  const [extractedEntities, setExtractedEntities] = useState([])
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [manual, setManual] = useState({
    title: '',
    cuisine: '',
    prep_time: '',
    cook_time: '',
    servings: '2',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    cost_estimate: '',
    difficulty: 'Medium',
    description: '',
    ingredients: [{ name: '', quantity: '', unit: '' }],
    steps: [{ instruction: '', timer_seconds: '' }],
  })

  useEffect(() => {
    if (!extracting) {
      setExtractStep(0)
      setStreamLines([])
      setExtractedEntities([])
      return
    }

    const lines = [
      "Establishing secure connection to source...",
      "Parsing DOM and microdata structures...",
      "Identifying recipe ingredients and quantities...",
      "Parsing cooking instructions...",
      "Normalizing yields and serving sizes...",
      "Running macro estimation model...",
      "Finalizing structured payload."
    ]
    const ents = [
      "Title Identified",
      "Ingredients Block",
      "Steps Block",
      "Macros Processed"
    ]

    let cycle = 0
    const interval = window.setInterval(() => {
      if (cycle < lines.length) {
        setStreamLines(curr => [...curr, lines[cycle]])
        if (cycle % 2 === 0 && (cycle/2) < ents.length) {
          setExtractedEntities(curr => [...curr, ents[Math.floor(cycle/2)]])
        }
        cycle++
      }
      setExtractStep(curr => (curr + 1) % GENERATION_STEPS.length)
    }, 700)

    return () => window.clearInterval(interval)
  }, [extracting])

  async function handleExtract() {
    if (!url.trim()) return

    setExtracting(true)
    setError('')
    setPreview(null)

    try {
      const response = await fetch('/api/recipes/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await safeReadJsonResponse(response, 'Recipe extraction returned an invalid response.')
      if (!response.ok) throw new Error(data.error || 'Recipe extraction failed.')
      setPreview(data)
    } catch (extractError) {
      setError(formatError(extractError.message))
    }

    setExtracting(false)
  }

  async function handleGenerate() {
    if (!aiPrompt.trim()) return

    setExtracting(true)
    setError('')
    setPreview(null)

    try {
      const response = await fetch('/api/recipes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt.trim() }),
      })

      const data = await safeReadJsonResponse(response, 'Recipe generation returned an invalid response.')
      if (!response.ok) throw new Error(data.error || 'Recipe generation failed.')
      setPreview(data)
    } catch (generateError) {
      setError(formatError(generateError.message))
    }

    setExtracting(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')

    const recipe = tab === 'manual'
      ? {
        ...manual,
        prep_time: toNumber(manual.prep_time),
        cook_time: toNumber(manual.cook_time),
        servings: toNumber(manual.servings),
        calories: toNumber(manual.calories),
        protein: toNumber(manual.protein),
        carbs: toNumber(manual.carbs),
        fat: toNumber(manual.fat),
        cost_estimate: toNumber(manual.cost_estimate),
        goals: [],
        ingredients: manual.ingredients.filter((item) => item.name.trim()),
        steps: manual.steps.filter((item) => item.instruction.trim()).map((item) => ({ ...item, timer_seconds: toNumber(item.timer_seconds) || null })),
      }
      : preview

    try {
      const saved = await saveRecipe(recipe)
      if (saved) navigate('/recipes')
    } catch (saveError) {
      setError(formatError(saveError.message || recipeError || 'Failed to save recipe.'))
    }

    setSaving(false)
  }

  return (
    <div data-qa="add-recipe-page" style={{ padding: 28, maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <button onClick={() => navigate('/recipes')} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 4px' }}>Add Recipe</h1>
          <div style={{ color: '#9CA3AF', fontSize: 14 }}>Import from a URL, pull from YouTube subtitles, generate with AI, or add one manually.</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, background: '#111', border: '1px solid #2A2A2A', borderRadius: 14, padding: 4, marginBottom: 24 }}>
        {[['url', 'From URL'], ['ai', 'AI Generate'], ['manual', 'Manual']].map(([id, label]) => (
          <button key={id} data-qa={`add-recipe-tab-${id}`} onClick={() => { setTab(id); setPreview(null); setError('') }} style={{
            flex: 1,
            padding: '10px 0',
            borderRadius: 10,
            border: 'none',
            background: tab === id ? '#1A1A1A' : 'transparent',
            color: tab === id ? '#fff' : '#6B7280',
            cursor: 'pointer',
            fontWeight: 700,
          }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'url' && !preview && (
        <TacticalCard subtitle="Input Ingestion" title="Paste and Extract" accentColor={THEME.green}>
          <p style={{ color: '#9CA3AF', fontSize: 14, margin: '0 0 16px' }}>Paste a recipe URL or a YouTube cooking video. Ruokanna will scrape text-based recipe pages directly, and for YouTube it will switch to transcript extraction when subtitles are available.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <StatusChip label="Recipe Blog" type="match" />
            <StatusChip label="YouTube Transcript" type="source" />
            <StatusChip label="Manual Entry" type="protein" />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <input data-qa="recipe-url-input" style={{ ...sharedInputStyle, flex: 1, minWidth: 240 }} type="url" placeholder="https://..." value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && handleExtract()} />
            <button data-qa="recipe-url-extract" onClick={handleExtract} disabled={extracting || !url.trim()} style={{ padding: '12px 20px', borderRadius: 12, border: 'none', background: '#00FF85', color: '#000', fontWeight: 800, cursor: 'pointer', opacity: extracting || !url.trim() ? 0.65 : 1 }}>
              {extracting ? 'Working...' : isYouTubeUrl(url) ? 'Extract from YouTube' : isInstagramUrl(url) ? 'Check Video Source' : 'Extract'}
            </button>
          </div>
          {isInstagramUrl(url) && (
            <div style={{ marginBottom: 12, padding: '12px 14px', borderRadius: 14, background: 'rgba(255,179,71,0.08)', border: '1px solid rgba(255,179,71,0.25)', color: '#FFB347', fontSize: 13 }}>
              Instagram is intentionally deferred right now. Ruokanna needs a subtitle or caption source before it can turn a reel into a recipe.
            </div>
          )}
          <ExtractionPulse isProcessing={extracting} rawTextStream={streamLines} entities={extractedEntities} />
          {error && <div data-qa="add-recipe-error" style={{ marginTop: 12, color: '#FCA5A5', fontSize: 13 }}>{error}</div>}
        </TacticalCard>
      )}

      {tab === 'ai' && !preview && (
        <TacticalCard subtitle="AI Generation" title="Describe the dish" accentColor={THEME.purple}>
          <p style={{ color: '#9CA3AF', fontSize: 14, margin: '0 0 16px' }}>Describe the meal you want and Ruokanna will generate the full canonical recipe structure for you.</p>
          <textarea data-qa="recipe-ai-prompt" style={{ ...sharedInputStyle, minHeight: 110, resize: 'vertical' }} placeholder="High-protein chicken burrito bowl under 30 minutes..." value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} />
          <button data-qa="recipe-ai-generate" onClick={handleGenerate} disabled={extracting || !aiPrompt.trim()} style={{ width: '100%', marginTop: 12, padding: '14px', borderRadius: 12, border: 'none', background: '#00FF85', color: '#000', fontWeight: 800, cursor: 'pointer', opacity: extracting || !aiPrompt.trim() ? 0.65 : 1 }}>
            {extracting ? 'Generating...' : 'Generate Recipe'}
          </button>
          <ExtractionPulse isProcessing={extracting} rawTextStream={streamLines} entities={extractedEntities} />
          {error && <div data-qa="add-recipe-error" style={{ color: '#FCA5A5', fontSize: 13, marginTop: 10 }}>{error}</div>}
        </TacticalCard>
      )}

      {tab === 'manual' && !preview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <TacticalCard subtitle="Manual Entry" title="Recipe Overview" accentColor={THEME.green} style={{ display: 'grid', gap: 14 }}>
            <input style={sharedInputStyle} placeholder="Recipe title" value={manual.title} onChange={(event) => setManual((current) => ({ ...current, title: event.target.value }))} />
            <textarea style={{ ...sharedInputStyle, minHeight: 90, resize: 'vertical' }} placeholder="Short recipe description" value={manual.description} onChange={(event) => setManual((current) => ({ ...current, description: event.target.value }))} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              <input style={sharedInputStyle} placeholder="Cuisine" value={manual.cuisine} onChange={(event) => setManual((current) => ({ ...current, cuisine: event.target.value }))} />
              <select style={sharedInputStyle} value={manual.difficulty} onChange={(event) => setManual((current) => ({ ...current, difficulty: event.target.value }))}>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
              <input style={sharedInputStyle} type="number" placeholder="Prep time" value={manual.prep_time} onChange={(event) => setManual((current) => ({ ...current, prep_time: event.target.value }))} />
              <input style={sharedInputStyle} type="number" placeholder="Cook time" value={manual.cook_time} onChange={(event) => setManual((current) => ({ ...current, cook_time: event.target.value }))} />
              <input style={sharedInputStyle} type="number" placeholder="Servings" value={manual.servings} onChange={(event) => setManual((current) => ({ ...current, servings: event.target.value }))} />
              <input style={sharedInputStyle} type="number" placeholder="Cost" value={manual.cost_estimate} onChange={(event) => setManual((current) => ({ ...current, cost_estimate: event.target.value }))} />
              <input style={sharedInputStyle} type="number" placeholder="Calories" value={manual.calories} onChange={(event) => setManual((current) => ({ ...current, calories: event.target.value }))} />
              <input style={sharedInputStyle} type="number" placeholder="Protein" value={manual.protein} onChange={(event) => setManual((current) => ({ ...current, protein: event.target.value }))} />
              <input style={sharedInputStyle} type="number" placeholder="Carbs" value={manual.carbs} onChange={(event) => setManual((current) => ({ ...current, carbs: event.target.value }))} />
              <input style={sharedInputStyle} type="number" placeholder="Fat" value={manual.fat} onChange={(event) => setManual((current) => ({ ...current, fat: event.target.value }))} />
            </div>
          </TacticalCard>

          <TacticalCard subtitle="Manual Entry" title="Ingredients" accentColor={THEME.green}>
            <div style={{ color: '#6B7280', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Ingredients</div>
            {manual.ingredients.map((ingredient, index) => (
              <div key={index} style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr 0.6fr', gap: 8, marginBottom: 8 }}>
                <input style={sharedInputStyle} placeholder="Ingredient" value={ingredient.name} onChange={(event) => setManual((current) => {
                  const next = [...current.ingredients]
                  next[index] = { ...next[index], name: event.target.value }
                  return { ...current, ingredients: next }
                })} />
                <input style={sharedInputStyle} placeholder="Qty" value={ingredient.quantity} onChange={(event) => setManual((current) => {
                  const next = [...current.ingredients]
                  next[index] = { ...next[index], quantity: event.target.value }
                  return { ...current, ingredients: next }
                })} />
                <input style={sharedInputStyle} placeholder="Unit" value={ingredient.unit} onChange={(event) => setManual((current) => {
                  const next = [...current.ingredients]
                  next[index] = { ...next[index], unit: event.target.value }
                  return { ...current, ingredients: next }
                })} />
              </div>
            ))}
            <button onClick={() => setManual((current) => ({ ...current, ingredients: [...current.ingredients, { name: '', quantity: '', unit: '' }] }))} style={{ background: 'transparent', border: '1px dashed #2A2A2A', color: '#fff', borderRadius: 12, padding: '10px 14px', cursor: 'pointer' }}>
              Add ingredient
            </button>
          </TacticalCard>

          <TacticalCard subtitle="Manual Entry" title="Steps" accentColor={THEME.purple}>
            <div style={{ color: '#6B7280', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Steps</div>
            {manual.steps.map((step, index) => (
              <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 8, marginBottom: 8 }}>
                <textarea style={{ ...sharedInputStyle, minHeight: 74, resize: 'vertical' }} placeholder={`Step ${index + 1}`} value={step.instruction} onChange={(event) => setManual((current) => {
                  const next = [...current.steps]
                  next[index] = { ...next[index], instruction: event.target.value }
                  return { ...current, steps: next }
                })} />
                <input style={sharedInputStyle} type="number" placeholder="Timer sec" value={step.timer_seconds} onChange={(event) => setManual((current) => {
                  const next = [...current.steps]
                  next[index] = { ...next[index], timer_seconds: event.target.value }
                  return { ...current, steps: next }
                })} />
              </div>
            ))}
            <button onClick={() => setManual((current) => ({ ...current, steps: [...current.steps, { instruction: '', timer_seconds: '' }] }))} style={{ background: 'transparent', border: '1px dashed #2A2A2A', color: '#fff', borderRadius: 12, padding: '10px 14px', cursor: 'pointer' }}>
              Add step
            </button>
          </TacticalCard>

          {error && <div data-qa="add-recipe-error" style={{ color: '#FCA5A5', fontSize: 13 }}>{error}</div>}

          <button data-qa="recipe-manual-save" onClick={handleSave} disabled={saving || !manual.title.trim()} style={{ padding: '14px', borderRadius: 12, border: 'none', background: '#00FF85', color: '#000', fontWeight: 800, cursor: 'pointer', opacity: saving || !manual.title.trim() ? 0.65 : 1 }}>
            {saving ? 'Saving...' : 'Save Recipe'}
          </button>
        </div>
      )}

      {preview && (
        <div>
          <div data-qa="recipe-preview" style={{ ...glassCardStyle, borderRadius: 22, padding: 24, marginBottom: 20 }}>
            {preview.image_url && <img src={preview.image_url} alt={preview.title} style={{ width: '100%', height: 240, objectFit: 'cover', borderRadius: 16, marginBottom: 18 }} />}
            <h2 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 8px' }}>{preview.title}</h2>
            <p style={{ color: '#9CA3AF', fontSize: 15, lineHeight: 1.6, margin: '0 0 16px' }}>{preview.description}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
              <StatusChip label={preview.source_label || (preview.source_type || 'unknown').replace(/-/g, ' ')} type="source" />
              <StatusChip label={`${preview.prep_time + preview.cook_time} min`} type="match" />
              <StatusChip label={`${preview.protein}g protein`} type="protein" />
              <StatusChip label={`$${Number(preview.cost_estimate || 0).toFixed(2)}`} type="cost" />
            </div>
            {!!preview.macro_explainer && (
              <div style={{ background: '#111', border: '1px solid #2A2A2A', borderRadius: 16, padding: 14, color: '#D1D5DB', fontSize: 13, lineHeight: 1.6, marginBottom: 18 }}>
                {preview.macro_explainer}
              </div>
            )}

            <div style={{ marginBottom: 18 }}>
              <div style={{ color: '#6B7280', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Ingredients</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {(preview.ingredients || []).map((ingredient, index) => (
                  <div key={index} style={{ color: '#E5E7EB', borderBottom: '1px solid #2A2A2A', paddingBottom: 8 }}>
                    {[ingredient.quantity, ingredient.unit, ingredient.name].filter(Boolean).join(' ')}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ color: '#6B7280', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Steps</div>
              <div style={{ display: 'grid', gap: 12 }}>
                {(preview.steps || []).map((step, index) => (
                  <div key={index} style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 999, border: '1px solid #2A2A2A', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00FF85', fontWeight: 800, flexShrink: 0 }}>
                      {index + 1}
                    </div>
                    <div style={{ color: '#E5E7EB', lineHeight: 1.6 }}>{step.instruction}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {error && <div data-qa="add-recipe-error" style={{ color: '#FCA5A5', fontSize: 13, marginBottom: 12 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button data-qa="recipe-preview-reset" onClick={() => setPreview(null)} style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid #2A2A2A', background: 'transparent', color: '#fff', cursor: 'pointer' }}>
              Try Again
            </button>
            <button data-qa="recipe-preview-save" onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '14px', borderRadius: 12, border: 'none', background: '#00FF85', color: '#000', fontWeight: 800, cursor: 'pointer' }}>
              {saving ? 'Saving...' : 'Save Recipe'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
