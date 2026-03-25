import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth.jsx'
import AuthPage from './pages/AuthPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import RecipesPage from './pages/RecipesPage.jsx'
import AddRecipePage from './pages/AddRecipePage.jsx'
import RecipeDetailPage from './pages/RecipeDetailPage.jsx'
import CookModePage from './pages/CookModePage.jsx'
import MacrosPage from './pages/MacrosPage.jsx'
import FridgePage from './pages/FridgePage.jsx'
import ChatPage from './pages/ChatPage.jsx'
import DebriefPage from './pages/DebriefPage.jsx'
import Layout from './components/Layout.jsx'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0A0A0A' }}>
      <div style={{ color: '#00FF85', fontSize: 14, fontWeight: 700 }}>Loading...</div>
    </div>
  )
  return user ? children : <Navigate to="/auth" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="recipes" element={<RecipesPage />} />
        <Route path="recipes/add" element={<AddRecipePage />} />
        <Route path="recipes/:id" element={<RecipeDetailPage />} />
        <Route path="cook/:id" element={<CookModePage />} />
        <Route path="macros" element={<MacrosPage />} />
        <Route path="fridge" element={<FridgePage />} />
        <Route path="debrief" element={<DebriefPage />} />
        <Route path="chat" element={<ChatPage />} />
      </Route>
    </Routes>
  )
}
