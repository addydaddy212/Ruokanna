import { Router } from 'express'
import { generateAssistantReply, respondAIError } from '../lib/ai.js'

export const chatRouter = Router()

function buildSystemPrompt(context = {}) {
  const fridgeList = Array.isArray(context.fridge) ? context.fridge.slice(0, 40).join(', ') : ''
  const recipeList = Array.isArray(context.recipes)
    ? context.recipes
      .slice(0, 12)
      .map((recipe) => `${recipe.title}${recipe.protein ? ` (${recipe.protein}g protein)` : ''}${recipe.prep_time ? `, ${recipe.prep_time} min` : ''}`)
      .join('; ')
    : ''
  const dietary = Array.isArray(context.dietary_preferences) ? context.dietary_preferences.join(', ') : ''
  const allergies = Array.isArray(context.allergies) ? context.allergies.join(', ') : ''
  const conditions = Array.isArray(context.health_conditions) ? context.health_conditions.join(', ') : ''

  return `You are Ruokanna, an AI meal-planning and cooking assistant.

Be concise, practical, and encouraging.
Prefer actionable answers with meal ideas, substitutions, cooking tips, and simple planning advice.
Ground your answers in the supplied pantry, goals, health constraints, and saved recipes.
Explain tradeoffs when relevant, especially for calories, protein, prep time, and dietary restrictions.
When helpful, format with short bullets.

User context:
- Goal: ${context.goal || 'maintain'}
- Dietary preferences: ${dietary || 'None'}
- Allergies: ${allergies || 'None'}
- Health conditions: ${conditions || 'None'}
- Time budget: ${context.time_budget_minutes || 'Unknown'} minutes
- Fridge ingredients: ${fridgeList || 'Unknown'}
- Saved recipes: ${recipeList || 'None provided'}`
}

chatRouter.post('/', async (req, res) => {
  const { messages = [], context = {} } = req.body

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages[] is required' })
  }

  try {
    const text = await generateAssistantReply({
      systemPrompt: buildSystemPrompt(context),
      messages: messages.map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: String(message.content || ''),
      })),
      temperature: 0.7,
    })

    if (!text) {
      throw new Error('AI provider returned an empty chat response')
    }

    return res.json({ message: text.trim() })
  } catch (error) {
    return respondAIError(res, error, 'Chat failed.')
  }
})
