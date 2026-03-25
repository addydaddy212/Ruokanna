import { Router } from 'express'
import { getSwapAlternatives, recommendRecipe } from '../lib/planning.js'

export const plannerRouter = Router()

plannerRouter.post('/recommend', async (req, res) => {
  const {
    recipes = [],
    profile = {},
    fridgeIngredients = [],
    slot = 'Dinner',
  } = req.body

  if (!Array.isArray(recipes) || !recipes.length) {
    return res.status(400).json({ error: 'recipes[] is required' })
  }

  const recommendation = recommendRecipe({ recipes, profile, fridgeIngredients, slot })

  if (!recommendation) {
    return res.status(422).json({ error: 'No recipe matched the current profile and fridge constraints.' })
  }

  return res.json({ recommendation })
})

plannerRouter.post('/swap', async (req, res) => {
  const {
    currentRecipe = null,
    recipes = [],
    profile = {},
    fridgeIngredients = [],
  } = req.body

  if (!currentRecipe || !Array.isArray(recipes) || !recipes.length) {
    return res.status(400).json({ error: 'currentRecipe and recipes[] are required' })
  }

  return res.json({
    alternatives: getSwapAlternatives({ currentRecipe, recipes, profile, fridgeIngredients }),
  })
})
