import { useEffect, useState } from 'react'
import { useRecipes } from '../hooks/useRecipes.js'
import { safeReadJsonResponse } from '../utils/safeReadJsonResponse.js'
import { THEME } from '../theme/styles.js'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getWeekStart() {
  const date = new Date()
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  return date.toISOString().split('T')[0]
}

export default function DebriefPage() {
  const { fetchWeeklyDebrief, fetchUserProfile } = useRecipes()
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [debrief, setDebrief] = useState({ entries: [], summary: { planned: 0, cooked: 0, skipped: 0, leftovers: 0 } })
  const [aiSummary, setAiSummary] = useState('')
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [aiState, setAiState] = useState('loading')
  const [error, setError] = useState('')
  const weekStart = getWeekStart()

  useEffect(() => {
    const load = async () => {
      try {
        const [data, profileData] = await Promise.all([
          fetchWeeklyDebrief(weekStart),
          fetchUserProfile().catch(() => null),
        ])
        setDebrief(data)
        setLoading(false)

        // Fetch AI summary
        setAiLoading(true)
        setAiState('loading')
        try {
          const res = await fetch('/api/debrief', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              planned: data.summary.planned,
              cooked: data.summary.cooked,
              skipped: data.summary.skipped,
              leftovers: data.summary.leftovers,
              goal: profileData?.goal || 'maintain',
              weekStart,
            }),
          })
          const ai = await safeReadJsonResponse(res, 'The AI debrief response was invalid.')
          if (!res.ok) throw new Error(ai.error || 'Could not generate AI summary.')
          setAiSummary(ai.summary || 'No summary available.')
          setAiSuggestions(Array.isArray(ai.suggestions) ? ai.suggestions : [])
          setAiState(ai.source === 'dev-fallback' ? 'fallback' : 'ready')
        } catch {
          setAiSummary('Could not generate AI summary — check your API keys or try again.')
          setAiSuggestions([])
          setAiState('error')
        }
        setAiLoading(false)
      } catch (err) {
        setError(err?.message || 'Failed to load weekly debrief.')
        setLoading(false)
        setAiLoading(false)
        setAiState('error')
      }
    }
    load()
  }, [])

  return (
    <div data-qa="debrief-page" style={{ padding: 28, maxWidth: 1080, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, margin: '0 0 8px' }}>Weekly Debrief</h1>
        <p style={{ color: '#9CA3AF', fontSize: 14, margin: 0 }}>See what was planned, what actually got cooked, and how leftovers changed the week.</p>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 14, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
        {[
          ['Planned Meals', debrief.summary.planned, '#fff'],
          ['Cooked', debrief.summary.cooked, '#00FF85'],
          ['Skipped', debrief.summary.skipped, '#FCA5A5'],
          ['Leftovers', debrief.summary.leftovers, '#FFB347'],
        ].map(([label, value, color]) => (
          <div key={label} style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 18, padding: 18 }}>
            <div style={{ color: '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 30, fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>

      {debrief.entries.length > 0 && (
        <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 22, padding: 20, marginBottom: 20 }}>
          <div style={{ color: '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Planned vs Actual Heatmap</div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8 }}>
            {DAY_LABELS.map((day) => (
              <div key={day} style={{ flex: 1, minWidth: 32, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', fontWeight: 800, marginBottom: 4 }}>{day}</div>
                {['Breakfast', 'Lunch', 'Dinner'].map(slot => {
                  const entry = debrief.entries.find(e => DAY_LABELS[new Date(e.date).getDay() === 0 ? 6 : new Date(e.date).getDay() - 1] === day && e.slot === slot)
                  let bg = '#111'
                  if (entry) {
                    bg = entry.status === 'cooked' ? THEME.green : entry.status === 'skipped' ? THEME.red : entry.leftovers ? THEME.amber : '#2A2A2A'
                  }
                  return (
                    <div key={slot} title={`${day} ${slot}: ${entry ? entry.status : 'Empty'}`} style={{ width: '100%', height: 32, borderRadius: 6, background: bg, border: `1px solid ${bg === '#111' ? '#222' : 'transparent'}`, transition: 'all 0.2s' }} />
                  )
                })}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 14, fontSize: 11, color: '#6B7280' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: THEME.green }} /> Cooked</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: THEME.red }} /> Skipped</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: THEME.amber }} /> Leftovers</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: '#2A2A2A' }} /> Planned</div>
          </div>
        </div>
      )}

      <div data-qa="debrief-summary-block" style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 22, padding: 20, marginBottom: 20 }}>
        <div style={{ color: '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>AI Summary</div>
        {aiLoading ? (
          <div style={{ color: '#6B7280', fontSize: 14, fontStyle: 'italic' }}>Generating AI summary…</div>
        ) : (
          <>
            <div data-qa="debrief-ai-status" style={{ color: '#6B7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              {aiState === 'fallback' ? 'Fallback Summary' : aiState === 'error' ? 'Summary Unavailable' : 'Summary Ready'}
            </div>
            <div style={{ color: '#E5E7EB', fontSize: 15, lineHeight: 1.6, marginBottom: 14 }}>{aiSummary || 'No summary available.'}</div>
            <div data-qa="debrief-suggestions-block">
              <div style={{ color: '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, marginTop: 4 }}>Next Week Suggestions</div>
              {aiSuggestions.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {aiSuggestions.map((s, i) => (
                    <li key={i} style={{ color: '#E5E7EB', fontSize: 14, lineHeight: 1.6, marginBottom: 4 }}>{s}</li>
                  ))}
                </ul>
              ) : (
                <div style={{ color: '#9CA3AF', fontSize: 14 }}>No adjustment suggestions yet.</div>
              )}
            </div>
          </>
        )}
      </div>

      {loading ? (
        <div style={{ color: '#9CA3AF', padding: 34, textAlign: 'center' }}>Loading weekly debrief...</div>
      ) : !debrief.entries.length ? (
        <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 22, padding: 34, textAlign: 'center', color: '#9CA3AF' }}>
          No meals logged yet this week.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {debrief.entries.map((entry) => {
            const dayLabel = DAY_LABELS[new Date(entry.date).getDay() === 0 ? 6 : new Date(entry.date).getDay() - 1]
            const statusColor = entry.status === 'cooked' ? '#00FF85' : entry.status === 'skipped' ? '#FCA5A5' : '#E5E7EB'

            return (
              <div key={`${entry.date}-${entry.slot}`} style={{ display: 'grid', gridTemplateColumns: '120px 110px 1fr auto', gap: 12, alignItems: 'center', background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 18, padding: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{dayLabel}</div>
                  <div style={{ fontWeight: 800 }}>{entry.slot}</div>
                </div>
                <div style={{ color: statusColor, fontWeight: 800, textTransform: 'capitalize' }}>{entry.status}</div>
                <div style={{ color: '#E5E7EB' }}>{entry.recipe?.title || 'Empty slot'}</div>
                <div style={{ color: entry.leftovers ? '#FFB347' : '#6B7280', fontWeight: 700 }}>
                  {entry.leftovers ? 'Leftovers kept' : 'No leftovers'}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
