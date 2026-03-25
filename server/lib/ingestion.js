import axios from 'axios'
import { isDevAIFallbackEnabled } from './ai.js'

const transcriptCache = new Map()
const CACHE_TTL_MS = 30 * 60 * 1000
const TRANSCRIPT_API_BASE_URL = (process.env.YOUTUBE_TRANSCRIPT_API_URL || 'https://www.youtube-transcript-api.com/api').replace(/\/$/, '')
const DEV_QA_YOUTUBE_VIDEO_ID = 'dQw4w9WgXcQ'

function getCachedValue(key) {
  const cached = transcriptCache.get(key)
  if (!cached) return null
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    transcriptCache.delete(key)
    return null
  }
  return cached.value
}

function setCachedValue(key, value) {
  transcriptCache.set(key, { value, timestamp: Date.now() })
}

export function getDevFallbackTranscript(videoId) {
  if (videoId !== DEV_QA_YOUTUBE_VIDEO_ID) return null

  return {
    videoId,
    title: 'QA YouTube Honey Soy Chicken Rice Bowl',
    text: [
      'Ingredients: 2 chicken breasts, 1 cup jasmine rice, 1 red pepper, 2 cups spinach, 2 tablespoons soy sauce, 1 tablespoon honey, 1 clove garlic, 1 tablespoon olive oil.',
      'Instructions: 1. Cook the rice for 10 minutes until tender.',
      '2. Slice the chicken and sear it with olive oil and garlic for 6 minutes.',
      '3. Add the pepper, spinach, soy sauce, and honey and cook for 2 minutes.',
      '4. Serve the chicken mixture over the rice and finish with any extra pan sauce.',
    ].join(' '),
  }
}

export function createHttpError(message, status = 400, details = null) {
  const error = new Error(message)
  error.status = status
  error.details = details
  return error
}

export function isYouTubeUrl(url) {
  return /(?:youtube\.com|youtu\.be)/i.test(String(url || ''))
}

export function isInstagramUrl(url) {
  return /instagram\.com/i.test(String(url || ''))
}

export function getYouTubeVideoId(url) {
  try {
    const parsed = new URL(url)

    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.replace('/', '').trim()
    }

    if (parsed.searchParams.get('v')) {
      return parsed.searchParams.get('v')
    }

    const parts = parsed.pathname.split('/').filter(Boolean)
    const interestingIndex = parts.findIndex((part) => ['embed', 'shorts', 'live'].includes(part))
    return interestingIndex >= 0 ? parts[interestingIndex + 1] || '' : ''
  } catch {
    return ''
  }
}

export function getSourceType(url = '') {
  if (!url) return 'unknown'
  if (isYouTubeUrl(url)) return 'youtube-transcript'
  if (isInstagramUrl(url)) return 'instagram-video'

  try {
    const parsed = new URL(url)
    return /^https?:$/i.test(parsed.protocol) ? 'web-page' : 'unknown'
  } catch {
    return 'unknown'
  }
}

export function getSourceDomain(url = '') {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function normalizeTranscriptText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseCaptionTracksFromHtml(html) {
  const match = String(html || '').match(/"captionTracks":(\[[\s\S]*?\])/)
  if (!match?.[1]) return []

  try {
    return JSON.parse(match[1])
  } catch {
    return []
  }
}

function pickCaptionTrack(tracks = []) {
  const preferred = tracks.find((track) => /(^|[.-])(en|en-US|en-GB)($|[.-])/i.test(track?.languageCode || ''))
  return preferred || tracks[0] || null
}

async function fetchTranscriptFromCaptionTrack(videoId) {
  const pageResponse = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
    timeout: 15000,
    responseType: 'text',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; RuokannaBot/1.0; +https://localhost)',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })

  const captionTrack = pickCaptionTrack(parseCaptionTracksFromHtml(pageResponse.data))
  if (!captionTrack?.baseUrl) {
    throw createHttpError('No caption track was published for this YouTube video.', 422)
  }

  const transcriptUrl = captionTrack.baseUrl
  const transcriptResponse = await axios.get(transcriptUrl, {
    timeout: 15000,
    responseType: 'text',
  })

  let text = ''

  try {
    const payload = JSON.parse(transcriptResponse.data)
    const events = Array.isArray(payload?.events) ? payload.events : []

    text = normalizeTranscriptText(
      events
        .flatMap((event) => Array.isArray(event?.segs) ? event.segs : [])
        .map((segment) => segment?.utf8 || '')
        .join(' '),
    )
  } catch {
    const xmlMatches = String(transcriptResponse.data || '').match(/<text[^>]*>([\s\S]*?)<\/text>/g) || []
    text = normalizeTranscriptText(
      xmlMatches
        .map((item) => item.replace(/<[^>]+>/g, ' '))
        .join(' '),
    )
  }

  if (!text) {
    throw createHttpError('No usable subtitle text was found in the YouTube caption track.', 422)
  }

  return {
    videoId,
    title: `YouTube recipe transcript (${videoId})`,
    text: text.slice(0, 18000),
  }
}

async function fetchTranscriptFromApi(videoId) {
  const response = await axios.get(`${TRANSCRIPT_API_BASE_URL}/${videoId}`, {
    timeout: 15000,
    responseType: 'json',
    headers: {
      Accept: 'application/json',
    },
  })

  const payload = response.data
  const transcript = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.transcript)
      ? payload.transcript
      : []

  const text = normalizeTranscriptText(
    transcript
      .map((segment) => String(segment?.text || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' '),
  )

  if (!text) {
    throw createHttpError(payload?.error || 'No transcript available for this YouTube video.', 422, payload)
  }

  return {
    videoId,
    title: `YouTube recipe transcript (${videoId})`,
    text: text.slice(0, 18000),
  }
}

export async function fetchYouTubeTranscript(url) {
  const videoId = getYouTubeVideoId(url)

  if (!videoId) {
    throw createHttpError('Could not detect a valid YouTube video ID from that URL.', 422)
  }

  const cached = getCachedValue(videoId)
  if (cached) {
    return cached
  }

  let directCaptionError = null

  try {
    let result

    try {
      result = await fetchTranscriptFromCaptionTrack(videoId)
    } catch (error) {
      directCaptionError = error
      result = await fetchTranscriptFromApi(videoId)
    }

    setCachedValue(videoId, result)
    return result
  } catch (error) {
    if (isDevAIFallbackEnabled()) {
      const fallback = getDevFallbackTranscript(videoId)
      if (fallback) {
        setCachedValue(videoId, fallback)
        return fallback
      }
    }

    const primaryMessage = directCaptionError?.message
      ? `Direct caption extraction failed: ${directCaptionError.message}.`
      : ''
    const secondaryMessage = error?.response?.data?.error
      || error?.response?.data?.message
      || error?.message
      || 'Failed to fetch YouTube transcript.'

    throw createHttpError(
      `No transcript found for this YouTube video. ${primaryMessage} ${secondaryMessage}`.replace(/\s+/g, ' ').trim(),
      422,
      error?.response?.data || error?.message,
    )
  }
}
