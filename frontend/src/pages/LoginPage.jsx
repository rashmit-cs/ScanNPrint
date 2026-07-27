import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api.js'

export default function LoginPage() {
  const nav = useNavigate()
  const [form, setForm] = useState({ email:'', password:'' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setError(''); setLoading(true)
    try {
      const { data } = await api.post('/auth/login', form)
      localStorage.setItem('token', data.token)
      const { data: shop } = await api.get('/shop/me')
      if (!shop.emailVerified) return nav('/verify-email')
      if (shop.subscriptionStatus==='NONE') return nav('/select-plan')
      if (shop.subscriptionStatus==='PENDING_PAYMENT') return nav('/pending-approval')
      if (!shop.whatsappJoined) return nav('/join-whatsapp')
      if (shop.effectiveStatus==='EXPIRED') return nav('/subscription-expired')
      nav('/dashboard')
    } catch(e) { setError(e.response?.data?.error||'Login failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm fade-up">
        <div className="text-center mb-8">
          <Link to="/" className="font-display font-bold text-2xl">Print<span className="text-accent">Drop</span></Link>
          <p className="text-muted mt-2 text-sm">Welcome back</p>
        </div>
        <div className="bg-surface border border-white/8 rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-xs text-muted block mb-1.5">Email</label>
            <input type="email" placeholder="raj@gmail.com" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}
              className="w-full bg-ink border border-white/10 rounded-xl px-4 py-3 text-paper text-sm placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-colors"/>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-muted">Password</label>
              <Link to="/forgot-password" className="text-xs text-accent hover:underline">Forgot?</Link>
            </div>
            <input type="password" placeholder="••••••••" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))}
              className="w-full bg-ink border border-white/10 rounded-xl px-4 py-3 text-paper text-sm placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-colors"/>
          </div>
          {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
          <button onClick={submit} disabled={loading}
            className="w-full bg-accent text-white font-display font-semibold py-3 rounded-xl hover:bg-orange-600 transition-all disabled:opacity-50">
            {loading?'Logging in...':'Login →'}
          </button>
        </div>
        <p className="text-center text-sm text-muted mt-4">New shop? <Link to="/signup" className="text-accent hover:underline">Register here</Link></p>
      </div>
    </div>
  )
}
