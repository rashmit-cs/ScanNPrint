import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import api from '../api.js'

// Draws a filled/stroked rounded rectangle path on a canvas 2D context.
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Serializes the currently-rendered QRCodeSVG into an Image element, so it can be
// drawn onto a <canvas> at any resolution (it's vector, so it stays crisp at 1024px+).
// Does NOT touch the QR value/error-correction — purely a rendering/export step.
function svgNodeToImage(svg) {
  return new Promise((resolve, reject) => {
    if (!svg) return reject(new Error('QR not ready'))
    const svgData = new XMLSerializer().serializeToString(svg)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => resolve({ img, svgUrl })
    img.onerror = (e) => { URL.revokeObjectURL(svgUrl); reject(e) }
    img.src = svgUrl
  })
}

// Sanitizes a shop name into a safe filename fragment, e.g. "Shree Xerox" -> "Shree-Xerox"
function safeFileName(name) {
  return (name || 'Shop').trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '') || 'Shop'
}


const STATUS_COLORS = {
  PENDING_PAYMENT:'text-yellow-400 bg-yellow-400/10',
  AWAITING_CONFIRMATION:'text-blue-400 bg-blue-400/10',
  PAID:'text-blue-400 bg-blue-400/10',
  PRINTING:'text-purple-400 bg-purple-400/10',
  PRINTED:'text-green-400 bg-green-400/10',
  FAILED:'text-red-400 bg-red-400/10',
  REJECTED:'text-red-400 bg-red-400/10',
}
const STATUS_LABEL = {
  PENDING_PAYMENT:'Awaiting Payment', AWAITING_CONFIRMATION:'Needs Confirmation',
  PAID:'Confirmed — Queued', PRINTING:'Printing...', PRINTED:'Done ✓',
  FAILED:'Failed', REJECTED:'Rejected',
}

export default function DashboardPage() {
  const nav = useNavigate()
  const qrRef = useRef()
  const [shop, setShop] = useState(null)
  const [stats, setStats] = useState({})
  const [orders, setOrders] = useState([])
  const [pending, setPending] = useState([])
  const [printers, setPrinters] = useState([])
  const [agentInfo, setAgentInfo] = useState(null)
  const [freshCred, setFreshCred] = useState(null) // {shopId, secret, serverUrl} — only right after generate/regenerate, shown once
  const [agentBusy, setAgentBusy] = useState(false)
  const [tab, setTab] = useState('overview')
  const [copied, setCopied] = useState('')
  const [loadError, setLoadError] = useState(false)

  // Prefer a pinned frontend URL (e.g. app.ScanNprint.in) if configured, so QR codes
  // keep pointing at the customer-facing domain even if the dashboard itself later
  // moves to a different subdomain (e.g. admin.ScanNprint.in). Falls back to the
  // current origin — same behavior as before for anyone without this env var set.
  const FRONTEND_URL = (import.meta.env.VITE_FRONTEND_URL || window.location.origin).replace(/\/$/, '')
  const shopUrl = shop ? `${FRONTEND_URL}/shop/${shop.id}` : ''
  // Display-only — the QR itself still encodes the full shopUrl (with the shop id).
  // Showing just the domain avoids printing a long, meaningless UUID on the card.
  const shopDomainDisplay = FRONTEND_URL.replace(/^https?:\/\//, '')

  const load = async () => {
    try {
      const shopRes = await api.get('/shop/me')
      const s = shopRes.data
      if (!s.emailVerified) return nav('/verify-email')
      if (s.subscriptionStatus==='NONE') return nav('/select-plan')
      if (s.subscriptionStatus==='PENDING_PAYMENT') return nav('/pending-approval')
      if (!s.whatsappJoined) return nav('/join-whatsapp')
      if (s.effectiveStatus==='EXPIRED') return nav('/subscription-expired')

      const [statsRes, ordersRes, pendingRes, printersRes, agentRes] = await Promise.allSettled([
        api.get('/shop/stats'),
        api.get('/order/shop/list'),
        api.get('/order/shop/pending'),
        api.get('/shop/printers'),
        api.get('/shop/agent-info'),
      ])
      setShop(s)
      setLoadError(false)
      // Partial-failure tolerant: a single flaky endpoint (e.g. printers or
      // agent-info) no longer blanks out data that loaded fine, and no longer
      // triggers the catch-all below (which used to boot the user to /login).
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data)
      else console.error('stats failed:', statsRes.reason)
      if (ordersRes.status === 'fulfilled') setOrders(ordersRes.value.data)
      else console.error('orders failed:', ordersRes.reason)
      if (pendingRes.status === 'fulfilled') setPending(pendingRes.value.data)
      else console.error('pending failed:', pendingRes.reason)
      if (printersRes.status === 'fulfilled') setPrinters(printersRes.value.data)
      else console.error('printers failed:', printersRes.reason)
      if (agentRes.status === 'fulfilled') setAgentInfo(agentRes.value.data)
      else console.error('agent-info failed:', agentRes.reason)
    } catch(e) {
      const status = e.response?.status
      const step = e.response?.data?.step
      if (step==='verify-email') return nav('/verify-email')
      if (step==='select-plan') return nav('/select-plan')
      if (step==='pending-approval') return nav('/pending-approval')
      if (step==='join-whatsapp') return nav('/join-whatsapp')
      if (step==='subscription-expired') return nav('/subscription-expired')

      // Only a real auth failure should log the user out.
      // Any other error (network blip, 500, timeout, polling hiccup) should not.
      if (status === 401) {
        localStorage.removeItem('token')
        return nav('/login')
      }

      console.error('Dashboard load failed:', e)
      // If we've never successfully loaded (shop is still null), surface a
      // retry screen instead of leaving the user stuck on "Loading..." forever.
      // If shop is already set, this was just a failed background poll —
      // stay silent and keep showing the last-known-good data.
      setShop(prev => { if (prev === null) setLoadError(true); return prev })
    }
  }

  useEffect(() => {
    if (!localStorage.getItem('token')) { nav('/login'); return }
    load()
    const iv = setInterval(load, 8000)
    return () => clearInterval(iv)
  },[])

  const logout = () => { localStorage.removeItem('token'); nav('/') }
  const copy = (text, label) => { navigator.clipboard.writeText(text); setCopied(label); setTimeout(()=>setCopied(''),2000) }

  const downloadConfigEnv = (cred) => {
    const content = `ScanNprint_SERVER=${cred.serverUrl}\nScanNprint_SHOP_ID=${cred.shopId}\nScanNprint_SECRET=${cred.secret}\n`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'config.env'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const generateAgentSecret = async () => {
    setAgentBusy(true)
    try {
      const { data } = await api.post('/shop/agent-secret/generate')
      setFreshCred(data)
      downloadConfigEnv(data)
      setAgentInfo(a => ({ ...a, configured: true }))
    } catch (e) { alert(e.response?.data?.error || 'Failed to generate') }
    finally { setAgentBusy(false) }
  }

  const regenerateAgentSecret = async () => {
    if (!confirm('This immediately disconnects the PC currently running your agent — it will show "Unauthorized" until you install the new config.env. Continue?')) return
    setAgentBusy(true)
    try {
      const { data } = await api.post('/shop/agent-secret/regenerate')
      setFreshCred(data)
      downloadConfigEnv(data)
      setAgentInfo(a => ({ ...a, configured: true }))
    } catch (e) { alert(e.response?.data?.error || 'Failed to regenerate') }
    finally { setAgentBusy(false) }
  }

  // Same QR value/level as on-screen — this only rasterizes it at high resolution for download.
  const downloadQR = async () => {
    try {
      const svg = qrRef.current?.querySelector('svg')
      const { img, svgUrl } = await svgNodeToImage(svg)
      const SIZE = 1024
      const canvas = document.createElement('canvas')
      canvas.width = SIZE; canvas.height = SIZE
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, SIZE, SIZE)
      ctx.drawImage(img, 0, 0, SIZE, SIZE)
      URL.revokeObjectURL(svgUrl)
      canvas.toBlob((blob) => {
        if (!blob) return
        const pngUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = pngUrl
        a.download = `${safeFileName(shop?.name)}-ScanNprint-QR.png`
        a.click()
        setTimeout(() => URL.revokeObjectURL(pngUrl), 1000)
      }, 'image/png')
    } catch (e) {
      console.error('QR download failed:', e)
      alert('Could not generate QR image. Please try again.')
    }
  }

  // A4 @ 300dpi printable poster (2480×3508px portrait). Pure export/design step —
  // reuses the same on-screen QR (same value, same level=H), no logic changes.
  const downloadPoster = async () => {
    try {
      const svg = qrRef.current?.querySelector('svg')
      const { img, svgUrl } = await svgNodeToImage(svg)

      const W = 2480, H = 3508
      const canvas = document.createElement('canvas')
      canvas.width = W; canvas.height = H
      const ctx = canvas.getContext('2d')
      const cx = W / 2

      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, W, H)
      ctx.textAlign = 'center'

      let y = 220
      // Logo: "Print" (dark) + "Drop" (accent)
      const logoFont = '700 90px "DM Sans", Arial, sans-serif'
      ctx.font = logoFont
      const printW = ctx.measureText('Print').width
      const dropW = ctx.measureText('Drop').width
      const totalW = printW + dropW
      ctx.textAlign = 'left'
      ctx.fillStyle = '#0A0A0F'
      ctx.fillText('Scan', cx - totalW / 2, y)
      ctx.fillStyle = '#EA580C'
      ctx.fillText('NPrint', cx - totalW / 2 + printW, y)
      ctx.textAlign = 'center'

      y += 200
      ctx.fillStyle = '#0A0A0F'
      ctx.font = '800 150px "DM Sans", Arial, sans-serif'
      ctx.fillText('PRINT HERE', cx, y)

      y += 110
      ctx.font = '500 56px Arial, sans-serif'
      ctx.fillStyle = '#555555'
      ctx.fillText('Scan this QR Code', cx, y)

      y += 90
      const qrBoxSize = 1500, qrPad = 70
      const qrBoxX = cx - qrBoxSize / 2, qrBoxY = y
      roundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 48)
      ctx.fillStyle = '#F5F0E8'
      ctx.fill()
      ctx.lineWidth = 6
      ctx.strokeStyle = '#E5DFD3'
      ctx.stroke()
      ctx.drawImage(img, qrBoxX + qrPad, qrBoxY + qrPad, qrBoxSize - qrPad * 2, qrBoxSize - qrPad * 2)
      URL.revokeObjectURL(svgUrl)

      y = qrBoxY + qrBoxSize + 140
      ctx.fillStyle = '#0A0A0F'
      ctx.font = '700 84px "DM Sans", Arial, sans-serif'
      ctx.fillText(shop?.name || 'Print Shop', cx, y)

      y += 130
      const steps = ['Upload Documents', 'Pay Securely', 'Collect Prints']
      ctx.font = '600 48px Arial, sans-serif'
      ctx.fillStyle = '#333333'
      const stepGap = 70
      const widths = steps.map(s => ctx.measureText(s).width)
      const totalStepsW = widths.reduce((a, b) => a + b, 0) + stepGap * (steps.length - 1)
      if (totalStepsW < W - 300) {
        let sx = cx - totalStepsW / 2
        ctx.textAlign = 'left'
        steps.forEach((s, i) => { ctx.fillText(s, sx, y); sx += widths[i] + stepGap })
        ctx.textAlign = 'center'
      } else {
        steps.forEach((s, i) => ctx.fillText(s, cx, y + i * 80))
        y += 80 * (steps.length - 1)
      }

      y += 150
      ctx.font = '600 46px Arial, sans-serif'
      ctx.fillStyle = '#888888'
      ctx.fillText('Supports', cx, y)

      y += 90
      const formats = ['PDF', 'DOC', 'DOCX', 'JPG', 'PNG']
      ctx.font = '700 40px Arial, sans-serif'
      const chipPadX = 40, chipH = 90, chipGap = 30
      const chipWidths = formats.map(f => ctx.measureText(f).width + chipPadX * 2)
      const totalChipsW = chipWidths.reduce((a, b) => a + b, 0) + chipGap * (formats.length - 1)
      let chipX = cx - totalChipsW / 2
      formats.forEach((f, i) => {
        const cw = chipWidths[i]
        roundRect(ctx, chipX, y, cw, chipH, chipH / 2)
        ctx.fillStyle = '#F5F0E8'
        ctx.fill()
        ctx.lineWidth = 3
        ctx.strokeStyle = '#E5DFD3'
        ctx.stroke()
        ctx.fillStyle = '#0A0A0F'
        ctx.fillText(f, chipX + cw / 2, y + chipH / 2 + 14)
        chipX += cw + chipGap
      })

      ctx.font = '500 40px Arial, sans-serif'
      ctx.fillStyle = '#999999'
      ctx.fillText('Powered by ScanNprint', cx, H - 120)

      canvas.toBlob((blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${safeFileName(shop?.name)}-ScanNprint-Poster.png`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }, 'image/png')
    } catch (e) {
      console.error('Poster download failed:', e)
      alert('Could not generate poster. Please try again.')
    }
  }

  const confirmOrder = async (id) => { await api.post(`/order/${id}/confirm`); load() }
  const confirmSession = async (sid) => { await api.post(`/order/session/${sid}/confirm`); load() }
  const rejectOrder = async (id) => { if(!confirm('Reject this order?')) return; await api.post(`/order/${id}/reject`); load() }
  const rejectSession = async (sid) => { if(!confirm('Reject entire queue?')) return; await api.post(`/order/session/${sid}/reject`); load() }

  const updatePrinter = async (id, data) => { await api.put(`/shop/printers/${id}`, data); load() }

  if (!shop && loadError) return (
    <div className="min-h-screen bg-ink flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="text-muted">Unable to load dashboard.</div>
        <button
          onClick={() => { setLoadError(false); load() }}
          className="px-4 py-2 rounded-lg bg-accent text-white font-semibold hover:opacity-90 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  )

  if (!shop) return <div className="min-h-screen bg-ink flex items-center justify-center"><div className="text-muted">Loading...</div></div>

  // Group pending by session
  const groupedPending = pending.reduce((acc, o) => {
    const key = o.queueSessionId || o.id
    if (!acc[key]) acc[key] = []
    acc[key].push(o)
    return acc
  }, {})

  // Subscription days left
  const daysLeft = shop.subscriptionEnd ? Math.ceil((new Date(shop.subscriptionEnd)-Date.now())/86400000) : null

  return (
    <div className="min-h-screen bg-ink">
      <nav className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <span className="font-display font-bold text-lg">Scan<span className="text-accent">NPrint</span></span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted hidden sm:block">{shop.name}</span>
          <Link to="/upgrade" className="text-xs bg-accent/10 text-accent border border-accent/30 px-3 py-1.5 rounded-lg hover:bg-accent/20 transition-colors font-semibold">🚀 Upgrade</Link>
          <Link to="/setup" className="text-xs text-muted hover:text-paper border border-white/10 px-3 py-1.5 rounded-lg transition-colors">Settings</Link>
          <button onClick={logout} className="text-xs text-muted hover:text-red-400 transition-colors">Logout</button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-surface rounded-xl p-1 mb-6 flex-wrap">
          {['overview','confirm','printers','qr','agent','orders'].map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className={`px-4 py-2 rounded-lg text-xs font-display font-semibold transition-all capitalize relative ${tab===t?'bg-accent text-white':'text-muted hover:text-paper'}`}>
              {t==='confirm'?'Confirm Payments':t==='agent'?'🖥 Agent':t==='qr'?'QR Code':t}
              {t==='confirm'&&pending.length>0&&(
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{pending.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab==='overview'&&(
          <div className="fade-up space-y-4">
            {/* Subscription banner */}
            {shop.subscriptionEnd&&(
              <div className="bg-surface border border-white/8 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="font-display font-semibold text-sm">
                    {shop.subscriptionPlan==='TRIAL'?'🎁 Free Trial':`📦 ${shop.subscriptionPlan} Plan`}
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {daysLeft>0?`${daysLeft} day${daysLeft!==1?'s':''} remaining`:'Expired'}
                    {' · until '}{new Date(shop.subscriptionEnd).toLocaleDateString('en-IN')}
                  </div>
                </div>
                {daysLeft<=3
                  ? <Link to="/subscription-expired" className="text-xs bg-accent text-white px-3 py-1.5 rounded-lg font-semibold">Renew Now</Link>
                  : <Link to="/upgrade" className="text-xs text-green-400 bg-green-400/10 px-3 py-1 rounded-full font-semibold hover:bg-green-400/20 transition-colors">● Active · Upgrade</Link>
                }
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {label:'Today',value:stats.todayOrders??0,sub:'prints done'},
                {label:'Total',value:stats.totalOrders??0,sub:'all time'},
                {label:'To Confirm',value:stats.pendingConfirm??0,sub:'need action'},
                {label:'Revenue',value:`₹${stats.totalRevenue??0}`,sub:'total earned'},
              ].map(s=>(
                <div key={s.label} className="bg-surface border border-white/8 rounded-2xl p-4">
                  <div className="text-xs text-muted mb-1">{s.label}</div>
                  <div className="font-display font-bold text-2xl text-paper">{s.value}</div>
                  <div className="text-xs text-muted mt-0.5">{s.sub}</div>
                </div>
              ))}
            </div>

            {pending.length>0&&(
              <div onClick={()=>setTab('confirm')} className="bg-blue-400/10 border border-blue-400/20 rounded-2xl p-4 cursor-pointer hover:bg-blue-400/15 transition-colors">
                <div className="font-display font-semibold text-blue-300">📨 {pending.length} payment{pending.length>1?'s':''} waiting for confirmation</div>
                <div className="text-xs text-muted mt-1">Tap to review → confirm → printer starts</div>
              </div>
            )}

            <div className="bg-surface border border-white/8 rounded-2xl p-4 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted">Shop Status</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${shop.isOpen?'bg-green-400/10 text-green-400':'bg-red-400/10 text-red-400'}`}>{shop.isOpen?'● Open':'● Closed'}</span>
              </div>
              <div className="flex justify-between"><span className="text-muted">Color price</span><span className="text-paper">₹{shop.colorPrice}/page</span></div>
              <div className="flex justify-between"><span className="text-muted">B&W price</span><span className="text-paper">₹{shop.bwPrice}/page</span></div>
              <div className="flex justify-between"><span className="text-muted">Your UPI</span><span className="text-paper font-mono text-xs">{shop.upiId||'Not set — go to Settings'}</span></div>
            </div>
          </div>
        )}

        {/* CONFIRM PAYMENTS */}
        {tab==='confirm'&&(
          <div className="fade-up space-y-3">
            {Object.keys(groupedPending).length===0
              ? <div className="text-center text-muted py-12 bg-surface border border-white/8 rounded-2xl">🎉 No payments waiting for confirmation!</div>
              : Object.entries(groupedPending).map(([key, items])=>{
                  const isQueue = items.length>1
                  const total = items.reduce((s,o)=>s+o.amount,0)
                  const sid = items[0].queueSessionId
                  return (
                    <div key={key} className="bg-surface border border-blue-400/20 rounded-2xl p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          {isQueue
                            ? <div className="font-display font-semibold text-sm">📋 Queue of {items.length} files{items[0].orderNumber?<span className="text-muted font-normal"> · starts #{items[0].orderNumber}</span>:null}</div>
                            : <div className="font-display font-semibold text-sm truncate max-w-[220px]">{items[0].orderNumber?`#${items[0].orderNumber} · `:''}{items[0].fileName}</div>
                          }
                          <div className="text-xs text-muted mt-0.5">
                            {isQueue
                              ? items.map(o=>`${o.printType==='COLOR'?'🎨':'⬛'} ${o.fileName.slice(0,20)}`).join(' → ')
                              : `${items[0].printType==='COLOR'?'🎨 Color':'⬛ B&W'} · ${items[0].copies} copy${items[0].copies>1?'s':''} ${items[0].doubleSided?'· Double-sided':''}`
                            }
                          </div>
                          {items[0].customerPhone&&<div className="text-xs text-muted mt-0.5">📞 {items[0].customerPhone}</div>}
                          <div className="text-xs text-muted mt-0.5">Claimed {new Date(items[0].customerClaimedPaidAt).toLocaleTimeString('en-IN')}</div>
                        </div>
                        <div className="font-display font-bold text-accent text-lg shrink-0">₹{total}</div>
                      </div>

                      {isQueue&&(
                        <div className="space-y-1">
                          {items.map((o,i)=>(
                            <div key={o.id} className="flex justify-between text-xs bg-ink rounded-lg px-3 py-2">
                              <span className="text-muted">{i+1}. {o.fileName}</span>
                              <span>{o.printType==='COLOR'?'🎨':'⬛'} {o.copies}× ₹{o.amount}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button onClick={()=>isQueue?confirmSession(sid):confirmOrder(items[0].id)}
                          className="flex-1 bg-green-500 text-white font-display font-semibold py-2.5 rounded-xl text-sm hover:bg-green-600 transition-colors">
                          ✅ Confirm — Start Print
                        </button>
                        <button onClick={()=>isQueue?rejectSession(sid):rejectOrder(items[0].id)}
                          className="flex-1 border border-red-400/30 text-red-400 font-display font-semibold py-2.5 rounded-xl text-sm hover:bg-red-400/10 transition-colors">
                          ❌ Not Received
                        </button>
                      </div>
                      <p className="text-xs text-muted text-center">Check your UPI app before confirming</p>
                    </div>
                  )
                })
            }
          </div>
        )}

        {/* PRINTERS */}
        {tab==='printers'&&(
          <div className="fade-up space-y-3">
            <p className="text-muted text-sm">Printers auto-detected by PC Agent. Assign roles and set defaults.</p>
            {printers.length===0
              ? <div className="text-center text-muted py-12 bg-surface border border-white/8 rounded-2xl">
                  No printers yet. Run the PC Agent (🖥 Agent tab) — printers appear within 10 seconds.
                </div>
              : printers.map(p=>(
                <div key={p.id} className="bg-surface border border-white/8 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-display font-semibold text-sm">{p.name}</div>
                      <div className={`text-xs mt-0.5 ${p.isOnline?'text-green-400':'text-red-400'}`}>{p.isOnline?'● Online':'● Offline'}</div>
                    </div>
                    {p.isDefault&&<span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded-full font-semibold">Default</span>}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {['BW','COLOR','BOTH'].map(t=>(
                      <button key={t} onClick={()=>updatePrinter(p.id,{type:t})}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${p.type===t?'border-accent bg-accent/10 text-accent':'border-white/10 text-muted hover:border-white/25'}`}>
                        {t==='BW'?'⬛ B&W only':t==='COLOR'?'🎨 Color only':'🔁 Both'}
                      </button>
                    ))}
                    <button onClick={()=>updatePrinter(p.id,{isDefault:true,type:p.type})}
                      className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-muted hover:border-white/25 transition-colors">
                      ⭐ Set Default
                    </button>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* QR CODE */}
        {tab==='qr'&&(
          <div className="fade-up flex flex-col items-center gap-6">
            <p className="text-muted text-sm text-center max-w-sm">Print this QR and stick it in your shop. Customers scan to upload and pay.</p>

            <div className="bg-paper rounded-[2rem] p-8 shadow-2xl border border-black/5 flex flex-col items-center w-full max-w-xs">
              <div className="font-display font-bold text-base tracking-tight text-ink">
                Scan<span className="text-accent">NPrint</span>
              </div>
              <div className="text-ink/60 text-xs font-medium mt-1 mb-5">Scan to Print Documents</div>

              <div ref={qrRef} className="bg-white rounded-2xl p-6 border border-black/5">
                <QRCodeSVG value={shopUrl} size={200} bgColor="#FFFFFF" fgColor="#0A0A0F" level="H"/>
              </div>
              <div className="text-ink/40 text-[11px] mt-3">Scan to upload documents instantly.</div>

              <div className="font-display font-bold text-ink text-lg text-center mt-5">{shop?.name}</div>
              <div className="text-ink/60 text-xs font-medium mt-0.5 mb-4">Upload • Pay • Auto Print</div>

              <div className="text-ink/40 text-[11px] text-center border-t border-black/10 pt-3 w-full">
                <div>Scan to print</div>
                <div className="font-medium text-ink/60 mt-0.5">{shopDomainDisplay}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 justify-center">
              <button onClick={downloadQR} className="bg-accent text-white font-display font-semibold px-6 py-2.5 rounded-xl hover:bg-orange-600 transition-all text-sm">
                ⬇ Download QR (PNG)
              </button>
              <button onClick={downloadPoster} className="bg-white/10 text-paper font-display font-semibold px-6 py-2.5 rounded-xl border border-white/10 hover:bg-white/15 transition-all text-sm">
                🖼 Download Printable Poster
              </button>
              <button onClick={()=>copy(shopUrl,'link')} className="border border-white/15 text-paper px-6 py-2.5 rounded-xl hover:bg-white/5 hover:border-white/25 transition-all text-sm flex items-center gap-1.5">
                {copied==='link' ? '✓ Copied!' : (<>🔗 Copy Link</>)}
              </button>
            </div>
          </div>
        )}

        {/* PC AGENT */}
        {tab==='agent'&&agentInfo&&(
          <div className="fade-up space-y-4">
            <div>
              <h2 className="font-display font-bold text-xl">PC Agent Setup</h2>
              <p className="text-muted text-sm mt-1">Run on shop computer — auto-discovers printers, prints jobs automatically.</p>
            </div>

            <div className="bg-surface border border-white/8 rounded-2xl p-4 space-y-3">
              <div className="font-display font-semibold text-sm">Step 1 — Download</div>
              <a href={`${api.defaults.baseURL}/shop/agent-download`}
                className="flex items-center justify-between bg-ink rounded-xl p-3 hover:bg-white/5 transition-colors">
                <span className="text-sm text-paper">⬇ Download Windows Agent</span>
                <span className="text-xs text-muted">.zip</span>
              </a>
              <p className="text-xs text-muted">
                Contains the PC Agent, requirements.txt, configuration template (config.env)
                and installation guide. Python 3.10 or later is required.
              </p>
            </div>

            <div className="bg-surface border border-white/8 rounded-2xl p-4 space-y-3">
              <div className="font-display font-semibold text-sm">Step 2 — config.env</div>

              {!agentInfo.configured && !freshCred && (
                <>
                  <p className="text-xs text-muted">No agent credentials yet. Generate them once — the secret is shown only this one time, so download it now.</p>
                  <button onClick={generateAgentSecret} disabled={agentBusy}
                    className="w-full bg-accent text-white font-display font-semibold py-2.5 rounded-xl hover:bg-orange-600 transition-all text-sm disabled:opacity-50">
                    {agentBusy?'Generating...':'Generate Agent Credentials'}
                  </button>
                </>
              )}

              {freshCred && (
                <div className="space-y-2">
                  <div className="bg-green-400/10 border border-green-400/20 rounded-xl p-3 text-xs text-green-400">
                    ✓ config.env downloaded. This is the only time the secret is shown — copy the file into your agent folder now.
                  </div>
                  {[
                    {label:'ScanNprint_SERVER',value:freshCred.serverUrl,key:'server'},
                    {label:'ScanNprint_SHOP_ID',value:freshCred.shopId,key:'shopid'},
                    {label:'ScanNprint_SECRET',value:freshCred.secret,key:'secret'},
                  ].map(item=>(
                    <div key={item.key} className="bg-ink rounded-xl p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-muted mb-0.5">{item.label}</div>
                        <div className="text-xs text-paper font-mono truncate">{item.value}</div>
                      </div>
                      <button onClick={()=>copy(item.value,item.key)}
                        className="text-xs text-accent border border-accent/30 px-2 py-1 rounded-lg hover:bg-accent/10 transition-colors shrink-0">
                        {copied===item.key?'✓':'Copy'}
                      </button>
                    </div>
                  ))}
                  <button onClick={()=>downloadConfigEnv(freshCred)}
                    className="w-full bg-ink border border-white/10 text-paper font-display font-semibold py-2 rounded-xl hover:bg-white/5 transition-all text-sm">
                    ⬇ Download config.env again
                  </button>
                </div>
              )}

              {agentInfo.configured && !freshCred && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-green-400 bg-green-400/10 rounded-xl px-3 py-2">
                    🔒 Agent credentials configured — the secret can't be shown again, only regenerated.
                  </div>
                  <button onClick={regenerateAgentSecret} disabled={agentBusy}
                    className="w-full bg-ink border border-red-400/30 text-red-400 font-display font-semibold py-2.5 rounded-xl hover:bg-red-400/10 transition-all text-sm disabled:opacity-50">
                    {agentBusy?'Regenerating...':'⟳ Regenerate Secret'}
                  </button>
                  <p className="text-[10px] text-muted">Use this if you're moving to a new PC, or think your config.env may have leaked. It disconnects the old PC immediately.</p>
                </div>
              )}
            </div>

            <div className="bg-surface border border-white/8 rounded-2xl p-4 space-y-2">
              <div className="font-display font-semibold text-sm">Step 3 — Run the agent</div>
              <div className="bg-ink rounded-xl p-3 font-mono text-xs text-green-400 space-y-2">
                <div># Install required packages (first time only)</div>
                <div>pip install -r requirements.txt</div>

                <div className="pt-2"># Start the ScanNprint PC Agent</div>
                <div>python agent.py</div>
              </div>
              <p className="text-xs text-muted">
                Run <code>pip install -r requirements.txt</code> only once when setting up a new computer or after updating the PC Agent. Once installed, simply run <code>python agent.py</code> to start the agent. After it starts, go to the <strong>Printers</strong> tab to assign Color and B&W printers.
              </p>
            </div>

            <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-2xl p-4 text-xs text-yellow-400">
              ⚡ Keep agent running whenever shop is open. It polls every 5 seconds for new paid jobs.
            </div>
          </div>
        )}

        {/* ORDERS */}
        {tab==='orders'&&(
          <div className="fade-up space-y-3">
            {orders.length===0
              ? <div className="text-center text-muted py-12">No orders yet. Share your QR!</div>
              : orders.map(o=>(
                <div key={o.id} className="bg-surface border border-white/8 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-semibold text-sm truncate">{o.orderNumber?`#${o.orderNumber} · `:''}{o.fileName}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {o.printType==='COLOR'?'🎨':'⬛'} {o.copies} copy · ₹{o.amount}
                      {o.doubleSided?' · 2-sided':''}
                      {o.pageRange&&o.pageRange!=='all'?` · pg ${o.pageRange}`:''}
                      {o.queueSessionId?` · Queue #${o.queuePosition}`:''}
                      {o.customerPhone?` · 📞 ${o.customerPhone}`:''}
                      {' · '}{new Date(o.createdAt).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full w-fit ${STATUS_COLORS[o.status]}`}>
                    {STATUS_LABEL[o.status]}
                  </span>
                </div>
              ))
            }
          </div>
        )}
      </div>

      <footer className="max-w-3xl mx-auto px-4 py-6 flex flex-wrap items-center justify-center gap-4 text-xs text-muted border-t border-white/5">
        <a href={`mailto:${import.meta.env.VITE_SUPPORT_EMAIL || 'tech.support.dev@gmail.com'}`} className="hover:text-paper">✉ Support</a>
        <Link to="/privacy?returnTo=/dashboard" className="hover:text-paper">Privacy</Link>
        {shop && <Link to={`/shop/${shop.id}/policies`} className="hover:text-paper">My Policy Page</Link>}
        <Link to="/terms?returnTo=/dashboard" className="hover:text-paper">Terms</Link>
      </footer>
    </div>
  )
}