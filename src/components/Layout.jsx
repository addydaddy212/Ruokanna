import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import {
  LayoutGrid, BookOpen, BarChart2, Package, CheckSquare, Sparkles, LogOut,
} from 'lucide-react'

const NAV = [
  { to: '/', label: 'Dashboard', Icon: LayoutGrid },
  { to: '/recipes', label: 'Recipes', Icon: BookOpen },
  { to: '/macros', label: 'Macros', Icon: BarChart2 },
  { to: '/fridge', label: 'Fridge', Icon: Package },
  { to: '/debrief', label: 'Debrief', Icon: CheckSquare },
  { to: '/chat', label: 'Assistant', Icon: Sparkles },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  )

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  async function handleSignOut() {
    await signOut()
    navigate('/auth')
  }

  const initial = (user?.email?.[0] || 'U').toUpperCase()

  /* ── Mobile bottom-bar nav ── */
  if (isMobile) {
    return (
      <div data-qa="layout-mobile-shell" style={{ minHeight: '100vh', background: '#0A0A0F', color: '#F0F0F8' }}>
        <header style={{
          position: 'sticky', top: 0, zIndex: 20,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 18px',
          borderBottom: '1px solid #2A2A38',
          background: 'rgba(10,10,15,0.95)',
          backdropFilter: 'blur(18px)',
        }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>
            R<span style={{ color: '#00FF85' }}>.</span>
          </div>
          <button data-qa="signout-button" onClick={handleSignOut} style={{
            padding: '8px 12px', borderRadius: 10,
            border: '1px solid #2A2A38', background: 'transparent',
            color: '#8888A8', cursor: 'pointer', fontSize: 13,
          }}>Sign out</button>
        </header>

        <main style={{ paddingBottom: 80 }}>
          <Outlet />
        </main>

        <aside data-qa="layout-mobile-nav" style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30,
          padding: '10px 16px 16px',
          background: 'rgba(26, 26, 26, 0.8)',
          backdropFilter: 'blur(16px)',
          borderTop: '1px solid #2A2A2A',
          display: 'flex', justifyContent: 'space-around',
        }}>
          {NAV.map(({ to, label, Icon }) => (
            <NavLink data-qa={`mobile-nav-${label.toLowerCase()}`} key={to} to={to} end={to === '/'} title={label} style={({ isActive }) => ({
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '8px 10px', borderRadius: 12,
              background: isActive ? 'rgba(0,255,133,0.1)' : 'transparent',
              color: isActive ? '#00FF85' : '#55556A',
              textDecoration: 'none',
            })}>
              <Icon size={20} />
            </NavLink>
          ))}
        </aside>
      </div>
    )
  }

  /* ── Desktop icon-rail sidebar ── */
  return (
    <div data-qa="layout-desktop-shell" style={{ display: 'flex', minHeight: '100vh', background: '#0A0A0F', color: '#F0F0F8' }}>
      {/* Sidebar rail — 64px */}
      <aside className="sidebar-rail" style={{
        width: 64,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px 0',
        position: 'sticky',
        top: 0,
        height: '100vh',
        flexShrink: 0,
        background: 'rgba(26, 26, 26, 0.6)',
        backdropFilter: 'blur(16px)',
        borderRight: '1px solid #2A2A2A',
      }}>
        {/* Logo mark */}
        <div style={{
          width: 36, height: 36,
          borderRadius: 10,
          background: 'rgba(0,255,133,0.12)',
          border: '1px solid rgba(0,255,133,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 800, color: '#00FF85',
          marginBottom: 28, flexShrink: 0,
        }}>R.</div>

        {/* Nav icons */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              data-qa={`desktop-nav-${label.toLowerCase()}`}
              key={to}
              to={to}
              end={to === '/'}
              title={label}
              className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}
            >
              <Icon size={20} />
            </NavLink>
          ))}
        </nav>

        {/* Bottom: avatar + sign out */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          {/* Avatar */}
          <div title={user?.email} style={{
            width: 34, height: 34, borderRadius: '50%',
            background: '#1A1A24', border: '1px solid #2A2A38',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800, color: '#8888A8',
            cursor: 'default',
          }}>
            {initial}
          </div>

          {/* Sign out */}
          <button
            data-qa="signout-button"
            onClick={handleSignOut}
            title="Sign out"
            style={{
              width: 34, height: 34, borderRadius: 10,
              border: '1px solid #2A2A38', background: 'transparent',
              color: '#55556A', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#F87171'; e.currentTarget.style.borderColor = '#F87171' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = ''; e.currentTarget.style.borderColor = '' }}
          >
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  )
}
