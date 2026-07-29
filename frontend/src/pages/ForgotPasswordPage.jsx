import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api.js'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [devLink, setDevLink] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!email) { setError('Enter your email'); return }
    setError(''); setLoading(true)
    try {
      const { data } = await api.post('/auth/forgot-password', { email })
      setSent(true)
      if (data.devResetLink) setDevLink(data.devResetLink)
    } catch (e) {
      setError(e.response?.data?.error || 'Something went wrong')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm fade-up">
        <div className="text-center mb-8">
  <Link to="/" className="font-display font-bold text-2xl">
    Scan<span className="text-accent">NPrint</span>
  </Link>
  <p className="text-muted mt-2 text-sm">
    Reset your password
  </p>
</div>
        <div className="bg-surface border border-white/8 rounded-2xl p-6 space-y-4">
          {sent ? (
            <div className="text-center space-y-3">
              <div className="text-4xl">📬</div>
              <p className="text-sm text-paper">If that email is registered, a reset link is on its way. It expires in 30 minutes.</p>
              {devLink && (
                <a href={devLink} className="text-xs text-accent hover:underline break-all block">[DEV] {devLink}</a>
              )}
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs text-muted block mb-1.5">Email</label>
                <input type="email" placeholder="raj@gmail.com" value={email} onChange={e=>setEmail(e.target.value)}
                  className="w-full bg-ink border border-white/10 rounded-xl px-4 py-3 text-paper text-sm placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-colors"/>
              </div>
              {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
              <button onClick={submit} disabled={loading}
                className="w-full bg-accent text-white font-display font-semibold py-3 rounded-xl hover:bg-orange-600 transition-all disabled:opacity-50">
                {loading?'Sending...':'Send reset link →'}
              </button>
            </>
          )}
        </div>
        <p className="text-center text-sm text-muted mt-4"><Link to="/login" className="text-accent hover:underline">Back to login</Link></p>
      </div>
    </div>
  )
}
