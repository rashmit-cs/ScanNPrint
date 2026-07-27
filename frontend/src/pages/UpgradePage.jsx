import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api.js'

const PLANS = [
  { id:'MONTHLY',     label:'Monthly',  sub:'30 days',  perMonth:'₹399/mo' },
  { id:'QUARTERLY',   label:'3 Months', sub:'90 days',  perMonth:'₹333/mo', badge:'Popular' },
  { id:'HALF_YEARLY', label:'6 Months', sub:'180 days', perMonth:'₹300/mo' },
  { id:'YEARLY',      label:'1 Year',   sub:'365 days', perMonth:'₹266/mo', badge:'Best value' },
]

export default function UpgradePage() {
  const nav = useNavigate()
  const [planInfo, setPlanInfo] = useState(null)
  const [shop, setShop] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState('')

  const load = () => Promise.all([api.get('/auth/plan-info'), api.get('/shop/me')])
    .then(([{data:info},{data:s}]) => { setPlanInfo(info); setShop(s) })
    .catch(()=>nav('/login'))

  useEffect(() => {
    if (!localStorage.getItem('token')) { nav('/login'); return }
    load()
  },[])

  const choose = async (plan) => {
    setError(''); setLoading(plan)
    try {
      const { data } = await api.post('/payment/create-order', { plan })

      const options = {
        key:         data.key,
        amount:      data.amountPaise,
        currency:    'INR',
        name:        'PrintDrop',
        description: `${plan} Subscription`,
        order_id:    data.razorpayOrderId,

        handler: async function (response) {
          try {
            await api.post('/payment/verify', {
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              plan,
            })
            nav('/dashboard')
          } catch (err) {
            setError(err.response?.data?.error || 'Payment succeeded but activation failed — contact support with your payment ID.')
          }
        },

        theme: { color: '#f97316' },
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', (response) => {
        setError(response.error?.description || 'Payment failed. Try again.')
      })
      rzp.open()
    } catch (e) {
      setError(e.response?.data?.error || 'Unable to start payment.')
    } finally {
      setLoading('')
    }
  }

  if (!planInfo || !shop) return <div className="min-h-screen bg-ink flex items-center justify-center"><div className="text-muted text-sm">Loading...</div></div>

  const daysLeft = shop.subscriptionEnd ? Math.ceil((new Date(shop.subscriptionEnd)-Date.now())/86400000) : null
  const isTrial = shop.subscriptionPlan === 'TRIAL'

  return (
    <div className="min-h-screen bg-ink">
      <nav className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <Link to="/dashboard" className="font-display font-bold text-lg">Print<span className="text-accent">Drop</span></Link>
        <Link to="/dashboard" className="text-xs text-muted hover:text-paper">← Back to dashboard</Link>
      </nav>
      <div className="max-w-md mx-auto px-4 py-10">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🚀</div>
          <h1 className="font-display font-bold text-2xl mb-2">Upgrade Your Plan</h1>
          <p className="text-muted text-sm">
            {isTrial && daysLeft > 0
              ? `${daysLeft} day${daysLeft!==1?'s':''} left on your free trial — upgrade any time, activates instantly, no interruption.`
              : 'Pick a plan. Activates instantly after payment — no waiting, no approval.'}
          </p>
        </div>
        {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2 mb-4 text-center">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          {PLANS.map(p=>(
            <div key={p.id} className={`bg-surface border rounded-2xl p-4 relative ${p.badge?'border-accent/50':'border-white/8'}`}>
              {p.badge && <span className="absolute -top-2 right-3 bg-accent text-white text-[9px] font-bold px-2 py-0.5 rounded-full">{p.badge}</span>}
              <div className="font-display font-bold">{p.label}</div>
              <div className="text-xs text-muted mb-1">{p.sub}</div>
              <div className="font-display font-extrabold text-accent text-lg">₹{planInfo.prices[p.id]}</div>
              <div className="text-[10px] text-muted mb-3">{p.perMonth}</div>
              <button onClick={()=>choose(p.id)} disabled={loading===p.id}
                className="w-full bg-accent text-white font-display font-semibold py-2 rounded-xl hover:bg-orange-600 transition-all text-sm disabled:opacity-50">
                {loading===p.id?'...':'Pay & Activate'}
              </button>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted mt-6">Secured by Razorpay. Your plan switches over the instant payment is confirmed.</p>
      </div>
    </div>
  )
}
