import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      navigate('/binder')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
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
