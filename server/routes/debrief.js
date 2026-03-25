import { Router } from 'express'
import { generateAssistantReply, isDevAIFallbackEnabled, respondAIError } from '../lib/ai.js'

export const debriefRouter = Router()

function buildFallbackDebrief({ planned = 0, cooked = 0, skipped = 0, leftovers = 0, goal = 'maintain', weekStart = '' }) {
  const adherence = planned > 0 ? Math.round((cooked / planned) * 100) : 0
  const summary = planned > 0
    ? `For the week starting ${weekStart || 'this week'}, you cooked ${cooked} of ${planned} planned meals while targeting ${goal}. ${skipped ? `${skipped} meals were skipped` : 'Nothing was skipped'}, and ${leftovers} leftover reuse moments helped keep the week moving. Overall adherence landed at ${adherence}%.`
    : `No planned meals were logged for the week starting ${weekStart || 'this week'}, so Ruokanna does not have enough actual-vs-planned data yet. Start with a few anchored meals and next week's debrief will be much more specific.`

  const suggestions = []

  if (skipped > 0) suggestions.push('Schedule one easier fallback dinner on your busiest day so skipped meals do not pile up.')
  if (leftovers === 0) suggestions.push('Plan one deliberate leftover dinner next week to reduce prep load and grocery waste.')
  if (goal === 'cut') suggestions.push('Keep dinner protein high and front-load lower-cost lunches so your calorie target is easier to hold.')
  if (goal === 'bulk') suggestions.push('Add one higher-calorie snack or second carb source on training days to support your bulk target.')
  if (goal === 'maintain') suggestions.push('Keep one repeatable breakfast and one quick lunch in rotation to stabilize your week.')
  if (planned > 0 && cooked < planned) suggestions.push('Trim next week to the number of meals you realistically cooked this week, then scale back up.')

  while (suggestions.length < 3) {
    suggestions.push('Use the dashboard auto-plan plus one manual swap to keep variety high without overcommitting.')
  }

  return {
    summary,
    suggestions: suggestions.slice(0, 3),
  }
}

debriefRouter.post('/', async (req, res) => {
  const { planned = 0, cooked = 0, skipped = 0, leftovers = 0, goal = 'maintain', weekStart = '' } = req.body

  const userPrompt = `Weekly meal plan debrief for week starting ${weekStart || 'this week'}:
- Goal: ${goal}
- Meals planned: ${planned}
- Meals cooked: ${cooked}
- Meals skipped: ${skipped}
- Leftovers used: ${leftovers}

Please provide:
1. A 2-3 sentence summary of how the week went based on these stats.
2. Three specific, actionable suggestions for next week's meal planning.

Respond as JSON: { "summary": "...", "suggestions": ["...", "...", "..."] }`

  try {
    const text = await generateAssistantReply({
      systemPrompt: 'You are Ruokanna, an AI meal-planning assistant. Be concise, practical, and data-driven. Always respond with valid JSON.',
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.6,
    })

    // Try to parse JSON from the response
    let parsed = { summary: '', suggestions: [] }
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
    } catch {
      // If JSON parse fails, use the raw text as the summary
      parsed = { summary: text.trim(), suggestions: [] }
    }

    const fallback = buildFallbackDebrief({ planned, cooked, skipped, leftovers, goal, weekStart })

    return res.json({
      summary: parsed.summary || text.trim() || fallback.summary,
      suggestions: Array.isArray(parsed.suggestions) && parsed.suggestions.length ? parsed.suggestions.slice(0, 3) : fallback.suggestions,
      source: Array.isArray(parsed.suggestions) && parsed.suggestions.length && parsed.summary ? 'ai' : 'dev-fallback',
    })
  } catch (error) {
    if (isDevAIFallbackEnabled()) {
      return res.json({
        ...buildFallbackDebrief({ planned, cooked, skipped, leftovers, goal, weekStart }),
        source: 'dev-fallback',
      })
    }

    return respondAIError(res, error, 'Debrief summary failed.')
  }
})
