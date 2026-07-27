import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api.js'

const STATUS_COLORS = {
  PENDING_PAYMENT:'text-yellow-400', AWAITING_CONFIRMATION:'text-blue-400',
  PAID:'text-blue-400', PRINTING:'text-purple-400',
  PRINTED:'text-green-400', FAILED:'text-red-400', REJECTED:'text-red-400'
}
const STATUS_ICON = {
  PENDING_PAYMENT:'⏳', AWAITING_CONFIRMATION:'📨',
  PAID:'✅', PRINTING:'🖨️', PRINTED:'🎉', FAILED:'❌', REJECTED:'🚫'
}

export default function SessionStatusPage() {
  const { sessionId } = useParams()
  const [orders, setOrders] = useState([])

  useEffect(() => {
    const poll = async () => {
      try {
        const { data } = await api.get(`/order/session/${sessionId}/status`)
        setOrders(data)
      } catch {}
    }
    poll()
    const iv = setInterval(poll, 4000)
    return () => clearInterval(iv)
  }, [sessionId])

  const allDone  = orders.length > 0 && orders.every(o => o.status === 'PRINTED')
  const anyFail  = orders.some(o => ['FAILED','REJECTED'].includes(o.status))
  const total    = orders.reduce((s,o) => s+o.amount, 0)

  return (
    <div className="min-h-screen bg-ink flex flex-col items-center justify-center px-4">
      <div className="max-w-sm w-full fade-up">
        <div className="text-center mb-6">
          {allDone
            ? <><div className="text-5xl mb-3">🎉</div><h1 className="font-display font-extrabold text-2xl text-green-400">All Prints Ready!</h1><p className="text-muted text-sm mt-1">Collect all your prints from the shopkeeper.</p></>
            : anyFail
            ? <><div className="text-5xl mb-3">⚠️</div><h1 className="font-display font-extrabold text-2xl text-yellow-400">Some Issues</h1><p className="text-muted text-sm mt-1">Check individual status below.</p></>
            : <><div className="text-5xl mb-3">🖨️</div><h1 className="font-display font-extrabold text-2xl text-paper">Print Queue</h1><p className="text-muted text-sm mt-1">{orders.filter(o=>o.status==='PRINTED').length} of {orders.length} done</p></>
          }
        </div>

        <div className="space-y-2 mb-5">
          {orders.map((o,i) => (
            <div key={o.id} className="bg-surface border border-white/8 rounded-2xl p-4 flex items-center gap-3">
              <div className="text-2xl">{STATUS_ICON[o.status]||'⏳'}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-display font-semibold truncate">{i+1}. {o.fileName}{o.orderNumber?<span className="text-muted font-normal"> · #{o.orderNumber}</span>:null}</div>
                <div className="text-xs text-muted mt-0.5">
                  {o.printType==='COLOR'?'🎨':'⬛'} {o.copies}× · ₹{o.amount}
                </div>
                {o.imagesPerPage > 1 && (
                  <div className="text-xs text-muted mt-0.5">🖼 Photo Batch · Layout: {o.imagesPerPage} Photos/Page</div>
                )}
              </div>
              <span className={`text-xs font-semibold shrink-0 ${STATUS_COLORS[o.status]}`}>
                {o.status==='PRINTED'?'Ready ✓':o.status==='PRINTING'?'Printing...':o.status==='PAID'?'Queued':o.status==='AWAITING_CONFIRMATION'?'Pending':''}
              </span>
            </div>
          ))}
        </div>

        {orders.length > 0 && (
          <div className="bg-surface border border-white/8 rounded-2xl p-4 flex justify-between font-display font-bold">
            <span>Total Paid</span>
            <span className="text-accent">₹{total}</span>
          </div>
        )}

        {allDone && (
          <div className="mt-4 bg-green-400/10 border border-green-400/20 rounded-2xl p-4 text-green-400 text-sm text-center font-medium">
            Show this screen to collect all your prints!
          </div>
        )}

        {!allDone && !anyFail && (
          <p className="text-xs text-muted text-center mt-4 animate-pulse">Auto-refreshing every 4 seconds...</p>
        )}
      </div>
    </div>
  )
}