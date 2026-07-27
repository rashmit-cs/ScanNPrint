import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api.js'

const INFO = {
  PENDING_PAYMENT:       { icon:'⏳', title:'Awaiting Payment',   msg:'Please complete payment.', color:'text-yellow-400' },
  AWAITING_CONFIRMATION: { icon:'📨', title:'Notified Shop!',     msg:'Waiting for shopkeeper to confirm payment.', color:'text-blue-400' },
  PAID:                  { icon:'✅', title:'Confirmed!',         msg:'Payment confirmed. Queued for printing...', color:'text-blue-400' },
  PRINTING:              { icon:'🖨️', title:'Printing Now!',      msg:'Your document is printing right now.', color:'text-purple-400' },
  PRINTED:               { icon:'🎉', title:'Ready for Collection', msg:'Your print request has been processed.\nPlease collect your documents from the shop.\nIf your documents are not available, please contact the shopkeeper.', color:'text-green-400' },
  FAILED:                { icon:'❌', title:'Print Failed',       msg:'Something went wrong. Please contact shopkeeper.', color:'text-red-400' },
  REJECTED:              { icon:'🚫', title:'Payment Not Found',  msg:'Shopkeeper could not confirm payment. Please check with them.', color:'text-red-400' },
}

const STEPS = ['AWAITING_CONFIRMATION','PAID','PRINTING','PRINTED']
const STEP_LABELS = ['Sent','Confirmed','Printing','Ready']

export default function OrderStatusPage() {
  const { orderId } = useParams()
  const [order, setOrder] = useState(null)

  useEffect(() => {
    const poll = async () => {
      try { const { data } = await api.get(`/order/${orderId}/status`); setOrder(data) } catch {}
    }
    poll()
    const iv = setInterval(poll, 4000)
    return () => clearInterval(iv)
  }, [orderId])

  if (!order) return <div className="min-h-screen bg-ink flex items-center justify-center"><div className="text-muted text-sm">Loading...</div></div>

  const info = INFO[order.status] || INFO['AWAITING_CONFIRMATION']
  const step = STEPS.indexOf(order.status)
  const done = ['FAILED','REJECTED'].includes(order.status)

  return (
    <div className="min-h-screen bg-ink flex flex-col items-center justify-center px-4">
      <div className="max-w-sm w-full fade-up text-center">
        <div className="text-6xl mb-4">{info.icon}</div>
        {order.orderNumber && <p className="text-xs text-muted mb-1">Order #{order.orderNumber}</p>}
        <h1 className={`font-display font-extrabold text-2xl mb-2 ${info.color}`}>{info.title}</h1>
        <p className="text-muted text-sm mb-8 whitespace-pre-line">{info.msg}</p>

        {!done && step >= 0 && (
          <div className="flex items-center gap-1 mb-8 justify-center">
            {STEP_LABELS.map((label,i) => (
              <React.Fragment key={label}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${i<=step?'bg-accent border-accent text-white':'border-white/20 text-muted'}`}>
                    {i<=step?'✓':i+1}
                  </div>
                  <span className="text-[10px] text-muted">{label}</span>
                </div>
                {i<3&&<div className={`h-0.5 w-5 mb-4 ${i<step?'bg-accent':'bg-white/10'}`}/>}
              </React.Fragment>
            ))}
          </div>
        )}

        <div className="bg-surface border border-white/8 rounded-2xl p-4 text-sm text-left space-y-2">
          <div className="flex justify-between"><span className="text-muted">File</span><span className="text-paper text-xs truncate max-w-[55%]">{order.fileName}</span></div>
          <div className="flex justify-between"><span className="text-muted">Type</span><span>{order.printType==='COLOR'?'🎨 Color':'⬛ B&W'}</span></div>
          <div className="flex justify-between"><span className="text-muted">Copies</span><span className="text-paper">{order.copies}</span></div>
          {order.imagesPerPage > 1 && (
            <div className="flex justify-between"><span className="text-muted">Layout</span><span className="text-paper">🖼 {order.imagesPerPage} Photos/Page</span></div>
          )}
          <div className="flex justify-between font-display font-bold border-t border-white/8 pt-2">
            <span>Amount</span><span className="text-accent">₹{order.amount}</span>
          </div>
        </div>

        {order.status==='PRINTED' && (
          <div className="mt-5 bg-green-400/10 border border-green-400/20 rounded-2xl p-4 text-green-400 text-sm font-medium">
            Show this screen to the shopkeeper to collect your print!
          </div>
        )}

        {!done && order.status!=='PRINTED' && (
          <p className="text-xs text-muted mt-4 animate-pulse">Auto-refreshing every 4 seconds...</p>
        )}
      </div>
    </div>
  )
}