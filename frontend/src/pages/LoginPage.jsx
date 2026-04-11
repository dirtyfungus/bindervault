import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showBeta, setShowBeta] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      setShowBeta(true)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDismiss = () => {
    setShowBeta(false)
    navigate('/binder')
  }

  return (
    <>
      <div style={page}>
        <div style={card}>
          <div style={logoRow}>
            <div style={logoMark} />
            <span style={logoText}>Binder<span style={{ color: 'var(--teal)' }}>Vault</span></span>
          </div>
          <p style={{ color: 'var(--grey)', fontSize: 13, marginBottom: 28, textAlign: 'center' }}>
            The MTG trade binder platform
          </p>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={label}>Email</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
            </div>
            <div>
              <label style={label}>Password</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 8, width: '100%', padding: '10px' }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--grey)' }}>
            No account?{' '}
            <Link to="/register" style={{ color: 'var(--teal)' }}>Register</Link>
          </p>
        </div>
      </div>

      {/* Beta disclaimer modal */}
      {showBeta && (
        <div style={overlay} onClick={handleDismiss}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={betaBadge}>BETA</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--white)' }}>Welcome to BinderVault</span>
              </div>
              <button style={closeBtn} onClick={handleDismiss}>
                <X size={16} />
              </button>
            </div>
            <div style={modalBody}>
              <p style={para}>
                Thanks for trying BinderVault! This app is currently in <strong style={{ color: 'var(--teal)' }}>early beta</strong> — features are actively being developed and things are subject to change at any time.
              </p>
              <p style={para}>
                You may encounter bugs, missing features, or UI quirks as we continue to build. We appreciate your patience and feedback.
              </p>
              <div style={callout}>
                <span style={{ fontSize: 16 }}>🐛</span>
                <span style={{ fontSize: 13, color: 'var(--white-dim)' }}>
                  Found something broken? Please report it to a developer so we can fix it quickly.
                </span>
              </div>
              <p style={{ ...para, marginBottom: 0, color: 'var(--grey)', fontSize: 12 }}>
                Data may be reset during development. Don't rely on anything here for real trades just yet.
              </p>
            </div>
            <div style={modalFooter}>
              <button className="btn btn-primary" onClick={handleDismiss} style={{ width: '100%' }}>
                Got it, let's go →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const page = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--navy)', padding: 20,
}
const card = {
  background: 'var(--panel)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)', padding: '36px 32px', width: '100%', maxWidth: 380,
}
const logoRow = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }
const logoMark = {
  width: 28, height: 28, background: 'var(--teal)',
  clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
}
const logoText = { fontSize: 20, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--white)' }
const label = { display: 'block', fontSize: 12, color: 'var(--grey)', marginBottom: 6, fontWeight: 500 }

const overlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(2px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 9999, padding: 20,
}
const modal = {
  background: 'var(--card)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', width: '100%', maxWidth: 420,
  overflow: 'hidden',
}
const modalHeader = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '16px 20px', borderBottom: '1px solid var(--border)',
}
const betaBadge = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
  padding: '2px 7px', borderRadius: 4,
  background: '#00d4c820', border: '1px solid #00d4c840',
  color: 'var(--teal)',
}
const closeBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--grey)', display: 'flex', alignItems: 'center',
  padding: 4, borderRadius: 4,
}
const modalBody = {
  padding: '20px 20px 16px',
  display: 'flex', flexDirection: 'column', gap: 12,
}
const para = {
  fontSize: 13, color: 'var(--white-dim)', lineHeight: 1.6, margin: 0,
}
const callout = {
  display: 'flex', alignItems: 'flex-start', gap: 10,
  padding: '10px 14px',
  background: 'var(--navy)', borderRadius: 8,
  border: '1px solid var(--border)',
}
const modalFooter = {
  padding: '12px 20px 20px',
}