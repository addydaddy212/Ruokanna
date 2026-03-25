import { useEffect, useState } from 'react'
import { useRecipes } from '../hooks/useRecipes.js'
import TacticalCard from '../components/common/TacticalCard.jsx'
import MacroHUD from '../components/common/MacroHUD.jsx'
import { THEME, inputStyle as sharedInputStyle } from '../theme/styles.js'

const TARGETS = {
  cut: { calories: 1800, protein: 150, carbs: 150, fat: 60 },
  maintain: { calories: 2200, protein: 130, carbs: 220, fat: 73 },
  bulk: { calories: 2800, protein: 180, carbs: 320, fat: 93 },
}

function getWeekStart() {
  const date = new Date()
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  return date.toISOString().split('T')[0]
}

function MacroBar({ label, value, target, color, unit = 'g' }) {
  const width = Math.min((value / target) * 100, 100)

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
        <span style={{ color: '#9CA3AF' }}>{label}</span>
        <span style={{ color: '#fff', fontWeight: 700 }}>
          {Math.round(value)}{unit} <span style={{ color: '#6B7280', fontWeight: 500 }}>/ {target}{unit}</span>
        </span>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: '#111', border: '1px solid #2A2A2A', overflow: 'hidden' }}>
        <div style={{ width: `${width}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.25s ease' }} />
      </div>
    </div>
  )
}

export default function MacrosPage() {
  const weekStart = getWeekStart()
  const { fetchUserProfile, updateUserProfile, fetchWeeklyMacros } = useRecipes()
  const [goal, setGoal] = useState('maintain')
  const [profile, setProfile] = useState({
    dietary_preferences: [],
    allergies: [],
    health_conditions: [],
    time_budget_minutes: 30,
    cooking_skill: 'intermediate',
    protein_target: TARGETS.maintain.protein,
    carb_target: TARGETS.maintain.carbs,
    fat_target: TARGETS.maintain.fat,
  })
  const [saved, setSaved] = useState(false)
  const [weeklyData, setWeeklyData] = useState({ days: [], averages: { calories: 0, protein: 0, cost: 0 } })
  const [activeDay, setActiveDay] = useState('Mon')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [profileData, macros] = await Promise.all([fetchUserProfile(), fetchWeeklyMacros(weekStart)])
      if (profileData?.goal) setGoal(profileData.goal)
      if (profileData) {
        setProfile({
          dietary_preferences: profileData.dietary_preferences || [],
          allergies: profileData.allergies || [],
          health_conditions: profileData.health_conditions || [],
          time_budget_minutes: profileData.time_budget_minutes || 30,
          cooking_skill: profileData.cooking_skill || 'intermediate',
          protein_target: profileData.protein_target || TARGETS[profileData.goal || 'maintain'].protein,
          carb_target: profileData.carb_target || TARGETS[profileData.goal || 'maintain'].carbs,
          fat_target: profileData.fat_target || TARGETS[profileData.goal || 'maintain'].fat,
        })
      }
      setWeeklyData(macros)
    } catch (loadError) {
      setError(loadError?.message || 'Failed to load macro data.')
    }

    setLoading(false)
  }

  async function handleSave(nextGoal) {
    const nextTargets = TARGETS[nextGoal]
    setGoal(nextGoal)
    setProfile((current) => ({
      ...current,
      protein_target: nextTargets.protein,
      carb_target: nextTargets.carbs,
      fat_target: nextTargets.fat,
    }))
    await updateUserProfile({
      goal: nextGoal,
      calorie_target: nextTargets.calories,
      protein_target: nextTargets.protein,
      carb_target: nextTargets.carbs,
      fat_target: nextTargets.fat,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }

  async function saveProfileSettings() {
    await updateUserProfile(profile)
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }

  const targets = TARGETS[goal]
  const activeStats = weeklyData.days.find((day) => day.day === activeDay) || { calories: 0, protein: 0, carbs: 0, fat: 0, cost: 0 }
  return (
    <div data-qa="macros-page" style={{ padding: 28, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: '0 0 8px' }}>Macro Autopilot</h1>
          <p style={{ color: '#9CA3AF', fontSize: 14, margin: 0 }}>Track real macro totals from your meal plan and compare them against your current goal.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, background: '#111', borderRadius: 14, border: '1px solid #2A2A2A', padding: 4 }}>
          {['cut', 'maintain', 'bulk'].map((item) => (
            <button data-qa={`macro-goal-${item}`} key={item} onClick={() => handleSave(item)} style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: 'none',
              background: goal === item ? '#00FF85' : 'transparent',
              color: goal === item ? '#000' : '#9CA3AF',
              textTransform: 'capitalize',
              cursor: 'pointer',
              fontWeight: 800,
            }}>
              {item}
            </button>
          ))}
        </div>
      </div>

      {saved && <div style={{ color: '#00FF85', fontSize: 13, marginBottom: 16 }}>Profile settings saved.</div>}

      {error && (
        <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 14, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5', fontSize: 13 }}>
          {error}
        </div>
      )}

      <TacticalCard subtitle="Profile Constraints" title="Health + preference filters" accentColor={THEME.amber} style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Health + Preference Filters</div>
            <div style={{ color: '#9CA3AF', fontSize: 14 }}>These drive recommendations, swaps, and why Ruokanna excludes certain meals.</div>
          </div>
          <button onClick={saveProfileSettings} style={{ padding: '12px 18px', borderRadius: 12, border: 'none', background: '#00FF85', color: '#000', fontWeight: 800, cursor: 'pointer' }}>
            Save Filters
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div>
            <div style={{ color: '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Dietary Preferences</div>
            <input style={sharedInputStyle} value={(profile.dietary_preferences || []).join(', ')} onChange={(event) => setProfile((current) => ({ ...current, dietary_preferences: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) }))} placeholder="vegetarian, gluten free" />
          </div>
          <div>
            <div style={{ color: '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Allergies</div>
            <input style={sharedInputStyle} value={(profile.allergies || []).join(', ')} onChange={(event) => setProfile((current) => ({ ...current, allergies: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) }))} placeholder="peanut, shellfish" />
          </div>
          <div>
            <div style={{ color: '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Health Conditions</div>
            <input style={sharedInputStyle} value={(profile.health_conditions || []).join(', ')} onChange={(event) => setProfile((current) => ({ ...current, health_conditions: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) }))} placeholder="diabetes, hypertension" />
          </div>
          <div>
            <div style={{ color: '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Time Budget</div>
            <input style={sharedInputStyle} type="number" min="5" value={profile.time_budget_minutes || 30} onChange={(event) => setProfile((current) => ({ ...current, time_budget_minutes: Number(event.target.value) || 30 }))} />
          </div>
          <div>
            <div style={{ color: '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Cooking Skill</div>
            <select style={sharedInputStyle} value={profile.cooking_skill || 'intermediate'} onChange={(event) => setProfile((current) => ({ ...current, cooking_skill: event.target.value }))}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div>
            <div style={{ color: '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Protein Target</div>
            <input style={sharedInputStyle} type="number" min="0" value={profile.protein_target || targets.protein} onChange={(event) => setProfile((current) => ({ ...current, protein_target: Number(event.target.value) || 0 }))} />
          </div>
          <div>
            <div style={{ color: '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Carb Target</div>
            <input style={sharedInputStyle} type="number" min="0" value={profile.carb_target || targets.carbs} onChange={(event) => setProfile((current) => ({ ...current, carb_target: Number(event.target.value) || 0 }))} />
          </div>
          <div>
            <div style={{ color: '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Fat Target</div>
            <input style={sharedInputStyle} type="number" min="0" value={profile.fat_target || targets.fat} onChange={(event) => setProfile((current) => ({ ...current, fat_target: Number(event.target.value) || 0 }))} />
          </div>
        </div>
      </TacticalCard>

      <div data-qa="macro-weekly-averages" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          ['Avg Calories / Day', `${Math.round(weeklyData.averages?.calories || 0)} kcal`, '#00FF85'],
          ['Avg Protein / Day', `${Math.round(weeklyData.averages?.protein || 0)} g`, '#c084fc'],
          ['Avg Cost / Day', `$${Number(weeklyData.averages?.cost || 0).toFixed(2)}`, '#FFB347'],
        ].map(([label, value, color]) => (
          <div key={label} style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 18, padding: 18 }}>
            <div style={{ color: '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto', paddingBottom: 4 }}>
        {(weeklyData.days || []).map((day) => {
          const selected = activeDay === day.day
          return (
            <button data-qa={`macro-day-${day.day.toLowerCase()}`} key={day.day} onClick={() => setActiveDay(day.day)} style={{
              minWidth: 110,
              padding: '10px 14px',
              borderRadius: 14,
              border: `1px solid ${selected ? '#00FF85' : '#2A2A2A'}`,
              background: selected ? 'rgba(0,255,133,0.08)' : '#1A1A1A',
              color: selected ? '#00FF85' : '#fff',
              cursor: 'pointer',
              textAlign: 'left',
            }}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>{day.day}</div>
              <div style={{ fontSize: 12, color: selected ? '#9AFAC8' : '#9CA3AF' }}>{Math.round(day.calories)} kcal</div>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ color: '#9CA3AF', textAlign: 'center', padding: 38 }}>Loading macro data...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
          <TacticalCard data-qa="macro-day-breakdown" subtitle={activeDay} title="Actual vs target" accentColor={THEME.purple}>
            <MacroHUD
              calories={activeStats.calories}
              protein={activeStats.protein}
              carbs={activeStats.carbs}
              fat={activeStats.fat}
              targets={{
                calories: targets.calories,
                protein: profile.protein_target || targets.protein,
                carbs: profile.carb_target || targets.carbs,
                fat: profile.fat_target || targets.fat,
              }}
              compact
            />
          </TacticalCard>

          <TacticalCard subtitle="Daily Cost" title={`$${Number(activeStats.cost || 0).toFixed(2)}`} accentColor={THEME.amber}>
            <div style={{ color: '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Daily Cost</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {(weeklyData.days || []).map((day) => (
                <div key={day.day} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid #2A2A2A', fontSize: 14 }}>
                  <span style={{ color: '#9CA3AF' }}>{day.day}</span>
                  <span style={{ color: '#fff', fontWeight: 700 }}>${Number(day.cost || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </TacticalCard>
        </div>
      )}
    </div>
  )
}
