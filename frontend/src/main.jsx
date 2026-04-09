import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import './index.css'

import { useAuthStore } from './store/auth'
import AppShell from './components/layout/AppShell'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import BinderPage from './pages/BinderPage'
import UserProfilePage from './pages/UserProfilePage'
import TradesPage from './pages/TradesPage'
import DiscoverPage from './pages/DiscoverPage'
import TradeDetailPage from './pages/TradeDetailPage'

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })

function ProtectedRoute({ children }) {
  const token = useAuthStore(s => s.token)
  return token ? children : <Navigate to="/login" replace />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            <Route index element={<Navigate to="/binder" replace />} />
            <Route path="binder" element={<BinderPage />} />
            <Route path="binder/:userId" element={<UserProfilePage />} />
            <Route path="trades" element={<TradesPage />} />
            <Route path="trades/:offerId" element={<TradeDetailPage />} />
            <Route path="discover" element={<DiscoverPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1e2736', color: '#e8edf5', border: '1px solid #2a3a52' },
          success: { iconTheme: { primary: '#00d4c8', secondary: '#0d1117' } },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
)
