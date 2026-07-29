import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api.js'

export default function ResetPasswordPage() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!token) { setError('Reset link is missing a token. Request a new one.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError('Passwords don\'t match'); return }
    setError(''); setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, newPassword: password })
      setDone(true)
      setTimeout(() => nav('/login'), 2000)
    } catch (e) {
      setError(e.response?.data?.error || 'Reset failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm fade-up">
        <div className="text-center mb-8">
          <Link to="/" className="font-display font-bold text-2xl">Scan<span className="text-accent">NPrint</span></Link>
          <p className="text-muted mt-2 text-sm">Set a new password</p>
        </div>
        <div className="bg-surface border border-white/8 rounded-2xl p-6 space-y-4">
          {done ? (
            <div className="text-center space-y-2">
              <div className="text-4xl">✅</div>
              <p className="text-sm text-paper">Password updated. Redirecting to login...</p>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs text-muted block mb-1.5">New password</label>
                <input type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)}
                  className="w-full bg-ink border border-white/10 rounded-xl px-4 py-3 text-paper text-sm placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-colors"/>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1.5">Confirm new password</label>
                <input type="password" placeholder="••••••••" value={confirm} onChange={e=>setConfirm(e.target.value)}
                  className="w-full bg-ink border border-white/10 rounded-xl px-4 py-3 text-paper text-sm placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-colors"/>
              </div>
              {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
              <button onClick={submit} disabled={loading}
                className="w-full bg-accent text-white font-display font-semibold py-3 rounded-xl hover:bg-orange-600 transition-all disabled:opacity-50">
                {loading?'Updating...':'Update password →'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
