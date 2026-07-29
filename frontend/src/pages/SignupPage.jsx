import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api.js'

export default function SignupPage() {
  const nav = useNavigate()
  const [form, setForm] = useState({ name:'', ownerName:'', email:'', phone:'', password:'' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))

  const submit = async () => {
    setError('')
    if (!agreedToTerms) { setError('Please agree to the Terms of Service and Privacy Policy to continue.'); return }
    setLoading(true)
    try {
      const { data } = await api.post('/auth/signup', form)
      localStorage.setItem('token', data.token)
      if (data.devOtp) localStorage.setItem('devOtp', data.devOtp)
      nav('/verify-email')
    } catch(e) { setError(e.response?.data?.error||'Signup failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-md fade-up">
        <div className="text-center mb-8">
          <Link to="/" className="font-display font-bold text-2xl">
  Scan<span className="text-accent">NPrint</span>
</Link>

<p className="text-muted mt-2 text-sm">
  Register your print shop on ScanNPrint
</p>
          
        </div>
        <div className="bg-surface border border-white/8 rounded-2xl p-6 space-y-4">
          {[
            {label:'Shop Name',key:'name',placeholder:'Raj Xerox Center'},
            {label:'Your Name',key:'ownerName',placeholder:'Rajesh Kumar'},
            {label:'Email',key:'email',placeholder:'raj@gmail.com',type:'email'},
            {label:'Phone (10 digit)',key:'phone',placeholder:'9876543210',type:'tel'},
            {label:'Password',key:'password',placeholder:'••••••••',type:'password'},
          ].map(f=>(
            <div key={f.key}>
              <label className="text-xs text-muted block mb-1.5">{f.label}</label>
              <input type={f.type||'text'} placeholder={f.placeholder} value={form[f.key]} onChange={set(f.key)}
                className="w-full bg-ink border border-white/10 rounded-xl px-4 py-3 text-paper text-sm placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-colors"/>
            </div>
          ))}
          <p className="text-xs text-muted">One account per email+phone. We'll send a verification code to your email.</p>
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={e => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-white/20 bg-ink text-accent accent-accent focus:outline-none focus:ring-1 focus:ring-accent/50 flex-shrink-0"
            />
            <span className="text-xs text-muted leading-relaxed">
              I confirm I have read and agree to the{' '}
              <Link to={`/terms?returnTo=${encodeURIComponent('/signup')}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Terms of Service</Link>
              {' '}and{' '}
              <Link to={`/privacy?returnTo=${encodeURIComponent('/signup')}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Privacy Policy</Link>.
            </span>
          </label>
          {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
          <button onClick={submit} disabled={loading || !agreedToTerms}
            className="w-full bg-accent text-white font-display font-semibold py-3 rounded-xl hover:bg-orange-600 transition-all disabled:opacity-50">
            {loading?'Creating account...':'Create Shop →'}
          </button>
        </div>
        <p className="text-center text-sm text-muted mt-4">Already registered? <Link to="/login" className="text-accent hover:underline">Login</Link></p>
      </div>
    </div>
  )
}