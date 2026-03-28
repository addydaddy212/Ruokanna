import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const PROFILE_META_PREFIX = 'ruokanna-profile-meta'
const MEAL_META_PREFIX = 'ruokanna-meal-meta'
let recipeInsertMode = 'unknown'
const DEFAULT_PROFILE_META = {
  display_name: '',
  product_name_preference: 'ruokanna',
  dietary_preferences: [],
  allergies: [],
  health_conditions: [],
  cooking_skill: 'intermediate',
  time_budget_minutes: 30,
  protein_target: 130,
  carb_target: 220,
  fat_target: 73,
}

function getStorageKey(prefix, userId) {
  return `${prefix}:${userId}`
}

function readLocalJSON(key, fallback) {
  if (typeof window === 'undefined') return fallback

  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeLocalJSON(key, value) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(value))
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getTotalTime(recipe) {
  return (Number(recipe?.prep_time) || 0) + (Number(recipe?.cook_time) || 0)
}

function normalizeIngredient(ingredient) {
  return {
    name: ingredient?.name || '',
    quantity: ingredient?.quantity ?? '',
    unit: ingredient?.unit ?? '',
    calories: Number(ingredient?.calories) || 0,
  }
}

function normalizeStep(step) {
  return {
    order_num: Number(step?.order_num) || 0,
    instruction: step?.instruction || '',
    timer_seconds: step?.timer_seconds == null || step?.timer_seconds === ''
      ? null
      : Number(step.timer_seconds) || 0,
  }
}

function getRecipeSourceType(recipe = {}) {
  const url = String(recipe.source_url || '')

  if (recipe.source_type) return recipe.source_type
  if (!url) return 'unknown'
  if (url.startsWith('ruokanna://manual')) return 'manual'
  if (url.startsWith('ruokanna://generated')) return 'ai-generated'
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube-transcript'
  if (/instagram\.com/i.test(url)) return 'instagram-video'

  try {
    const parsed = new URL(url)
    return parsed.protocol.startsWith('http') ? 'web-page' : 'unknown'
  } catch {
    return 'unknown'
  }
}

function getRecipeSourceLabel(recipe = {}) {
  const sourceType = getRecipeSourceType(recipe)

  if (sourceType === 'manual') return 'manual'
  if (sourceType === 'ai-generated') return 'ai generated'
  if (sourceType === 'youtube-transcript') return 'YouTube transcript'
  if (sourceType === 'instagram-video') return 'Instagram video'
  if (sourceType === 'web-page') return 'web page'
  return 'unknown source'
}

function getSourceDomain(recipe = {}) {
  const url = String(recipe.source_url || '')
  if (!url || url.startsWith('ruokanna://')) return ''

  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function getSourceConfidence(recipe = {}) {
  const sourceType = getRecipeSourceType(recipe)
  if (sourceType === 'manual') return 0.98
  if (sourceType === 'youtube-transcript') return 0.78
  if (sourceType === 'web-page') return 0.86
  if (sourceType === 'ai-generated') return 0.74
  return 0.6
}

function getNutritionSource(recipe = {}) {
  const macroTotal = (Number(recipe.calories) || 0) + (Number(recipe.protein) || 0) + (Number(recipe.carbs) || 0) + (Number(recipe.fat) || 0)
  const sourceType = getRecipeSourceType(recipe)

  if (!macroTotal) return 'missing'
  if (sourceType === 'manual') return 'manual entry'
  if (sourceType === 'web-page') return 'estimated from source content'
  if (sourceType === 'youtube-transcript') return 'estimated from transcript'
  if (sourceType === 'ai-generated') return 'estimated from AI generation'
  return 'estimated'
}

function getCostConfidence(recipe = {}) {
  return Number(recipe.cost_estimate) > 0 ? 'estimated' : 'missing'
}

function getMacroExplainer(recipe = {}) {
  const source = getNutritionSource(recipe)

  if (source === 'manual entry') {
    return 'Calories and macros were entered manually for this recipe.'
  }

  if (source === 'estimated from source content') {
    return 'Calories and macros are estimated from the source recipe content, not from a verified nutrition label.'
  }

  if (source === 'estimated from transcript') {
    return 'Calories and macros are estimated from a video transcript and ingredient inference.'
  }

  if (source === 'estimated from AI generation') {
    return 'Calories and macros are estimated by the recipe generation engine.'
  }

  return 'Calories and macros are still incomplete for this recipe.'
}

function formatSupabaseError(error) {
  const message = error?.message || String(error || '')

  if (error?.code === 'PGRST205' || /schema cache/i.test(message)) {
    return 'Supabase is missing the Ruokanna tables in this project. Run /home/aditya/mise/supabase_schema.sql and then /home/aditya/mise/supabase_schema_ruokanna_upgrade.sql in the Supabase SQL Editor, then try again.'
  }

  return message || 'Something went wrong while talking to Supabase.'
}

function shouldFallbackRecipeInsert(error) {
  const message = error?.message || ''
  return /column|schema cache|Could not find the column/i.test(message)
}

export function generateTags(recipe = {}) {
  const tags = []
  const totalTime = getTotalTime(recipe)

  if ((Number(recipe.protein) || 0) >= 30) tags.push('high-protein')
  if (totalTime > 0 && totalTime <= 15) tags.push('quick')
  if (totalTime > 0 && totalTime <= 30) tags.push('under-30')
  if ((Number(recipe.calories) || 0) <= 400 && (Number(recipe.calories) || 0) > 0) tags.push('low-cal')
  if ((Number(recipe.cost_estimate) || 0) <= 5 && (Number(recipe.cost_estimate) || 0) > 0) tags.push('budget')
  if (String(recipe.difficulty || '').toLowerCase() === 'easy') tags.push('easy')

  return [...new Set(tags)]
}

function normalizeRecipe(recipe = {}) {
  const derivedTags = generateTags(recipe)
  const savedTags = Array.isArray(recipe.tags) ? recipe.tags.filter(Boolean) : []
  const sourceType = getRecipeSourceType(recipe)

  return {
    ...recipe,
    title: recipe.title || 'Untitled Recipe',
    description: recipe.description || '',
    cuisine: recipe.cuisine || 'Other',
    difficulty: recipe.difficulty || 'Medium',
    prep_time: Number(recipe.prep_time) || 0,
    cook_time: Number(recipe.cook_time) || 0,
    servings: Number(recipe.servings) || 1,
    calories: Number(recipe.calories) || 0,
    protein: Number(recipe.protein) || 0,
    carbs: Number(recipe.carbs) || 0,
    fat: Number(recipe.fat) || 0,
    cost_estimate: Number(recipe.cost_estimate) || 0,
    goals: Array.isArray(recipe.goals) ? recipe.goals.filter(Boolean) : [],
    tags: [...new Set([...savedTags, ...derivedTags])],
    ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients.map(normalizeIngredient) : [],
    steps: Array.isArray(recipe.steps) ? recipe.steps.map(normalizeStep) : [],
    total_time: getTotalTime(recipe),
    source_type: sourceType,
    source_label: getRecipeSourceLabel(recipe),
    source_domain: getSourceDomain(recipe),
    source_confidence: getSourceConfidence(recipe),
    nutrition_source: recipe.nutrition_source || getNutritionSource(recipe),
    cost_confidence: recipe.cost_confidence || getCostConfidence(recipe),
    macro_explainer: recipe.macro_explainer || getMacroExplainer(recipe),
  }
}

function getProfileMeta(userId) {
  return userId
    ? readLocalJSON(getStorageKey(PROFILE_META_PREFIX, userId), {})
    : {}
}

function setProfileMeta(userId, updates) {
  if (!userId) return
  const current = { ...DEFAULT_PROFILE_META, ...getProfileMeta(userId) }
  writeLocalJSON(getStorageKey(PROFILE_META_PREFIX, userId), { ...current, ...updates })
}

function getMealMetaStore(userId) {
  return userId ? readLocalJSON(getStorageKey(MEAL_META_PREFIX, userId), {}) : {}
}

function setMealMetaStore(userId, nextValue) {
  if (!userId) return
  writeLocalJSON(getStorageKey(MEAL_META_PREFIX, userId), nextValue)
}

function getMealMetaKey(date, slot) {
  return `${date}::${slot}`
}

function recipeMatchesProfile(recipe = {}, profile = {}) {
  const allergyText = (profile.allergies || []).join(' ')
  const ingredientText = (recipe.ingredients || []).map((item) => item.name).join(' ')
  const text = normalizeText(`${recipe.title} ${recipe.description} ${ingredientText} ${(recipe.tags || []).join(' ')}`)
  const blocked = []

  ;(profile.allergies || []).forEach((allergy) => {
    if (normalizeText(allergy) && text.includes(normalizeText(allergy))) blocked.push(`contains ${allergy}`)
  })

  const dietary = (profile.dietary_preferences || []).map((item) => normalizeText(item))
  if (dietary.includes('vegetarian') && /\b(chicken|turkey|beef|pork|salmon|shrimp|fish|meat)\b/.test(text)) blocked.push('not vegetarian')
  if (dietary.includes('vegan') && /\b(chicken|turkey|beef|pork|salmon|shrimp|fish|egg|yogurt|cheese|milk|butter)\b/.test(text)) blocked.push('not vegan')
  if (dietary.includes('gluten free') && /\bflour|bread|pasta|soy sauce|dumpling|noodle\b/.test(text)) blocked.push('likely not gluten free')
  if ((profile.health_conditions || []).map((item) => normalizeText(item)).includes('diabetes') && (Number(recipe.carbs) || 0) > 60) blocked.push('high carb for diabetes-focused planning')
  if ((profile.health_conditions || []).map((item) => normalizeText(item)).includes('hypertension') && /\bsalty|soy sauce|bacon|sausage|ham\b/.test(text)) blocked.push('likely high sodium')
  if (Number(profile.time_budget_minutes) > 0 && getTotalTime(recipe) > Number(profile.time_budget_minutes)) blocked.push('over your time budget')

  return {
    allowed: blocked.length === 0,
    blocked,
  }
}

function getRecipeFitAnalysis(recipe = {}, profile = {}, fridgeIngredients = []) {
  const health = recipeMatchesProfile(recipe, profile)
  const reasons = []

  if ((Number(recipe.protein) || 0) >= 30) reasons.push('high protein')
  if (getTotalTime(recipe) > 0 && getTotalTime(recipe) <= Number(profile.time_budget_minutes || 30)) reasons.push('fits your time budget')
  if (scoreRecipeByFridge(recipe, fridgeIngredients) > 0) reasons.push(`${scoreRecipeByFridge(recipe, fridgeIngredients)}% fridge match`)
  if ((profile.dietary_preferences || []).length) reasons.push(`checked against ${profile.dietary_preferences.join(', ')}`)
  if ((profile.health_conditions || []).length) reasons.push(`screened for ${profile.health_conditions.join(', ')}`)

  return {
    allowed: health.allowed,
    blocked: health.blocked,
    reasons,
  }
}

function decorateRecipeForUI(recipe, profile, fridgeIngredients) {
  const analysis = getRecipeFitAnalysis(recipe, profile, fridgeIngredients)
  return {
    ...recipe,
    fit_analysis: analysis,
  }
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

export function filterRecipes(recipes = [], filters = {}) {
  return recipes.filter((recipe) => {
    const normalized = normalizeRecipe(recipe)
    const search = normalizeText(filters.search)
    const tag = filters.tag || ''
    const totalTime = getTotalTime(normalized)

    if (search) {
      const haystack = normalizeText([
        normalized.title,
        normalized.description,
        normalized.cuisine,
        normalized.difficulty,
        normalized.tags.join(' '),
      ].join(' '))

      if (!haystack.includes(search)) return false
    }

    if (filters.cuisine && filters.cuisine !== 'All' && normalized.cuisine !== filters.cuisine) return false
    if (filters.maxTime && totalTime > Number(filters.maxTime)) return false
    if (tag && tag !== 'All' && !normalized.tags.includes(tag)) return false
    if (filters.maxCost && normalized.cost_estimate > Number(filters.maxCost)) return false
    if (filters.minProtein && normalized.protein < Number(filters.minProtein)) return false

    return true
  })
}

function sortRecipes(recipes = [], sortBy = 'newest') {
  const sorted = [...recipes]

  sorted.sort((left, right) => {
    if (sortBy === 'protein') return (right.protein || 0) - (left.protein || 0)
    if (sortBy === 'quickest') return getTotalTime(left) - getTotalTime(right)
    if (sortBy === 'cheapest') return (left.cost_estimate || 0) - (right.cost_estimate || 0)
    if (sortBy === 'fridge-match') return (right.fridge_match_score || 0) - (left.fridge_match_score || 0)
    return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime()
  })

  return sorted
}

function getWeekDates(weekStart) {
  const start = new Date(weekStart)
  return DAY_LABELS.map((day, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return {
      day,
      date: date.toISOString().split('T')[0],
    }
  })
}

export function useRecipes() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchRecipes = async (filters = {}) => {
    if (!user?.id) return []

    setLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('recipes')
      .select('*, ingredients(*), steps(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setLoading(false)

    if (queryError) {
      setError(queryError.message)
      return []
    }

    const normalizedRecipes = (data || []).map(normalizeRecipe)
    return filterRecipes(normalizedRecipes, filters)
  }

  const fetchRecipeById = async (id) => {
    if (!user?.id) return null

    const { data, error: queryError } = await supabase
      .from('recipes')
      .select('*, ingredients(*), steps(*)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (queryError) {
      setError(queryError.message)
      return null
    }

    return normalizeRecipe(data)
  }

  const saveRecipe = async (recipe) => {
    if (!user?.id) throw new Error('Please sign in to save recipes.')

    const normalized = normalizeRecipe(recipe)
    const sourceType = recipe.source_type
      || (recipe.source_url ? getRecipeSourceType(recipe) : null)
      || (recipe.source_label === 'manual' ? 'manual' : null)
      || 'manual'
    const persistedSourceUrl = recipe.source_url
      || (sourceType === 'ai-generated' ? 'ruokanna://generated' : null)
      || (sourceType === 'manual' ? 'ruokanna://manual' : null)

    const basePayload = {
      user_id: user.id,
      title: normalized.title,
      description: normalized.description,
      cuisine: normalized.cuisine,
      difficulty: normalized.difficulty,
      prep_time: normalized.prep_time,
      cook_time: normalized.cook_time,
      servings: normalized.servings,
      calories: normalized.calories,
      protein: normalized.protein,
      carbs: normalized.carbs,
      fat: normalized.fat,
      cost_estimate: normalized.cost_estimate,
      goals: normalized.goals,
      source_url: persistedSourceUrl,
      image_url: recipe.image_url || null,
    }
    const extendedPayload = {
      ...basePayload,
      source_type: normalized.source_type,
      source_domain: normalized.source_domain || null,
      source_confidence: normalized.source_confidence || null,
      nutrition_source: normalized.nutrition_source || null,
      cost_confidence: normalized.cost_confidence || null,
    }

    let data = null
    let saveError = null

    if (recipeInsertMode !== 'base') {
      const extendedInsert = await supabase
        .from('recipes')
        .insert(extendedPayload)
        .select()
        .single()

      data = extendedInsert.data
      saveError = extendedInsert.error

      if (!saveError) {
        recipeInsertMode = 'extended'
      } else if (!shouldFallbackRecipeInsert(saveError)) {
        recipeInsertMode = 'extended'
      }
    }

    if (recipeInsertMode === 'base' || (saveError && shouldFallbackRecipeInsert(saveError))) {
      const baseInsert = await supabase
        .from('recipes')
        .insert(basePayload)
        .select()
        .single()

      recipeInsertMode = 'base'
      data = baseInsert.data
      saveError = baseInsert.error
    }

    if (saveError) {
      const message = formatSupabaseError(saveError)
      setError(message)
      throw new Error(message)
    }

    if (normalized.ingredients.length) {
      const { error: ingredientError } = await supabase
        .from('ingredients')
        .insert(normalized.ingredients.map((ingredient) => ({
          recipe_id: data.id,
          name: ingredient.name,
          quantity: ingredient.quantity || null,
          unit: ingredient.unit || null,
          calories: ingredient.calories || 0,
        })))

      if (ingredientError) {
        await supabase.from('recipes').delete().eq('id', data.id).eq('user_id', user.id)
        const message = formatSupabaseError(ingredientError)
        setError(message)
        throw new Error(message)
      }
    }

    if (normalized.steps.length) {
      const { error: stepError } = await supabase
        .from('steps')
        .insert(normalized.steps.map((step, index) => ({
          recipe_id: data.id,
          order_num: index + 1,
          instruction: step.instruction,
          timer_seconds: step.timer_seconds,
        })))

      if (stepError) {
        await supabase.from('recipes').delete().eq('id', data.id).eq('user_id', user.id)
        const message = formatSupabaseError(stepError)
        setError(message)
        throw new Error(message)
      }
    }

    return fetchRecipeById(data.id)
  }

  const deleteRecipe = async (id) => {
    if (!user?.id) return false

    const { error: deleteError } = await supabase
      .from('recipes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      setError(formatSupabaseError(deleteError))
      return false
    }

    return true
  }

  const fetchMealPlan = async (weekStart) => {
    if (!user?.id) return []

    const weekDates = getWeekDates(weekStart)
    const endDate = weekDates[weekDates.length - 1].date

    const { data, error: queryError } = await supabase
      .from('meal_plan')
      .select('*, recipes(*, ingredients(*), steps(*))')
      .eq('user_id', user.id)
      .gte('date', weekStart)
      .lte('date', endDate)
      .order('date', { ascending: true })

    if (queryError) {
      setError(formatSupabaseError(queryError))
      return []
    }

    const localMealMeta = getMealMetaStore(user.id)

    return (data || []).map((entry) => ({
      ...entry,
      local_meta: localMealMeta[getMealMetaKey(entry.date, entry.slot)] || {},
      recipe: entry.recipes ? normalizeRecipe(entry.recipes) : null,
      recipes: entry.recipes ? normalizeRecipe(entry.recipes) : null,
    }))
  }

  const setMealPlanSlot = async (date, slot, recipeId) => {
    if (!user?.id) return false

    const { error: upsertError } = await supabase
      .from('meal_plan')
      .upsert({
        user_id: user.id,
        date,
        slot,
        recipe_id: recipeId,
      }, { onConflict: 'user_id,date,slot' })

    if (upsertError) {
      setError(formatSupabaseError(upsertError))
      return false
    }

    return true
  }

  const clearMealPlanSlot = async (date, slot) => {
    if (!user?.id) return false

    const { error: deleteError } = await supabase
      .from('meal_plan')
      .delete()
      .eq('user_id', user.id)
      .eq('date', date)
      .eq('slot', slot)

    if (deleteError) {
      setError(formatSupabaseError(deleteError))
      return false
    }

    return true
  }

  const fetchWeeklyMacros = async (weekStart) => {
    const weekDates = getWeekDates(weekStart)
    const entries = await fetchMealPlan(weekStart)

    const days = weekDates.map(({ day, date }) => ({
      day,
      date,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      cost: 0,
      meals: 0,
    }))

    entries.forEach((entry) => {
      const day = days.find((item) => item.date === entry.date)
      const recipe = entry.recipe

      if (!day || !recipe) return

      day.calories += recipe.calories || 0
      day.protein += recipe.protein || 0
      day.carbs += recipe.carbs || 0
      day.fat += recipe.fat || 0
      day.cost += recipe.cost_estimate || 0
      day.meals += 1
    })

    const totals = days.reduce((acc, day) => ({
      calories: acc.calories + day.calories,
      protein: acc.protein + day.protein,
      carbs: acc.carbs + day.carbs,
      fat: acc.fat + day.fat,
      cost: acc.cost + day.cost,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0, cost: 0 })

    return {
      days,
      totals,
      averages: {
        calories: Math.round(totals.calories / 7),
        protein: Math.round(totals.protein / 7),
        carbs: Math.round(totals.carbs / 7),
        fat: Math.round(totals.fat / 7),
        cost: Number((totals.cost / 7).toFixed(2)),
      },
    }
  }

  const fetchUserProfile = async () => {
    if (!user?.id) return null

    const { data, error: queryError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (queryError) {
      setError(formatSupabaseError(queryError))
      return null
    }

    const localMeta = getProfileMeta(user.id)
    return {
      ...DEFAULT_PROFILE_META,
      ...(data || {}),
      ...localMeta,
      goal: data?.goal || localMeta.goal || 'maintain',
      calorie_target: data?.calorie_target || null,
    }
  }

  const updateUserProfile = async (updates) => {
    if (!user?.id) return false

    const localUpdates = {
      display_name: updates.display_name,
      product_name_preference: updates.product_name_preference,
      dietary_preferences: updates.dietary_preferences,
      allergies: updates.allergies,
      health_conditions: updates.health_conditions,
      cooking_skill: updates.cooking_skill,
      time_budget_minutes: updates.time_budget_minutes,
      protein_target: updates.protein_target,
      carb_target: updates.carb_target,
      fat_target: updates.fat_target,
    }
    setProfileMeta(user.id, Object.fromEntries(Object.entries(localUpdates).filter(([, value]) => value !== undefined)))

    const primaryUpdates = {
      id: user.id,
      ...(updates.goal !== undefined ? { goal: updates.goal } : {}),
      ...(updates.calorie_target !== undefined ? { calorie_target: updates.calorie_target } : {}),
    }

    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert(primaryUpdates)

    if (upsertError) {
      setError(formatSupabaseError(upsertError))
      return false
    }

    return true
  }

  const fetchFridge = async () => {
    if (!user?.id) return []

    const { data, error: queryError } = await supabase
      .from('user_fridge')
      .select('*')
      .eq('user_id', user.id)
      .order('ingredient_name', { ascending: true })

    if (queryError) {
      setError(formatSupabaseError(queryError))
      return []
    }

    return data || []
  }

  const updateFridge = async (ingredients) => {
    if (!user?.id) return false

    const uniqueIngredients = [...new Set((ingredients || []).map((item) => String(item).trim().toLowerCase()).filter(Boolean))]

    const { error: deleteError } = await supabase
      .from('user_fridge')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      setError(formatSupabaseError(deleteError))
      return false
    }

    if (!uniqueIngredients.length) return true

    const { error: insertError } = await supabase
      .from('user_fridge')
      .insert(uniqueIngredients.map((ingredient_name) => ({ user_id: user.id, ingredient_name })))

    if (insertError) {
      setError(formatSupabaseError(insertError))
      return false
    }

    return true
  }

  const fetchRecipesByFridgeMatch = async (fridgeIngredients) => {
    const recipes = await fetchRecipes()
    return sortRecipes(recipes.map((recipe) => ({
      ...recipe,
      fridge_match_score: scoreRecipeByFridge(recipe, fridgeIngredients),
    })), 'fridge-match')
  }

  const filterRecipesForProfile = (recipes = [], profile = {}, fridgeIngredients = []) =>
    recipes
      .map((recipe) => decorateRecipeForUI(recipe, profile, fridgeIngredients))
      .filter((recipe) => recipe.fit_analysis.allowed)

  const recommendRecipe = ({ recipes = [], profile = {}, fridgeIngredients = [], slot = 'Dinner' }) => {
    const candidates = filterRecipesForProfile(recipes, profile, fridgeIngredients)
    const weighted = candidates.map((recipe) => {
      let score = 0
      score += scoreRecipeByFridge(recipe, fridgeIngredients)
      score += Math.min(Number(recipe.protein) || 0, 60)
      score += Math.max(0, 40 - getTotalTime(recipe))
      score += (Number(recipe.calories) || 0) > 0 ? 10 : 0
      if (slot === 'Dinner') score += recipe.cuisine ? 5 : 0
      return { ...recipe, recommendation_score: score }
    })

    weighted.sort((left, right) => (right.recommendation_score || 0) - (left.recommendation_score || 0))
    return weighted[0] || null
  }

  const getSwapAlternatives = ({ currentRecipe, recipes = [], profile = {}, fridgeIngredients = [] }) => {
    const filtered = filterRecipesForProfile(recipes, profile, fridgeIngredients)
      .filter((recipe) => recipe.id !== currentRecipe?.id)
    const fastest = [...filtered].sort((a, b) => getTotalTime(a) - getTotalTime(b))[0] || null
    const cheapest = [...filtered].sort((a, b) => (a.cost_estimate || 0) - (b.cost_estimate || 0))[0] || null
    const bestFit = recommendRecipe({ recipes: filtered, profile, fridgeIngredients }) || null

    return [
      fastest ? { mode: 'Fastest', recipe: fastest } : null,
      cheapest ? { mode: 'Cheapest', recipe: cheapest } : null,
      bestFit ? { mode: 'Best Fit', recipe: bestFit } : null,
    ].filter(Boolean)
  }

  const getMealMeta = (date, slot) => getMealMetaStore(user?.id)[getMealMetaKey(date, slot)] || {}

  const updateMealMeta = (date, slot, updates) => {
    if (!user?.id) return null
    const store = getMealMetaStore(user.id)
    const key = getMealMetaKey(date, slot)
    store[key] = { ...(store[key] || {}), ...updates }
    setMealMetaStore(user.id, store)
    return store[key]
  }

  const toggleMealLeftovers = (date, slot, enabled, recipe) =>
    updateMealMeta(date, slot, {
      leftovers: Boolean(enabled),
      leftover_recipe_id: enabled ? recipe?.id || null : null,
      leftover_recipe_title: enabled ? recipe?.title || null : null,
      updated_at: new Date().toISOString(),
    })

  const setMealStatus = (date, slot, status) =>
    updateMealMeta(date, slot, {
      status,
      updated_at: new Date().toISOString(),
    })

  const fetchWeeklyDebrief = async (weekStart) => {
    const entries = await fetchMealPlan(weekStart)
    const store = getMealMetaStore(user?.id)
    const enrichedEntries = entries.map((entry) => ({
      ...entry,
      status: store[getMealMetaKey(entry.date, entry.slot)]?.status || 'planned',
      leftovers: Boolean(store[getMealMetaKey(entry.date, entry.slot)]?.leftovers),
    }))
    const summary = enrichedEntries.reduce((acc, entry) => {
      acc.planned += 1
      if (entry.status === 'cooked') acc.cooked += 1
      if (entry.status === 'skipped') acc.skipped += 1
      if (entry.leftovers) acc.leftovers += 1
      return acc
    }, { planned: 0, cooked: 0, skipped: 0, leftovers: 0 })

    return {
      entries: enrichedEntries,
      summary,
    }
  }

  return {
    loading,
    error,
    fetchRecipes,
    fetchRecipeById,
    saveRecipe,
    deleteRecipe,
    fetchMealPlan,
    setMealPlanSlot,
    clearMealPlanSlot,
    fetchWeeklyMacros,
    fetchUserProfile,
    updateUserProfile,
    fetchFridge,
    updateFridge,
    fetchRecipesByFridgeMatch,
    filterRecipesForProfile,
    recommendRecipe,
    getSwapAlternatives,
    getRecipeFitAnalysis,
    getMealMeta,
    toggleMealLeftovers,
    setMealStatus,
    fetchWeeklyDebrief,
    generateTags,
    scoreRecipeByFridge,
    filterRecipes,
    sortRecipes,
  }
}
