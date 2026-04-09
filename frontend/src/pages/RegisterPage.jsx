import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const [form, setForm] = useState({ username: '', email: '', password: '', display_name: '', location: '' })
  const [loading, setLoading] = useState(false)
  const { register } = useAuthStore()
  const navigate = useNavigate()

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters')
    setLoading(true)
    try {
      await register(form)
      navigate('/binder')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed')
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
        <p style={{ color: 'var(--grey)', fontSize: 13, marginBottom: 24, textAlign: 'center' }}>
          Create your trade binder account
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={label}>Username *</label>
              <input className="input" value={form.username} onChange={set('username')} required minLength={3} maxLength={32} placeholder="tradeboss" />
            </div>
            <div>
              <label style={label}>Display name</label>
              <input className="input" value={form.display_name} onChange={set('display_name')} placeholder="Trade Boss" />
            </div>
          </div>
          <div>
            <label style={label}>Email *</label>
            <input className="input" type="email" value={form.email} onChange={set('email')} required placeholder="you@example.com" />
          </div>
          <div>
            <label style={label}>Password *</label>
            <input className="input" type="password" value={form.password} onChange={set('password')} required minLength={8} placeholder="8+ characters" />
          </div>
          <div>
            <label style={label}>Location (optional)</label>
            <input className="input" value={form.location} onChange={set('location')} placeholder="Montreal, QC" />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 8, width: '100%', padding: '10px' }}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--grey)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--teal)' }}>Sign in</Link>
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
  borderRadius: 'var(--radius-lg)', padding: '36px 32px', width: '100%', maxWidth: 440,
}
const logoRow = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }
const logoMark = {
  width: 28, height: 28, background: 'var(--teal)',
  clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
}
const logoText = { fontSize: 20, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--white)' }
const label = { display: 'block', fontSize: 12, color: 'var(--grey)', marginBottom: 6, fontWeight: 500 }
