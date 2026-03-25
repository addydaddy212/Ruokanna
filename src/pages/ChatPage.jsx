import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useRecipes } from '../hooks/useRecipes.js'
import { safeReadJsonResponse } from '../utils/safeReadJsonResponse.js'

const STORAGE_KEY = 'ruokanna-chat-history'
const DEFAULT_MESSAGES = [
  { role: 'assistant', content: "I'm your Ruokanna assistant. Ask for dinner ideas, substitutions, macro explanations, or a recommendation based on your fridge, goals, and health filters." },
]
const SUGGESTIONS = [
  'What can I cook with chicken and rice?',
  'Give me a high protein breakfast idea',
  'How do I substitute butter in baking?',
]

function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
    }

    return <span key={`${part}-${index}`}>{part}</span>
  })
}

function renderMarkdownMessage(text) {
  const lines = String(text || '').split('\n')

  return lines.map((line, index) => {
    const trimmed = line.trim()

    if (!trimmed) {
      return <div key={`space-${index}`} style={{ height: 8 }} />
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      return (
        <div key={`bullet-${index}`} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <span style={{ color: '#00FF85' }}>•</span>
          <span>{renderInline(trimmed.slice(2))}</span>
        </div>
      )
    }

    return (
      <div key={`line-${index}`} style={{ marginBottom: 4 }}>
        {renderInline(trimmed)}
      </div>
    )
  })
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px' }}>
      {[0, 1, 2].map((index) => (
        <span key={index} style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: '#00FF85',
          animation: `miseDots 1.2s ${index * 0.16}s infinite`,
        }} />
      ))}
    </div>
  )
}

export default function ChatPage() {
  const { fetchUserProfile, fetchFridge, fetchRecipes } = useRecipes()
  const location = useLocation()
  const chatContext = location.state || {}
  
  const [messages, setMessages] = useState(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : DEFAULT_MESSAGES
    } catch {
      return DEFAULT_MESSAGES
    }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState({})
  const bottomRef = useRef(null)

  useEffect(() => {
    Promise.all([fetchUserProfile(), fetchFridge(), fetchRecipes()]).then(([profile, fridge, recipes]) => {
      setContext({
        goal: profile?.goal,
        dietary_preferences: profile?.dietary_preferences || [],
        allergies: profile?.allergies || [],
        health_conditions: profile?.health_conditions || [],
        time_budget_minutes: profile?.time_budget_minutes || 30,
        fridge: (fridge || []).map((item) => item.ingredient_name),
        recipes: (recipes || []).slice(0, 20),
        activeRecipeContext: chatContext.contextRecipeId || null,
        activeStepContent: chatContext.currentStep || null,
      })
    })
  }, [])

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    if (!input.trim() || loading) return

    const userMessage = { role: 'user', content: input.trim() }
    const nextMessages = [...messages, userMessage]

    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, context }),
      })

      const data = await safeReadJsonResponse(response, 'Chat returned an invalid response.')

      setMessages((current) => [...current, {
        role: 'assistant',
        content: response.ok ? (data.message || 'Sorry, something went wrong.') : (data.error || 'Chat failed.'),
      }])
    } catch (chatError) {
      setMessages((current) => [...current, {
        role: 'assistant',
        content: chatError.message || 'Connection error. Please try again.',
      }])
    }

    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', maxWidth: 760, margin: '0 auto', padding: '28px 28px 0' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 6px' }}>AI Assistant</h1>
      <p style={{ color: '#9CA3AF', fontSize: 14, margin: '0 0 20px' }}>Ask for recipe ideas, substitutions, macro explanations, or a plan based on what you already have and what your profile needs.</p>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 20 }}>
        {messages.map((message, index) => (
          <div key={index} style={{ display: 'flex', justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
            <div style={{
              maxWidth: '84%',
              padding: '12px 16px',
              borderRadius: 18,
              background: message.role === 'user' ? '#00FF85' : '#1A1A1A',
              color: message.role === 'user' ? '#000' : '#E5E7EB',
              fontSize: 14,
              lineHeight: 1.6,
              border: message.role === 'user' ? 'none' : '1px solid #2A2A2A',
              borderBottomRightRadius: message.role === 'user' ? 6 : 18,
              borderBottomLeftRadius: message.role === 'assistant' ? 6 : 18,
            }}>
              {message.role === 'assistant' ? renderMarkdownMessage(message.content) : message.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
            <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 18, borderBottomLeftRadius: 6 }}>
              <TypingIndicator />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {SUGGESTIONS.map((suggestion) => (
            <button key={suggestion} onClick={() => setInput(suggestion)} style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid #2A2A2A', background: 'transparent', color: '#fff', cursor: 'pointer' }}>
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, paddingBottom: 24, borderTop: '1px solid #1A1A1A', paddingTop: 16 }}>
        <input
          style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: '1px solid #2A2A2A', background: '#111', color: '#fff', fontSize: 14, outline: 'none' }}
          placeholder="Ask anything..."
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && send()}
        />
        <button onClick={send} disabled={loading || !input.trim()} style={{ padding: '12px 20px', borderRadius: 12, border: 'none', background: input.trim() ? '#00FF85' : '#1A1A1A', color: input.trim() ? '#000' : '#6B7280', fontWeight: 800, cursor: input.trim() ? 'pointer' : 'default' }}>
          Send
        </button>
      </div>
    </div>
  )
}
