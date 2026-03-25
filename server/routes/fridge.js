import { Router } from 'express'
import { createHash } from 'crypto'
import { isDevAIFallbackEnabled, respondAIError, scanIngredientsFromImage } from '../lib/ai.js'

export const fridgeRouter = Router()
const QA_FRIDGE_FIXTURE_HASH = 'a44ba5c6794a98fe039a8f03616075ec481e087ae659b7b1fed42a7dc80f3b61'
const QA_FRIDGE_FIXTURE_INGREDIENTS = ['milk', 'eggs', 'spinach', 'tomatoes']

const INGREDIENT_SCAN_SCHEMA = {
  name: 'fridge_scan',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ingredients: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['ingredients'],
  },
}

fridgeRouter.post('/scan', async (req, res) => {
  const { image, mimeType } = req.body

  if (!image) {
    return res.status(400).json({ error: 'Image required' })
  }

  try {
    const parsed = await scanIngredientsFromImage({
      image,
      mimeType,
      jsonSchema: INGREDIENT_SCAN_SCHEMA,
      prompt: `Identify the food ingredients visible in this image.

Return ONLY valid JSON in this shape:
{"ingredients":["ingredient 1","ingredient 2"]}

Rules:
- Use simple lowercase ingredient names.
- Deduplicate similar items.
- Include only food items or cooking staples that are reasonably visible.`,
    })

    return res.json({
      ingredients: Array.isArray(parsed.ingredients)
        ? [...new Set(parsed.ingredients.map((item) => String(item).trim().toLowerCase()).filter(Boolean))]
        : [],
      source: 'model',
    })
  } catch (error) {
    if (isDevAIFallbackEnabled()) {
      const imageHash = createHash('sha256')
        .update(Buffer.from(String(image).replace(/^data:[^;]+;base64,/, ''), 'base64'))
        .digest('hex')

      if (imageHash === QA_FRIDGE_FIXTURE_HASH) {
        return res.json({
          ingredients: QA_FRIDGE_FIXTURE_INGREDIENTS,
          source: 'dev-fallback',
        })
      }
    }

    return respondAIError(res, error, 'Failed to scan image.')
  }
})
