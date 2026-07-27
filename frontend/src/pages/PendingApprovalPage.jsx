import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api.js'

export default function PendingApprovalPage() {
  const nav = useNavigate()
  const [shop, setShop] = useState(null)
  const [planInfo, setPlanInfo] = useState(null)

  const check = async () => {
    try {
      const [{data:s},{data:info}] = await Promise.all([api.get('/shop/me'), api.get('/auth/plan-info')])
      if (!s.emailVerified) return nav('/verify-email')
      if (s.subscriptionStatus==='NONE') return nav('/select-plan')
      if (s.subscriptionStatus!=='PENDING_PAYMENT') return nav('/join-whatsapp')
      setShop(s); setPlanInfo(info)
    } catch { nav('/login') }
  }

  useEffect(() => {
    if (!localStorage.getItem('token')) { nav('/login'); return }
    check()
    const iv = setInterval(check, 15000)
    return () => clearInterval(iv)
  }, [])

  if (!shop||!planInfo) return <div className="min-h-screen bg-ink flex items-center justify-center"><div className="text-muted text-sm">Loading...</div></div>

  const amount = planInfo.prices[shop.subscriptionPlan]
  const upiLink = `upi://pay?pa=${encodeURIComponent(planInfo.platformUpi)}&pn=PrintDrop&am=${amount}&cu=INR&tn=${encodeURIComponent('PrintDrop '+shop.subscriptionPlan)}`

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm fade-up text-center">
        <div className="text-5xl mb-4">⏳</div>
        <h1 className="font-display font-bold text-2xl mb-2">Pay Subscription</h1>
        <p className="text-muted text-sm mb-6">Pay via UPI, then message us on WhatsApp with screenshot. We'll activate within a few hours.</p>

        <div className="bg-surface border border-white/8 rounded-2xl p-5 space-y-2 mb-4 text-sm">
          <div className="flex justify-between"><span className="text-muted">Plan</span><span className="text-paper">{shop.subscriptionPlan}</span></div>
          <div className="flex justify-between font-display font-bold text-lg border-t border-white/8 pt-2">
            <span>Amount</span><span className="text-accent">₹{amount}</span>
          </div>
        </div>

        <a href={upiLink} className="w-full block text-center bg-accent text-white font-display font-bold py-4 rounded-2xl text-lg hover:bg-orange-600 transition-all mb-2">
          Pay ₹{amount} via UPI →
        </a>
        <p className="text-xs text-muted mb-5">UPI: <span className="font-mono text-paper">{planInfo.platformUpi}</span></p>

        {planInfo.whatsapp && (
          <a href={planInfo.whatsapp} target="_blank" rel="noreferrer"
            className="w-full block text-center border-2 border-green-500/40 text-green-400 font-display font-semibold py-3 rounded-2xl hover:bg-green-500/10 transition-all">
            💬 Message us on WhatsApp
          </a>
        )}
        <p className="text-xs text-muted mt-5 animate-pulse">Checking approval status every 15 seconds...</p>
      </div>
    </div>
  )
}
