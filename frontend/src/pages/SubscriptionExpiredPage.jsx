import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api.js'

const PLANS = [
  {id:'MONTHLY',label:'Monthly',sub:'30 days'},
  {id:'QUARTERLY',label:'3 Months',sub:'90 days'},
  {id:'HALF_YEARLY',label:'6 Months',sub:'180 days'},
  {id:'YEARLY',label:'1 Year',sub:'365 days'},
]

export default function SubscriptionExpiredPage() {
  const nav = useNavigate()
  const [planInfo, setPlanInfo] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState('')

  useEffect(() => {
    if (!localStorage.getItem('token')) { nav('/login'); return }
    api.get('/auth/plan-info').then(({data})=>setPlanInfo(data))
  },[])

  const choose = async (plan) => {
    setError(''); setLoading(plan)
    try {
      const { data } = await api.post('/payment/create-order', { plan })

      const options = {
        key:         data.key,
        amount:      data.amountPaise,
        currency:    'INR',
        name:        'ScanNPrint',
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

  if (!planInfo) return <div className="min-h-screen bg-ink flex items-center justify-center"><div className="text-muted text-sm">Loading...</div></div>

  return (
    <div className="min-h-screen bg-ink flex flex-col items-center justify-center px-4 py-10">
      <div className="text-center mb-8">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="font-display font-bold text-2xl mb-2">Subscription Expired</h1>
        <p className="text-muted text-sm">Renew to continue receiving print orders — activates instantly.</p>
      </div>
      {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2 mb-4">{error}</p>}
      <div className="w-full max-w-sm grid grid-cols-2 gap-3">
        {PLANS.map(p=>(
          <div key={p.id} className="bg-surface border border-white/8 rounded-2xl p-4">
            <div className="font-display font-bold">{p.label}</div>
            <div className="text-xs text-muted mb-2">{p.sub}</div>
            <div className="font-display font-extrabold text-accent text-lg mb-3">₹{planInfo.prices[p.id]}</div>
            <button onClick={()=>choose(p.id)} disabled={loading===p.id}
              className="w-full bg-accent text-white font-display font-semibold py-2 rounded-xl hover:bg-orange-600 transition-all text-sm disabled:opacity-50">
              {loading===p.id?'...':'Renew Now'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
