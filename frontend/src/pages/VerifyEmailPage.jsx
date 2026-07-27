import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api.js'

export default function VerifyEmailPage() {
  const nav = useNavigate()
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resent, setResent] = useState(false)
  const [devOtp, setDevOtp] = useState(localStorage.getItem('devOtp')||'')
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (!localStorage.getItem('token')) { nav('/login'); return }
    api.get('/shop/me').then(({data}) => {
      if (data.emailVerified) { nav('/select-plan'); return }
      setEmail(data.email)
    }).catch(() => nav('/login'))
  }, [])

  const verify = async () => {
    setError(''); setLoading(true)
    try {
      await api.post('/auth/verify-otp', { otp })
      localStorage.removeItem('devOtp')
      nav('/select-plan')
    } catch(e) { setError(e.response?.data?.error||'Verification failed') }
    finally { setLoading(false) }
  }

  const resend = async () => {
    setError(''); setResent(false)
    try {
      const {data} = await api.post('/auth/resend-otp')
      if (data.devOtp) { setDevOtp(data.devOtp); localStorage.setItem('devOtp', data.devOtp) }
      setResent(true)
    } catch(e) { setError(e.response?.data?.error||'Failed to resend') }
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm fade-up">
        <div className="text-center mb-8">
          <Link to="/" className="font-display font-bold text-2xl">Print<span className="text-accent">Drop</span></Link>
          <p className="text-muted mt-2 text-sm">Verify your email</p>
        </div>
        <div className="bg-surface border border-white/8 rounded-2xl p-6 space-y-4">
          <div className="text-center">
            <div className="text-3xl mb-2">📧</div>
            <p className="text-sm text-paper">Code sent to</p>
            <p className="text-sm text-accent font-mono">{email}</p>
          </div>

          {devOtp && (
            <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-xl p-3 text-center">
              <div className="text-xs text-yellow-400 mb-1">🧪 DEV — OTP (also in backend terminal)</div>
              <div className="font-display font-bold text-2xl text-yellow-300 tracking-widest">{devOtp}</div>
            </div>
          )}

          <input type="text" inputMode="numeric" maxLength={6} placeholder="000000"
            value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,''))}
            className="w-full bg-ink border border-white/10 rounded-xl px-4 py-4 text-paper text-2xl text-center font-mono tracking-[0.5em] placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-colors"/>

          {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
          {resent && <p className="text-green-400 text-sm bg-green-400/10 rounded-lg px-3 py-2">✓ Code resent!</p>}

          <button onClick={verify} disabled={loading||otp.length!==6}
            className="w-full bg-accent text-white font-display font-semibold py-3 rounded-xl hover:bg-orange-600 transition-all disabled:opacity-40">
            {loading?'Verifying...':'Verify →'}
          </button>
          <button onClick={resend} className="w-full text-sm text-muted hover:text-paper transition-colors">Didn't get code? Resend</button>
        </div>
      </div>
    </div>
  )
}
