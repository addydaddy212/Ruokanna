import axios from 'axios'
import OpenAI from 'openai'

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
const GEMINI_URL = process.env.GEMINI_API_KEY
  ? `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`
  : null
const GROQ_BASE_URL = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1'
const GROQ_TEXT_MODEL = process.env.GROQ_TEXT_MODEL || 'llama-3.3-70b-versatile'
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct'
const JINA_READER_URL = (process.env.JINA_READER_URL || 'https://r.jina.ai').replace(/\/$/, '')
const DEFAULT_PROVIDER_ORDER = (process.env.AI_PROVIDER_ORDER || 'groq,gemini')
  .split(',')
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean)

const groqClient = process.env.GROQ_API_KEY
  ? new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: GROQ_BASE_URL,
  })
  : null

export class AIProviderError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'AIProviderError'
    this.provider = options.provider || 'unknown'
    this.status = options.status || 500
    this.retryable = Boolean(options.retryable)
    this.details = options.details || null
  }
}

function isRetryableStatus(status) {
  return [408, 409, 425, 429, 500, 502, 503, 504].includes(Number(status))
}

function parseBooleanEnv(value) {
  if (value == null || value === '') return null

  const normalized = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return null
}

function toProviderError(provider, error, fallbackMessage) {
  const status = error?.status || error?.response?.status || 500
  const details = error?.response?.data || error?.message || fallbackMessage
  const apiMessage = error?.response?.data?.error?.message
    || error?.error?.message
    || error?.message
    || fallbackMessage

  return new AIProviderError(apiMessage, {
    provider,
    status,
    retryable: isRetryableStatus(status),
    details,
  })
}

function extractJSON(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/)
  if (!match) {
    throw new Error('No JSON object found in model response')
  }

  return JSON.parse(match[0])
}

function extractGeminiText(response) {
  const parts = response.data?.candidates?.[0]?.content?.parts || []
  return parts.map((part) => part.text || '').join('').trim()
}

function isPrivateOrLocalUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl)
    const host = parsed.hostname.toLowerCase()

    if (host === 'localhost' || host === '::1' || host.endsWith('.local')) return true
    if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true

    const match172 = host.match(/^172\.(\d+)\./)
    if (match172) {
      const secondOctet = Number(match172[1])
      if (secondOctet >= 16 && secondOctet <= 31) return true
    }

    return false
  } catch {
    return false
  }
}

function buildGroqInputMessages(messages = []) {
  return messages.map((message) => ({
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: String(message.content || ''),
  }))
}

async function groqStructuredObject({ systemPrompt, userPrompt, jsonSchema, temperature = 0.2 }) {
  if (!groqClient) {
    throw new AIProviderError('Groq is not configured.', { provider: 'groq', status: 500 })
  }

  try {
    const systemContent = `${systemPrompt || ''}\n\nReturn only one valid JSON object. No markdown. No commentary.`.trim()
    const userContent = jsonSchema
      ? `${userPrompt}\n\nJSON schema to follow:\n${JSON.stringify(jsonSchema.schema)}`
      : userPrompt

    const response = await groqClient.chat.completions.create({
      model: GROQ_TEXT_MODEL,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: userContent },
      ],
      temperature,
    })

    return extractJSON(response.choices[0].message.content || '')
  } catch (error) {
    throw toProviderError('groq', error, 'Groq request failed.')
  }
}

async function geminiStructuredObject({ systemPrompt, userPrompt, temperature = 0.2 }) {
  if (!GEMINI_URL) {
    throw new AIProviderError('Gemini is not configured.', { provider: 'gemini', status: 500 })
  }

  try {
    const response = await axios.post(GEMINI_URL, {
      system_instruction: systemPrompt
        ? { parts: [{ text: systemPrompt }] }
        : undefined,
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: 2500,
        responseMimeType: 'application/json',
      },
    })

    return extractJSON(extractGeminiText(response))
  } catch (error) {
    throw toProviderError('gemini', error, 'Gemini request failed.')
  }
}

async function groqTextResponse({ systemPrompt, messages, temperature = 0.6 }) {
  if (!groqClient) {
    throw new AIProviderError('Groq is not configured.', { provider: 'groq', status: 500 })
  }

  try {
    const chatMessages = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...buildGroqInputMessages(messages),
    ]

    const response = await groqClient.chat.completions.create({
      model: GROQ_TEXT_MODEL,
      messages: chatMessages,
      temperature,
    })

    const text = response.choices[0].message.content?.trim()
    if (!text) throw new Error('Groq returned an empty response')
    return text
  } catch (error) {
    throw toProviderError('groq', error, 'Groq chat failed.')
  }
}

async function geminiTextResponse({ systemPrompt, messages, temperature = 0.6 }) {
  if (!GEMINI_URL) {
    throw new AIProviderError('Gemini is not configured.', { provider: 'gemini', status: 500 })
  }

  try {
    const response = await axios.post(GEMINI_URL, {
      system_instruction: systemPrompt
        ? { parts: [{ text: systemPrompt }] }
        : undefined,
      contents: messages.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(message.content || '') }],
      })),
      generationConfig: {
        temperature,
        maxOutputTokens: 900,
      },
    })

    const text = extractGeminiText(response)
    if (!text) throw new Error('Gemini returned an empty response')
    return text
  } catch (error) {
    throw toProviderError('gemini', error, 'Gemini chat failed.')
  }
}

async function groqVisionObject({ prompt, dataUrl, jsonSchema }) {
  if (!groqClient) {
    throw new AIProviderError('Groq is not configured.', { provider: 'groq', status: 500 })
  }

  try {
    const response = await groqClient.chat.completions.create({
      model: GROQ_VISION_MODEL,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `${prompt}\n\nReturn only one valid JSON object. No markdown. No commentary.${jsonSchema ? `\nJSON schema to follow:\n${JSON.stringify(jsonSchema.schema)}` : ''}`,
          },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      }],
    })

    return extractJSON(response.choices[0].message.content || '')
  } catch (error) {
    throw toProviderError('groq', error, 'Groq vision request failed.')
  }
}

async function geminiVisionObject({ prompt, base64, mimeType }) {
  if (!GEMINI_URL) {
    throw new AIProviderError('Gemini is not configured.', { provider: 'gemini', status: 500 })
  }

  try {
    const response = await axios.post(GEMINI_URL, {
      contents: [{
        role: 'user',
        parts: [
          {
            inline_data: {
              mime_type: mimeType || 'image/jpeg',
              data: base64,
            },
          },
          { text: prompt },
        ],
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 600,
        responseMimeType: 'application/json',
      },
    })

    return extractJSON(extractGeminiText(response))
  } catch (error) {
    throw toProviderError('gemini', error, 'Gemini vision request failed.')
  }
}

function noProviderConfiguredError(kind = 'AI') {
  return new AIProviderError(
    `No configured ${kind.toLowerCase()} providers are available. Add GROQ_API_KEY and/or GEMINI_API_KEY to .env.`,
    { provider: 'config', status: 500 },
  )
}

export function isDevAIFallbackEnabled() {
  const explicit = parseBooleanEnv(process.env.ENABLE_DEV_AI_FALLBACK)
  if (explicit != null) return explicit
  return process.env.NODE_ENV !== 'production'
}

export async function generateStructuredObject({
  systemPrompt,
  userPrompt,
  jsonSchema,
  providers = DEFAULT_PROVIDER_ORDER,
  temperature,
}) {
  const errors = []

  for (const provider of providers) {
    try {
      if (provider === 'groq') {
        return await groqStructuredObject({ systemPrompt, userPrompt, jsonSchema, temperature })
      }

      if (provider === 'gemini') {
        return await geminiStructuredObject({ systemPrompt, userPrompt, temperature })
      }
    } catch (error) {
      errors.push(error)
      if (!error.retryable && error.status < 500) break
    }
  }

  if (errors.length && errors.every((error) => /not configured/i.test(error.message))) {
    throw noProviderConfiguredError('AI')
  }

  throw errors[errors.length - 1] || noProviderConfiguredError('AI')
}

export async function generateAssistantReply({
  systemPrompt,
  messages,
  providers = DEFAULT_PROVIDER_ORDER,
  temperature,
}) {
  const errors = []

  for (const provider of providers) {
    try {
      if (provider === 'groq') {
        return await groqTextResponse({ systemPrompt, messages, temperature })
      }

      if (provider === 'gemini') {
        return await geminiTextResponse({ systemPrompt, messages, temperature })
      }
    } catch (error) {
      errors.push(error)
      if (!error.retryable && error.status < 500) break
    }
  }

  if (errors.length && errors.every((error) => /not configured/i.test(error.message))) {
    throw noProviderConfiguredError('AI')
  }

  throw errors[errors.length - 1] || noProviderConfiguredError('AI')
}

export async function scanIngredientsFromImage({
  image,
  mimeType = 'image/jpeg',
  providers = DEFAULT_PROVIDER_ORDER,
  prompt,
  jsonSchema,
}) {
  const base64 = String(image || '').replace(/^data:[^;]+;base64,/, '')
  const dataUrl = `data:${mimeType};base64,${base64}`
  const errors = []

  for (const provider of providers) {
    try {
      if (provider === 'groq') {
        return await groqVisionObject({ prompt, dataUrl, jsonSchema })
      }

      if (provider === 'gemini') {
        return await geminiVisionObject({ prompt, base64, mimeType })
      }
    } catch (error) {
      errors.push(error)
      if (!error.retryable && error.status < 500) break
    }
  }

  if (errors.length && errors.every((error) => /not configured/i.test(error.message))) {
    throw noProviderConfiguredError('vision')
  }

  throw errors[errors.length - 1] || noProviderConfiguredError('vision')
}

export async function readUrlAsMarkdown(url) {
  if (isPrivateOrLocalUrl(url)) {
    return ''
  }

  const headers = {
    'User-Agent': 'RuokannaBot/1.0 (+https://localhost)',
    'Accept': 'text/plain, text/markdown;q=0.9, */*;q=0.8',
  }

  if (process.env.JINA_API_KEY) {
    headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`
  }

  try {
    const response = await axios.get(`${JINA_READER_URL}/${url}`, {
      headers,
      timeout: 20000,
      responseType: 'text',
    })

    return String(response.data || '').trim()
  } catch (error) {
    throw toProviderError('jina', error, 'Jina Reader failed.')
  }
}

export function respondAIError(res, error, fallbackMessage) {
  const status = error instanceof AIProviderError ? error.status : error?.status || error?.response?.status || 500
  const message = error instanceof AIProviderError
    ? error.message
    : error?.message || error?.response?.data?.error?.message || fallbackMessage

  console.error(fallbackMessage, error?.details || error?.response?.data || error?.message || error)

  if (status === 429) {
    return res.status(429).json({ error: message || `${fallbackMessage} Please try again later.` })
  }

  return res.status(status >= 400 && status < 600 ? status : 500).json({
    error: message || fallbackMessage,
  })
}
