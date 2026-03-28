import { Router } from 'express'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { generateStructuredObject, isDevAIFallbackEnabled, readUrlAsMarkdown, respondAIError } from '../lib/ai.js'
import {
  createHttpError,
  fetchYouTubeTranscript,
  getSourceDomain,
  getSourceType,
  isInstagramUrl,
  isYouTubeUrl,
} from '../lib/ingestion.js'

export const recipeRouter = Router()

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
const COMMON_UNITS = new Set([
  'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons',
  'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds', 'g', 'gram', 'grams',
  'kg', 'ml', 'l', 'liter', 'liters', 'packet', 'packets', 'can', 'cans', 'clove',
  'cloves', 'slice', 'slices',
])
const RECIPE_JSON_SCHEMA = {
  name: 'recipe_payload',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      cuisine: { type: 'string' },
      difficulty: { type: 'string' },
      prep_time: { type: 'number' },
      cook_time: { type: 'number' },
      servings: { type: 'number' },
      calories: { type: 'number' },
      protein: { type: 'number' },
      carbs: { type: 'number' },
      fat: { type: 'number' },
      cost_estimate: { type: 'number' },
      goals: { type: 'array', items: { type: 'string' } },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            quantity: { type: 'string' },
            unit: { type: 'string' },
            calories: { type: 'number' },
          },
          required: ['name', 'quantity', 'unit', 'calories'],
        },
      },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            instruction: { type: 'string' },
            timer_seconds: {
              anyOf: [
                { type: 'number' },
                { type: 'null' },
              ],
            },
          },
          required: ['instruction', 'timer_seconds'],
        },
      },
    },
    required: [
      'title',
      'description',
      'cuisine',
      'difficulty',
      'prep_time',
      'cook_time',
      'servings',
      'calories',
      'protein',
      'carbs',
      'fat',
      'cost_estimate',
      'goals',
      'ingredients',
      'steps',
    ],
  },
}
const RECIPE_SCHEMA = `{
  "title": "string",
  "description": "string",
  "cuisine": "string",
  "difficulty": "Easy | Medium | Hard",
  "prep_time": 0,
  "cook_time": 0,
  "servings": 2,
  "calories": 0,
  "protein": 0,
  "carbs": 0,
  "fat": 0,
  "cost_estimate": 0,
  "goals": ["string"],
  "ingredients": [{ "name": "string", "quantity": "string", "unit": "string", "calories": 0 }],
  "steps": [{ "instruction": "string", "timer_seconds": 0 }]
}`
const extractionCache = new Map()
const EXTRACTION_CACHE_TTL_MS = 30 * 60 * 1000

function getCachedExtraction(key) {
  const cached = extractionCache.get(key)
  if (!cached) return null
  if (Date.now() - cached.timestamp > EXTRACTION_CACHE_TTL_MS) {
    extractionCache.delete(key)
    return null
  }
  return cached.value
}

function setCachedExtraction(key, value) {
  extractionCache.set(key, {
    value,
    timestamp: Date.now(),
  })
}

function normalizeRecipe(recipe, extras = {}) {
  const prepTime = Number(recipe.prep_time) || 0
  const cookTime = Number(recipe.cook_time) || 0

  return {
    title: recipe.title || 'Untitled Recipe',
    description: recipe.description || '',
    cuisine: recipe.cuisine || 'Other',
    difficulty: ['Easy', 'Medium', 'Hard'].includes(recipe.difficulty) ? recipe.difficulty : 'Medium',
    prep_time: prepTime >= 300 && prepTime % 60 === 0 ? Math.round(prepTime / 60) : prepTime,
    cook_time: cookTime >= 300 && cookTime % 60 === 0 ? Math.round(cookTime / 60) : cookTime,
    servings: Number(recipe.servings) || 1,
    calories: Number(recipe.calories) || 0,
    protein: Number(recipe.protein) || 0,
    carbs: Number(recipe.carbs) || 0,
    fat: Number(recipe.fat) || 0,
    cost_estimate: Number(recipe.cost_estimate) || 0,
    goals: Array.isArray(recipe.goals) ? recipe.goals.filter(Boolean) : [],
    ingredients: Array.isArray(recipe.ingredients)
      ? recipe.ingredients
        .filter((ingredient) => ingredient?.name)
        .map((ingredient) => ({
          name: ingredient.name,
          quantity: ingredient.quantity ?? '',
          unit: ingredient.unit ?? '',
          calories: Number(ingredient.calories) || 0,
        }))
      : [],
    steps: Array.isArray(recipe.steps)
      ? recipe.steps
        .filter((step) => step?.instruction)
        .map((step) => ({
          instruction: step.instruction,
          timer_seconds: step.timer_seconds == null || step.timer_seconds === ''
            ? null
            : Number(step.timer_seconds) || 0,
        }))
      : [],
    ...extras,
  }
}

function parseIngredientHint(item) {
  const text = String(item || '').trim()
  const match = text.match(/^([\d./]+)\s+([a-zA-Z-]+)\s+(.*)$/)

  if (match && COMMON_UNITS.has(match[2].toLowerCase())) {
    return {
      quantity: match[1],
      unit: match[2],
      name: match[3],
      calories: 0,
    }
  }

  return {
    quantity: '',
    unit: '',
    name: text,
    calories: 0,
  }
}

function normalizeIngredientName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function dedupeIngredients(ingredients = []) {
  const merged = new Map()

  ingredients.forEach((ingredient) => {
    const key = normalizeIngredientName(ingredient.name)
    if (!key) return

    if (!merged.has(key)) {
      merged.set(key, {
        ...ingredient,
        name: String(ingredient.name || '').trim(),
      })
      return
    }

    const current = merged.get(key)
    merged.set(key, {
      ...current,
      quantity: current.quantity || ingredient.quantity || '',
      unit: current.unit || ingredient.unit || '',
      calories: (Number(current.calories) || 0) + (Number(ingredient.calories) || 0),
    })
  })

  return [...merged.values()]
}

function cleanSteps(steps = []) {
  const seen = new Set()

  return steps
    .map((step) => ({
      instruction: String(step.instruction || '').replace(/\s+/g, ' ').trim(),
      timer_seconds: step.timer_seconds == null || step.timer_seconds === '' ? null : Number(step.timer_seconds) || 0,
    }))
    .filter((step) => step.instruction && looksLikeInstruction(step.instruction.replace(/^\d+\.\s*/, '')))
    .filter((step) => {
      const key = step.instruction.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function looksLikeInstruction(text) {
  const value = String(text || '').trim()

  if (!value) return false
  if (/[.!?]/.test(value)) return true

  return /\b(add|bake|boil|bring|combine|cook|divide|drizzle|heat|mix|pan-sear|place|preheat|roast|season|sear|serve|simmer|spoon|stir|top|whisk)\b/i.test(value)
}

function isRecipeComplete(recipe) {
  return recipe.ingredients.length >= 3 && recipe.steps.length >= 2
}

function applyRecipeFallbacks(recipe, source) {
  const normalized = normalizeRecipe(recipe, {
    source_url: source.url || null,
    image_url: source.imageUrl,
    source_type: source.sourceType,
    source_domain: source.sourceDomain,
    source_confidence: source.sourceConfidence,
    nutrition_source: source.nutritionSource,
  })

  normalized.ingredients = normalized.ingredients.filter((ingredient) => !looksLikeInstruction(ingredient.name))

  if (!normalized.ingredients.length && source.ingredientHints?.length) {
    normalized.ingredients = source.ingredientHints.map(parseIngredientHint).filter((item) => item.name)
  }

  normalized.ingredients = dedupeIngredients(normalized.ingredients.filter((ingredient) => !looksLikeInstruction(ingredient.name)))

  if (normalized.steps.length < 2 && source.instructionHints?.length) {
    normalized.steps = source.instructionHints.map((instruction) => ({
      instruction,
      timer_seconds: null,
    }))
  }

  normalized.steps = cleanSteps(normalized.steps)

  return normalized
}

function toTitleCase(value = '') {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function cleanRecipeTitle(value = '') {
  const cleaned = String(value || '')
    .replace(/\s*[|:-]\s*.*$/, '')
    .replace(/\b(recipe|transcript|video)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned ? toTitleCase(cleaned) : 'Imported Recipe'
}

function inferCuisineFromText(text = '') {
  const normalized = normalizeIngredientName(text)

  if (/\bmexic|burrito|taco|salsa\b/.test(normalized)) return 'Mexican'
  if (/\bital|pasta|parmesan|basil\b/.test(normalized)) return 'Italian'
  if (/\bthai|curry|coconut\b/.test(normalized)) return 'Thai'
  if (/\bindian|masala|tikka|dal\b/.test(normalized)) return 'Indian'
  if (/\bmediterranean|greek|feta|tzatziki\b/.test(normalized)) return 'Mediterranean'
  if (/\bnordic|salmon|dill\b/.test(normalized)) return 'Nordic'
  if (/\bbreakfast|oat|egg|yogurt\b/.test(normalized)) return 'Breakfast'
  return 'Other'
}

function inferProteinChoice(text = '') {
  const normalized = normalizeIngredientName(text)

  if (normalized.includes('turkey')) return 'turkey mince'
  if (normalized.includes('salmon')) return 'salmon fillet'
  if (normalized.includes('shrimp')) return 'shrimp'
  if (normalized.includes('tofu')) return 'firm tofu'
  if (normalized.includes('beef')) return 'lean beef'
  if (normalized.includes('egg')) return 'eggs'
  return normalized.includes('chicken') ? 'chicken breast' : 'chicken thigh'
}

function inferBaseChoice(text = '') {
  const normalized = normalizeIngredientName(text)

  if (normalized.includes('beans')) return 'beans'
  if (normalized.includes('pasta')) return 'pasta'
  if (normalized.includes('potato')) return 'potatoes'
  if (normalized.includes('quinoa')) return 'quinoa'
  if (normalized.includes('oat')) return 'oats'
  if (normalized.includes('noodle')) return 'noodles'
  return normalized.includes('rice') ? 'rice' : 'rice'
}

function inferVegetableChoice(text = '') {
  const normalized = normalizeIngredientName(text)

  if (normalized.includes('broccoli')) return 'broccoli'
  if (normalized.includes('pepper')) return 'bell pepper'
  if (normalized.includes('spinach')) return 'spinach'
  if (normalized.includes('tomato')) return 'tomato'
  if (normalized.includes('mushroom')) return 'mushrooms'
  return 'spinach'
}

function inferSauceChoice(text = '') {
  const normalized = normalizeIngredientName(text)

  if (normalized.includes('chili')) return 'tomato chili sauce'
  if (normalized.includes('soy')) return 'soy garlic glaze'
  if (normalized.includes('lemon')) return 'lemon herb dressing'
  if (normalized.includes('curry')) return 'coconut curry sauce'
  return 'olive oil and garlic'
}

function inferTimerSeconds(instruction = '', fallbackSeconds = null) {
  const value = String(instruction || '')
  const minuteMatch = value.match(/(\d+)\s*(minute|min)/i)
  if (minuteMatch) return Number(minuteMatch[1]) * 60

  const secondMatch = value.match(/(\d+)\s*(second|sec)/i)
  if (secondMatch) return Number(secondMatch[1])

  return fallbackSeconds
}

function goalNutrition(goal = 'maintain') {
  if (goal === 'cut') return { calories: 480, protein: 44, carbs: 34, fat: 16 }
  if (goal === 'bulk') return { calories: 780, protein: 52, carbs: 82, fat: 24 }
  return { calories: 620, protein: 40, carbs: 56, fat: 20 }
}

function buildFallbackRecipeFromSource(source) {
  const sourceText = [source.pageTitle, source.pageText, source.headings].filter(Boolean).join(' ')
  const ingredients = dedupeIngredients(
    (source.ingredientHints || [])
      .slice(0, 10)
      .map(parseIngredientHint)
      .filter((ingredient) => ingredient.name),
  )
  const instructions = cleanSteps(
    (source.instructionHints || []).map((instruction, index) => ({
      instruction,
      timer_seconds: inferTimerSeconds(instruction, index === 0 ? 300 : null),
    })),
  )
  const protein = /\b(chicken|turkey|salmon|shrimp|beef|tofu|egg|yogurt)\b/i.test(sourceText) ? 38 : 24
  const carbs = /\b(rice|pasta|potato|bread|oat|bean|quinoa|noodle)\b/i.test(sourceText) ? 46 : 28
  const fat = /\b(avocado|olive oil|butter|cheese|salmon|nuts)\b/i.test(sourceText) ? 18 : 12
  const fallbackIngredients = ingredients.length ? ingredients : [
    parseIngredientHint('2 chicken breasts'),
    parseIngredientHint('1 cup rice'),
    parseIngredientHint('2 cups spinach'),
    parseIngredientHint('1 bell pepper'),
    parseIngredientHint('2 tbsp olive oil'),
  ]
  const fallbackSteps = instructions.length ? instructions : [
    { instruction: 'Prep the ingredients and season everything before cooking.', timer_seconds: 180 },
    { instruction: 'Cook the main protein until fully done and set it aside.', timer_seconds: 420 },
    { instruction: 'Finish the vegetables and starch, then combine everything together.', timer_seconds: 300 },
    { instruction: 'Serve warm and adjust seasoning to taste.', timer_seconds: null },
  ]

  return {
    title: cleanRecipeTitle(source.pageTitle),
    description: `Imported from ${source.sourceDomain || 'a recipe page'} using the local-dev fallback parser.`,
    cuisine: inferCuisineFromText(sourceText),
    difficulty: fallbackSteps.length >= 4 ? 'Medium' : 'Easy',
    prep_time: Math.max(6, Math.min(20, fallbackIngredients.length * 2)),
    cook_time: Math.max(12, Math.min(30, fallbackSteps.length * 6)),
    servings: 2,
    calories: Math.max(380, fallbackIngredients.length * 90),
    protein,
    carbs,
    fat,
    cost_estimate: Number((Math.max(4, fallbackIngredients.length * 1.4)).toFixed(2)),
    goals: protein >= 30 ? ['high-protein'] : [],
    ingredients: fallbackIngredients,
    steps: fallbackSteps,
  }
}

function buildFallbackGeneratedRecipe({ prompt, goal = 'maintain', maxTime }) {
  const normalizedPrompt = normalizeIngredientName(prompt)
  const nutrition = goalNutrition(goal)
  const proteinChoice = inferProteinChoice(prompt)
  const baseChoice = inferBaseChoice(prompt)
  const vegetableChoice = inferVegetableChoice(prompt)
  const sauceChoice = inferSauceChoice(prompt)
  const requestedTime = Math.max(18, Math.min(Number(maxTime) || 30, 45))
  const looksLikeChili = normalizedPrompt.includes('chili')
  const looksLikeBreakfast = /\bbreakfast|oat|yogurt|egg\b/.test(normalizedPrompt)
  const title = cleanRecipeTitle(
    looksLikeChili
      ? `${toTitleCase(proteinChoice)} Chili`
      : looksLikeBreakfast
        ? `${toTitleCase(proteinChoice)} Breakfast Bowl`
        : `${toTitleCase(proteinChoice)} ${toTitleCase(baseChoice)} Bowl`,
  )

  const ingredients = looksLikeChili
    ? [
      { name: proteinChoice, quantity: goal === 'bulk' ? '300' : '220', unit: 'g', calories: 220 },
      { name: 'beans', quantity: '1', unit: 'can', calories: 180 },
      { name: 'crushed tomatoes', quantity: '1', unit: 'cup', calories: 70 },
      { name: 'bell pepper', quantity: '1', unit: '', calories: 30 },
      { name: 'onion', quantity: '1', unit: '', calories: 45 },
      { name: 'chili spice', quantity: '2', unit: 'tbsp', calories: 15 },
    ]
    : [
      { name: proteinChoice, quantity: goal === 'bulk' ? '300' : '220', unit: 'g', calories: 220 },
      { name: baseChoice, quantity: goal === 'bulk' ? '1.5' : '1', unit: 'cup', calories: 220 },
      { name: vegetableChoice, quantity: '2', unit: 'cups', calories: 40 },
      { name: 'onion', quantity: '0.5', unit: '', calories: 25 },
      { name: 'garlic', quantity: '2', unit: 'cloves', calories: 10 },
      { name: sauceChoice, quantity: '2', unit: 'tbsp', calories: 60 },
    ]

  return {
    title,
    description: `Generated in local dev from the prompt "${prompt.trim()}". Built to support the ${goal} goal with a realistic fallback recipe.`,
    cuisine: inferCuisineFromText(prompt),
    difficulty: looksLikeBreakfast ? 'Easy' : 'Medium',
    prep_time: Math.max(8, Math.round(requestedTime * 0.35)),
    cook_time: Math.max(10, requestedTime - Math.max(8, Math.round(requestedTime * 0.35))),
    servings: goal === 'bulk' ? 3 : 2,
    calories: nutrition.calories,
    protein: nutrition.protein,
    carbs: nutrition.carbs,
    fat: nutrition.fat,
    cost_estimate: goal === 'bulk' ? 8.5 : 6.5,
    goals: ['high-protein', goal],
    ingredients,
    steps: looksLikeChili
      ? [
        { instruction: `Brown the ${proteinChoice} with the onion and chili spice for 6 minutes.`, timer_seconds: 360 },
        { instruction: 'Add the bell pepper, beans, and crushed tomatoes, then simmer for 10 minutes.', timer_seconds: 600 },
        { instruction: 'Taste and adjust seasoning while the chili thickens.', timer_seconds: 120 },
        { instruction: 'Serve warm with your preferred toppings.', timer_seconds: null },
      ]
      : [
        { instruction: `Cook the ${baseChoice} until tender and keep it warm.`, timer_seconds: 600 },
        { instruction: `Season and cook the ${proteinChoice} until fully done.`, timer_seconds: 420 },
        { instruction: `Saute the ${vegetableChoice}, onion, and garlic with the ${sauceChoice}.`, timer_seconds: 240 },
        { instruction: `Assemble the bowl and serve immediately.`, timer_seconds: null },
      ],
    source_url: 'ruokanna://generated',
  }
}

function recipeFitsSlot(recipe, slot) {
  const text = normalizeIngredientName(`${recipe.title} ${recipe.cuisine} ${(recipe.tags || []).join(' ')}`)

  if (slot === 'Breakfast') return /\bbreakfast|oat|yogurt|egg|toast|smoothie\b/.test(text)
  if (slot === 'Snack') return /\bsnack|yogurt|smoothie|bar|fruit|bite\b/.test(text)
  if (slot === 'Lunch') return /\blunch|salad|sandwich|wrap|bowl\b/.test(text)
  if (slot === 'Dinner') return /\bdinner|salmon|chicken|pasta|curry|stir|chili|roast\b/.test(text)
  return false
}

function buildFallbackAutoPlan(recipeCatalog, dayCount, goal) {
  const ranked = [...recipeCatalog].sort((left, right) => {
    if (goal === 'cut') return (right.protein - left.protein) || (left.total_time - right.total_time)
    if (goal === 'bulk') return ((right.calories + right.protein) - (left.calories + left.protein)) || (left.total_time - right.total_time)
    return (left.total_time - right.total_time) || (right.protein - left.protein)
  })

  const plan = {}

  DAYS.slice(0, dayCount).forEach((day, dayIndex) => {
    const usedIds = new Set()
    plan[day] = {}

    SLOTS.forEach((slot, slotIndex) => {
      const slotPool = ranked.filter((recipe) => recipeFitsSlot(recipe, slot) && !usedIds.has(recipe.id))
      const pool = slotPool.length
        ? slotPool
        : ranked.filter((recipe) => !usedIds.has(recipe.id)).length
          ? ranked.filter((recipe) => !usedIds.has(recipe.id))
          : ranked
      const recipe = pool[(dayIndex + slotIndex) % pool.length] || null
      plan[day][slot] = recipe ? String(recipe.id) : null
      if (recipe) usedIds.add(recipe.id)
    })
  })

  return plan
}

async function scrapeRecipePage(url) {
  const [{ data: html }, markdownText] = await Promise.all([
    axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RuokannaBot/1.0; +https://localhost)',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    }),
    readUrlAsMarkdown(url).catch(() => ''),
  ])

  const $ = cheerio.load(html)
  const jsonLdScripts = $('script[type="application/ld+json"]')
    .map((_, element) => $(element).html())
    .get()
    .filter(Boolean)
    .join('\n')

  $('script, style, nav, footer, header, aside, noscript').remove()

  const headings = $('h1, h2, h3')
    .map((_, element) => $(element).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 20)
    .join(' | ')

  const listItems = $('li')
    .map((_, element) => $(element).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter(Boolean)
    .slice(0, 60)

  const ingredientHints = listItems
    .filter((item) => !/step|instruction/i.test(item) && !looksLikeInstruction(item))
    .slice(0, 25)

  const instructionHints = $('ol li')
    .map((_, element) => $(element).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter(Boolean)
    .slice(0, 20)

  const htmlText = $('body')
    .text()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12000)

  const pageText = String(markdownText || htmlText).replace(/\s+/g, ' ').trim().slice(0, 16000)
  const pageTitle = $('title').text().trim() || 'Recipe'
  const imageUrl = $('meta[property="og:image"]').attr('content')
    || $('meta[name="twitter:image"]').attr('content')
    || $('img').first().attr('src')
    || null

  return {
    pageTitle,
    pageText,
    headings,
    ingredientHints,
    instructionHints,
    jsonLdScripts: jsonLdScripts.slice(0, 12000),
    imageUrl,
  }
}

async function askRecipeModel({ prompt, temperature = 0.3 }) {
  return generateStructuredObject({
    systemPrompt: 'You extract and generate recipes for an AI meal-planning app. Return only valid JSON matching the requested schema.',
    userPrompt: prompt,
    jsonSchema: RECIPE_JSON_SCHEMA,
    temperature,
  })
}

async function buildRecipeSource({ url, text, title }) {
  if (text) {
    return {
      pageTitle: title || 'Recipe transcript',
      pageText: String(text).replace(/\s+/g, ' ').trim().slice(0, 16000),
      headings: '',
      ingredientHints: [],
      instructionHints: [],
      jsonLdScripts: '',
      imageUrl: null,
      sourceType: url ? getSourceType(url) : 'transcript',
      sourceDomain: getSourceDomain(url),
      sourceConfidence: 0.78,
      nutritionSource: 'estimated from transcript',
      url: url || null,
    }
  }

  if (!url) {
    throw createHttpError('URL or transcript text required', 400)
  }

  if (isInstagramUrl(url)) {
    throw createHttpError('Instagram recipe extraction is not supported yet. Ruokanna needs subtitles or captions before it can turn that video into a structured recipe.', 422)
  }

  if (isYouTubeUrl(url)) {
    const transcript = await fetchYouTubeTranscript(url)
    return {
      pageTitle: transcript.title,
      pageText: transcript.text,
      headings: '',
      ingredientHints: [],
      instructionHints: [],
      jsonLdScripts: '',
      imageUrl: null,
      sourceType: 'youtube-transcript',
      sourceDomain: getSourceDomain(url),
      sourceConfidence: 0.78,
      nutritionSource: 'estimated from transcript',
      url,
    }
  }

  const scraped = await scrapeRecipePage(url)
  return {
    ...scraped,
    sourceType: 'web-page',
    sourceDomain: getSourceDomain(url),
    sourceConfidence: 0.86,
    nutritionSource: 'estimated from source content',
    url,
  }
}

recipeRouter.post('/extract', async (req, res) => {
  const { url, text } = req.body

  if (!url && !text) {
    return res.status(400).json({ error: 'URL or transcript text required' })
  }

  try {
    const cacheKey = text
      ? `text:${String(req.body.title || '').trim()}:${String(text).trim().slice(0, 1200)}`
      : `url:${String(url).trim()}`
    const cached = getCachedExtraction(cacheKey)

    if (cached) {
      return res.json(cached)
    }

    const source = await buildRecipeSource({
      url: url?.trim(),
      text,
      title: req.body.title,
    })

    const prompt = `You extract recipes into clean JSON for a meal-planning app.

Return ONLY one valid JSON object. No markdown. No code fences. No commentary.

Use exactly this schema:
${RECIPE_SCHEMA}

Rules:
- Infer missing nutrition and cost fields conservatively if they are not explicit.
- Use integers for numeric values.
- ingredients must be an array of objects.
- ingredients must contain food items only, never instructions.
- steps must be an ordered array of objects.
- steps must contain cooking instructions only, never ingredient items.
- timer_seconds should be null when no timer is needed.
- If this is not actually a recipe, return {"error":"No recipe found"}.

Source title: ${source.pageTitle}
Section hints: ${source.headings || 'None'}
Ingredient hints: ${source.ingredientHints?.join(' | ') || 'None'}
Instruction hints: ${source.instructionHints?.join(' | ') || 'None'}
Structured data: ${source.jsonLdScripts || 'None'}
Source text:
${source.pageText}`

    let parsed

    try {
      parsed = await askRecipeModel({ prompt, temperature: 0.2 })
    } catch (error) {
      if (!isDevAIFallbackEnabled()) throw error

      const fallbackResponse = applyRecipeFallbacks(buildFallbackRecipeFromSource(source), source)
      setCachedExtraction(cacheKey, fallbackResponse)
      return res.json(fallbackResponse)
    }

    if (parsed.error) {
      if (isDevAIFallbackEnabled()) {
        const fallbackResponse = applyRecipeFallbacks(buildFallbackRecipeFromSource(source), source)
        setCachedExtraction(cacheKey, fallbackResponse)
        return res.json(fallbackResponse)
      }
      return res.status(422).json({ error: parsed.error })
    }

    const response = applyRecipeFallbacks(parsed, source)
    setCachedExtraction(cacheKey, response)
    return res.json(response)
  } catch (error) {
    return respondAIError(res, error, 'Failed to extract recipe. Try a different URL.')
  }
})

recipeRouter.post('/generate', async (req, res) => {
  const { prompt, goal, maxTime } = req.body

  if (!prompt?.trim()) {
    return res.status(400).json({ error: 'Prompt required' })
  }

  try {
    const fullPrompt = `Create one recipe for this request: ${prompt.trim()}

Goal: ${goal || 'maintain'}
Max total time in minutes: ${maxTime || 'no strict limit'}

Return ONLY one valid JSON object. No markdown. No code fences. No commentary.

Use exactly this schema:
${RECIPE_SCHEMA}

Rules:
- Make the recipe realistic and cookable.
- Keep ingredient quantities practical.
- total time should reflect prep_time + cook_time.
- Match the requested goal where possible.
- Provide at least 5 ingredients unless the dish genuinely needs fewer.
- Provide at least 4 steps unless the dish genuinely needs fewer.
- Do not leave ingredients or steps empty.
- Estimate calories, protein, carbs, fat, and cost_estimate with non-zero integers whenever possible.`

    let parsed
    let normalized

    try {
      parsed = await askRecipeModel({ prompt: fullPrompt, temperature: 0.4 })
      normalized = normalizeRecipe(parsed, {
        source_url: 'ruokanna://generated',
        image_url: null,
        source_type: 'ai-generated',
        source_domain: '',
        source_confidence: 0.74,
        nutrition_source: 'estimated from AI generation',
      })

      if (!isRecipeComplete(normalized)) {
        const completionPrompt = `Fix this incomplete recipe JSON for the original request.

Original request: ${prompt.trim()}
Goal: ${goal || 'maintain'}
Max total time in minutes: ${maxTime || 'no strict limit'}

Return ONLY one valid JSON object in this exact schema:
${RECIPE_SCHEMA}

Requirements:
- Keep the same dish concept.
- Fill in complete ingredients and steps.
- Provide at least 5 ingredients unless the dish genuinely needs fewer.
- Provide at least 4 steps unless the dish genuinely needs fewer.
- Estimate calories, protein, carbs, fat, and cost_estimate with non-zero integers whenever possible.

Incomplete recipe JSON:
${JSON.stringify(parsed)}`

        parsed = await askRecipeModel({ prompt: completionPrompt, temperature: 0.2 })
        normalized = normalizeRecipe(parsed, {
          source_url: 'ruokanna://generated',
          image_url: null,
          source_type: 'ai-generated',
          source_domain: '',
          source_confidence: 0.74,
          nutrition_source: 'estimated from AI generation',
        })
      }
    } catch (error) {
      if (!isDevAIFallbackEnabled()) throw error

      return res.json(normalizeRecipe(buildFallbackGeneratedRecipe({ prompt, goal, maxTime }), {
        source_url: 'ruokanna://generated',
        image_url: null,
        source_type: 'ai-generated',
        source_domain: '',
        source_confidence: 0.74,
        nutrition_source: 'estimated from AI generation',
      }))
    }

    return res.json(normalized)
  } catch (error) {
    return respondAIError(res, error, 'Failed to generate recipe.')
  }
})

recipeRouter.post('/autoplan', async (req, res) => {
  const { goal = 'maintain', days = 7, existingRecipes = [] } = req.body

  if (!Array.isArray(existingRecipes) || !existingRecipes.length) {
    return res.status(400).json({ error: 'existingRecipes[] is required' })
  }

  try {
    const recipeCatalog = existingRecipes
      .slice(0, 60)
      .map((recipe) => ({
        id: recipe.id,
        title: recipe.title,
        cuisine: recipe.cuisine || 'Other',
        protein: Number(recipe.protein) || 0,
        calories: Number(recipe.calories) || 0,
        total_time: (Number(recipe.prep_time) || 0) + (Number(recipe.cook_time) || 0),
        tags: Array.isArray(recipe.tags) ? recipe.tags : [],
      }))

    const dayCount = Math.max(1, Math.min(Number(days) || 7, 7))
    const prompt = `Create a ${dayCount}-day meal plan using ONLY the recipe ids from this catalog.

Goal: ${goal}
Available slots per day: ${SLOTS.join(', ')}
Recipe catalog:
${JSON.stringify(recipeCatalog)}

Return ONLY one valid JSON object in this exact shape:
{
  "Mon": { "Breakfast": "recipe-id-or-null", "Lunch": "recipe-id-or-null", "Dinner": "recipe-id-or-null", "Snack": "recipe-id-or-null" },
  "Tue": { "Breakfast": "recipe-id-or-null", "Lunch": "recipe-id-or-null", "Dinner": "recipe-id-or-null", "Snack": "recipe-id-or-null" }
}

Rules:
- Include exactly ${dayCount} day keys from this ordered list: ${DAYS.slice(0, dayCount).join(', ')}.
- Use only recipe ids that appear in the catalog.
- Prioritize variety across the week.
- Match the requested goal when possible.
- Use null when a slot should be left empty.`

    const allowedIds = new Set(recipeCatalog.map((recipe) => String(recipe.id)))

    try {
      const plan = await generateStructuredObject({
        systemPrompt: 'You are a meal-planning assistant. Return only valid JSON using the requested recipe ids.',
        userPrompt: prompt,
        temperature: 0.5,
        jsonSchema: {
          name: 'weekly_plan',
          schema: {
            type: 'object',
            additionalProperties: true,
          },
        },
      })

      const normalizedPlan = {}
      const fallbackPlan = buildFallbackAutoPlan(recipeCatalog, dayCount, goal)

      DAYS.slice(0, dayCount).forEach((day) => {
        normalizedPlan[day] = {}
        SLOTS.forEach((slot) => {
          const recipeId = plan?.[day]?.[slot]
          const normalizedId = allowedIds.has(String(recipeId)) ? String(recipeId) : null
          normalizedPlan[day][slot] = normalizedId || fallbackPlan?.[day]?.[slot] || null
        })
      })

      const hasAssignedMeal = Object.values(normalizedPlan)
        .some((day) => Object.values(day).some(Boolean))

      if (!hasAssignedMeal && isDevAIFallbackEnabled()) {
        return res.json(buildFallbackAutoPlan(recipeCatalog, dayCount, goal))
      }

      return res.json(normalizedPlan)
    } catch (error) {
      if (!isDevAIFallbackEnabled()) throw error
      return res.json(buildFallbackAutoPlan(recipeCatalog, dayCount, goal))
    }
  } catch (error) {
    return respondAIError(res, error, 'Failed to generate meal plan.')
  }
})
