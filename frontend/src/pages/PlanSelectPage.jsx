import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api.js'

const PLANS = [
  { id:'TRIAL',       label:'Free Trial',  sub:'15 days, full access', price:'₹0',    badge:'Try first',   highlight:false },
  { id:'MONTHLY',     label:'Monthly',     sub:'30 days',              price:'₹399',  perMonth:'₹399/mo',  highlight:false },
  { id:'QUARTERLY',   label:'3 Months',    sub:'90 days',              price:'₹999',  perMonth:'₹333/mo',  highlight:true,  badge:'Popular' },
  { id:'HALF_YEARLY', label:'6 Months',    sub:'180 days',             price:'₹1799', perMonth:'₹300/mo',  highlight:false },
  { id:'YEARLY',      label:'1 Year',      sub:'365 days',             price:'₹3199', perMonth:'₹266/mo',  highlight:false, badge:'Best value' },
]

export default function PlanSelectPage() {
  const nav = useNavigate()
  const [trialUsed, setTrialUsed] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState('')

  useEffect(() => {
    if (!localStorage.getItem('token')) { nav('/login'); return }
    api.get('/shop/me').then(({data}) => {
      if (!data.emailVerified) { nav('/verify-email'); return }
      if (data.subscriptionStatus==='PENDING_PAYMENT') { nav('/pending-approval'); return }
      if (data.subscriptionStatus!=='NONE') { nav('/join-whatsapp'); return }
      setTrialUsed(data.trialUsed)
    }).catch(()=>nav('/login'))
  },[])

  const choose = async (plan) => {
    setError('')
    setLoading(plan)

    try {
      // Free Trial — unchanged
      if (plan === 'TRIAL') {
        const { data } = await api.post('/auth/select-plan', { plan })
        nav(data.status === 'TRIAL' ? '/join-whatsapp' : '/pending-approval')
        return
      }

      // 1. Create Razorpay order on backend
      const { data } = await api.post('/payment/create-order', { plan })

      const options = {
        key: data.key,
        amount: data.amountPaise,
        currency: 'INR',
        name: 'PrintDrop',
        description: `${plan} Subscription`,
        order_id: data.razorpayOrderId,

        handler: async function (response) {
          try {
            await api.post('/payment/verify', {
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              plan,
            })
            alert('✅ Subscription Activated!')
            const { data: shop } = await api.get('/shop/me')
            nav(shop.whatsappJoined ? '/dashboard' : '/join-whatsapp')
          } catch (err) {
            alert(err.response?.data?.error || 'Payment verification failed.')
          }
        },

        theme: { color: '#f97316' },
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', function (response) {
        console.error(response.error)
        alert(response.error.description || 'Payment failed.')
      })
      rzp.open()
      setLoading('')  // clear immediately — rzp modal takes over

    } catch (e) {
      setError(e.response?.data?.error || 'Unable to create payment.')
    } finally {
      setLoading('')
    }
  }

  return (
    <div className="min-h-screen bg-ink px-4 py-10">
      <div className="max-w-2xl mx-auto fade-up">
        <div className="text-center mb-8">
          <Link to="/" className="font-display font-bold text-2xl">Print<span className="text-accent">Drop</span></Link>
          <h1 className="font-display font-bold text-2xl mt-4">Choose Your Plan</h1>
          <p className="text-muted text-sm mt-1">Start free or subscribe directly.</p>
        </div>
        {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2 mb-4 text-center">{error}</p>}
        <div className="grid sm:grid-cols-2 gap-3">
          {PLANS.map(p => {
            const disabled = p.id==='TRIAL' && trialUsed
            return (
              <div key={p.id} className={`relative bg-surface border rounded-2xl p-5 transition-all ${p.highlight?'border-accent':'border-white/8'} ${disabled?'opacity-40':''}`}>
                {p.badge && <span className="absolute -top-2.5 left-5 bg-accent text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">{p.badge}</span>}
                <div className="font-display font-bold text-lg mt-1">{p.label}</div>
                <div className="text-xs text-muted mb-3">{p.sub}</div>
                <div className="font-display font-extrabold text-2xl text-accent">{p.price}</div>
                {p.perMonth && <div className="text-xs text-muted mb-3">{p.perMonth}</div>}
                <button onClick={()=>choose(p.id)} disabled={disabled||loading===p.id}
                  className="w-full mt-3 bg-accent text-white font-display font-semibold py-2.5 rounded-xl hover:bg-orange-600 transition-all disabled:opacity-40 text-sm">
                  {disabled?'Already Used':loading===p.id?'Please wait...':p.id==='TRIAL'?'Start Free Trial':'Choose Plan'}
                </button>
              </div>
            )
          })}
        </div>
        <p className="text-center text-xs text-muted mt-6">Paid plans are activated instantly after Razorpay payment.</p>
      </div>
    </div>
  )
}