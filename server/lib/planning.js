function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getTotalTime(recipe = {}) {
  return (Number(recipe.prep_time) || 0) + (Number(recipe.cook_time) || 0)
}

function ingredientMatches(ingredientName, fridgeItem) {
  const ingredient = normalizeText(ingredientName)
  const fridge = normalizeText(fridgeItem)

  if (!ingredient || !fridge) return false
  if (ingredient.includes(fridge) || fridge.includes(ingredient)) return true

  const ingredientTokens = ingredient.split(' ').filter(Boolean)
  const fridgeTokens = new Set(fridge.split(' ').filter(Boolean))

  return ingredientTokens.some((token) => token.length > 2 && fridgeTokens.has(token))
}

export function scoreRecipeByFridge(recipe = {}, fridgeIngredients = []) {
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : []
  const fridge = Array.isArray(fridgeIngredients) ? fridgeIngredients : []

  if (!ingredients.length || !fridge.length) return 0

  let matched = 0
  ingredients.forEach((ingredient) => {
    if (fridge.some((item) => ingredientMatches(ingredient.name, item))) {
      matched += 1
    }
  })

  return Math.round((matched / ingredients.length) * 100)
}

export function recipeMatchesProfile(recipe = {}, profile = {}) {
  const ingredientText = (recipe.ingredients || []).map((item) => item.name).join(' ')
  const text = normalizeText(`${recipe.title} ${recipe.description} ${ingredientText} ${(recipe.tags || []).join(' ')}`)
  const blocked = []
  const dietary = (profile.dietary_preferences || []).map((item) => normalizeText(item))
  const conditions = (profile.health_conditions || []).map((item) => normalizeText(item))

  ;(profile.allergies || []).forEach((allergy) => {
    const normalizedAllergy = normalizeText(allergy)
    if (normalizedAllergy && text.includes(normalizedAllergy)) {
      blocked.push(`contains ${allergy}`)
    }
  })

  if (dietary.includes('vegetarian') && /\b(chicken|turkey|beef|pork|salmon|shrimp|fish|meat)\b/.test(text)) {
    blocked.push('not vegetarian')
  }

  if (dietary.includes('vegan') && /\b(chicken|turkey|beef|pork|salmon|shrimp|fish|egg|yogurt|cheese|milk|butter)\b/.test(text)) {
    blocked.push('not vegan')
  }

  if (dietary.includes('gluten free') && /\bflour|bread|pasta|soy sauce|dumpling|noodle\b/.test(text)) {
    blocked.push('likely not gluten free')
  }

  if (conditions.includes('diabetes') && (Number(recipe.carbs) || 0) > 60) {
    blocked.push('high carb for diabetes-focused planning')
  }

  if (conditions.includes('hypertension') && /\bsoy sauce|bacon|sausage|ham|salty\b/.test(text)) {
    blocked.push('likely high sodium')
  }

  if (Number(profile.time_budget_minutes) > 0 && getTotalTime(recipe) > Number(profile.time_budget_minutes)) {
    blocked.push('over your time budget')
  }

  return {
    allowed: blocked.length === 0,
    blocked,
  }
}

export function getRecipeFitAnalysis(recipe = {}, profile = {}, fridgeIngredients = []) {
  const health = recipeMatchesProfile(recipe, profile)
  const reasons = []
  const fridgeMatch = scoreRecipeByFridge(recipe, fridgeIngredients)

  if ((Number(recipe.protein) || 0) >= 30) reasons.push('high protein')
  if (getTotalTime(recipe) > 0 && getTotalTime(recipe) <= Number(profile.time_budget_minutes || 30)) {
    reasons.push('fits your time budget')
  }
  if (fridgeMatch > 0) reasons.push(`${fridgeMatch}% fridge match`)
  if ((profile.dietary_preferences || []).length) reasons.push(`checked against ${profile.dietary_preferences.join(', ')}`)
  if ((profile.health_conditions || []).length) reasons.push(`screened for ${profile.health_conditions.join(', ')}`)

  return {
    allowed: health.allowed,
    blocked: health.blocked,
    reasons,
    fridge_match_score: fridgeMatch,
  }
}

export function recommendRecipe({ recipes = [], profile = {}, fridgeIngredients = [], slot = 'Dinner' }) {
  const weighted = (recipes || [])
    .map((recipe) => {
      const fit = getRecipeFitAnalysis(recipe, profile, fridgeIngredients)
      if (!fit.allowed) return null

      let score = fit.fridge_match_score
      score += Math.min(Number(recipe.protein) || 0, 60)
      score += Math.max(0, 40 - getTotalTime(recipe))
      score += (Number(recipe.calories) || 0) > 0 ? 10 : 0
      score += slot === 'Dinner' ? 5 : 0
      score += Number(recipe.servings) > 2 ? 5 : 0

      return {
        ...recipe,
        fit_analysis: fit,
        recommendation_score: score,
      }
    })
    .filter(Boolean)
    .sort((left, right) => (right.recommendation_score || 0) - (left.recommendation_score || 0))

  return weighted[0] || null
}

export function getSwapAlternatives({ currentRecipe, recipes = [], profile = {}, fridgeIngredients = [] }) {
  const allowedRecipes = (recipes || [])
    .map((recipe) => ({
      ...recipe,
      fit_analysis: getRecipeFitAnalysis(recipe, profile, fridgeIngredients),
    }))
    .filter((recipe) => recipe.fit_analysis.allowed && recipe.id !== currentRecipe?.id)

  const bestFit = recommendRecipe({ recipes: allowedRecipes, profile, fridgeIngredients }) || null
  const fastest = [...allowedRecipes].sort((a, b) => getTotalTime(a) - getTotalTime(b))[0] || null
  const cheapest = [...allowedRecipes].sort((a, b) => (a.cost_estimate || 0) - (b.cost_estimate || 0))[0] || null

  return [
    fastest ? { mode: 'Fastest', recipe: fastest } : null,
    cheapest ? { mode: 'Cheapest', recipe: cheapest } : null,
    bestFit ? { mode: 'Best Fit', recipe: bestFit } : null,
  ].filter(Boolean)
}
