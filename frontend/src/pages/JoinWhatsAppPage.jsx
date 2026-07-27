import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api.js'

export default function JoinWhatsAppPage() {
  const nav = useNavigate()
  const [link, setLink] = useState('')
  const [checked, setChecked] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('token')) { nav('/login'); return }
    Promise.all([api.get('/shop/me'), api.get('/auth/plan-info')]).then(([{data:s},{data:info}]) => {
      if (!s.emailVerified) return nav('/verify-email')
      if (s.subscriptionStatus==='NONE') return nav('/select-plan')
      if (s.subscriptionStatus==='PENDING_PAYMENT') return nav('/pending-approval')
      if (s.whatsappJoined) return nav('/dashboard')
      setLink(info.whatsapp)
    }).catch(()=>nav('/login'))
  },[])

  const proceed = async () => {
    setLoading(true)
    try { await api.post('/auth/join-whatsapp'); nav('/dashboard') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm fade-up text-center">
        <div className="text-5xl mb-4">💬</div>
        <h1 className="font-display font-bold text-2xl mb-2">One Last Step</h1>
        <p className="text-muted text-sm mb-6">Join our WhatsApp group for support and updates. Required for all shops.</p>
        <p className="text-xs text-muted/70 mb-4">Or email us directly: <a href="mailto:tech.support.dev@gmail.com" className="text-accent hover:underline">tech.support.dev@gmail.com</a></p>
        <a href={link} target="_blank" rel="noreferrer"
          className="w-full block text-center bg-green-500 text-white font-display font-bold py-4 rounded-2xl text-lg hover:bg-green-600 transition-all mb-5">
          💬 Join WhatsApp Group
        </a>
        <label className="flex items-center gap-3 bg-surface border border-white/8 rounded-2xl p-4 cursor-pointer mb-5">
          <input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} className="w-5 h-5 accent-accent"/>
          <span className="text-sm text-paper">I've joined the WhatsApp group</span>
        </label>
        <button onClick={proceed} disabled={!checked||loading}
          className="w-full bg-accent text-white font-display font-bold py-4 rounded-2xl text-lg hover:bg-orange-600 transition-all disabled:opacity-40">
          {loading?'Continuing...':'Continue to Dashboard →'}
        </button>
      </div>
    </div>
  )
}
