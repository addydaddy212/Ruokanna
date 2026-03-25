import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

function AuthSkeleton() {
  return (
    <div data-qa="auth-page" style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 34, animation: 'misePulse 1.4s ease-in-out infinite' }}>
          <div style={{ width: 160, height: 30, borderRadius: 999, background: '#1A1A1A', margin: '0 auto 12px' }} />
          <div style={{ width: 220, height: 12, borderRadius: 999, background: '#1A1A1A', margin: '0 auto' }} />
        </div>
        <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 22, padding: 28, animation: 'misePulse 1.4s ease-in-out infinite' }}>
          <div style={{ height: 42, borderRadius: 12, background: '#111', marginBottom: 16 }} />
          <div style={{ height: 46, borderRadius: 12, background: '#111', marginBottom: 12 }} />
          <div style={{ height: 46, borderRadius: 12, background: '#111', marginBottom: 16 }} />
          <div style={{ height: 48, borderRadius: 12, background: '#111', marginBottom: 16 }} />
          <div style={{ height: 1, background: '#2A2A2A', marginBottom: 16 }} />
          <div style={{ height: 48, borderRadius: 12, background: '#111' }} />
        </div>
      </div>
    </div>
  )
}

export default function AuthPage() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp, signInWithGoogle, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/')
  }, [user, navigate])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const result = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password)

    setLoading(false)

    if (result.error) {
      setError(result.error.message)
      return
    }

    if (mode === 'signup') {
      setError('Check your email to confirm your account.')
      return
    }

    navigate('/')
  }

  const input = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 12,
    border: '1px solid #2A2A2A',
    background: '#111',
    color: '#fff',
    fontSize: 15,
    outline: 'none',
  }

  if (authLoading) return <AuthSkeleton />

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 8 }}>
            ruokanna<span style={{ color: '#00FF85' }}>.</span>
          </div>
          <div style={{ color: '#9CA3AF', fontSize: 15 }}>Structured meal intelligence for real weekly cooking.</div>
        </div>

        <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 22, padding: 32 }}>
          <div style={{ display: 'flex', marginBottom: 24, background: '#111', borderRadius: 12, padding: 4 }}>
            {['signin', 'signup'].map((item) => (
              <button data-qa={`auth-tab-${item}`} key={item} onClick={() => setMode(item)} style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 10,
                border: 'none',
                background: mode === item ? '#1A1A1A' : 'transparent',
                color: mode === item ? '#fff' : '#6B7280',
                fontWeight: 700,
                cursor: 'pointer',
              }}>
                {item === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input data-qa="auth-email" style={input} type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <input data-qa="auth-password" style={input} type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} />
            {error && <div data-qa={error.includes('Check your email') ? 'auth-confirmation-message' : 'auth-error'} style={{ color: error.includes('Check your email') ? '#00FF85' : '#FCA5A5', fontSize: 13, textAlign: 'center' }}>{error}</div>}
            <button data-qa="auth-submit" type="submit" disabled={loading} style={{
              padding: '14px',
              borderRadius: 12,
              border: 'none',
              background: '#00FF85',
              color: '#000',
              fontSize: 15,
              fontWeight: 800,
              cursor: 'pointer',
              opacity: loading ? 0.7 : 1,
            }}>
              {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div style={{ margin: '20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: '#2A2A2A' }} />
            <span style={{ color: '#6B7280', fontSize: 13 }}>or</span>
            <div style={{ flex: 1, height: 1, background: '#2A2A2A' }} />
          </div>

          <button data-qa="auth-google" onClick={signInWithGoogle} style={{
            width: '100%',
            padding: '12px',
            borderRadius: 12,
            border: '1px solid #2A2A2A',
            background: 'transparent',
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  )
}
