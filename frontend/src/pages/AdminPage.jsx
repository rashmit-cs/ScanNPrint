import React, { useState, useEffect } from 'react'
import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || '/api'

const STATUS_COLORS = {
  NONE:'text-muted bg-white/5', TRIAL:'text-blue-400 bg-blue-400/10',
  PENDING_PAYMENT:'text-yellow-400 bg-yellow-400/10',
  ACTIVE:'text-green-400 bg-green-400/10', EXPIRED:'text-red-400 bg-red-400/10',
}

export default function AdminPage() {
  const [key, setKey] = useState('')
  const [authed, setAuthed] = useState(false)
  const [shops, setShops] = useState([])
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [announcement, setAnnouncement] = useState('')
  const [announcementSaving, setAnnouncementSaving] = useState(false)

  const load = async () => {
    try {
      const { data } = await axios.get(`${BASE}/admin/shops`, { withCredentials: true })
      setShops(data); setAuthed(true); setError('')
    } catch { setAuthed(false); return }
    try {
      const { data } = await axios.get(`${BASE}/admin/announcement`, { withCredentials: true })
      setAnnouncement(data.message || '')
    } catch { /* non-critical, leave announcement as-is */ }
  }

  const saveAnnouncement = async () => {
    setAnnouncementSaving(true)
    try {
      await axios.post(`${BASE}/admin/announcement`, { message: announcement }, { withCredentials: true })
    } catch(e) { alert(e.response?.data?.error || 'Failed to save announcement') }
    setAnnouncementSaving(false)
  }

  const login = async (k) => {
    try {
      await axios.post(`${BASE}/admin/login`, { key: k }, { withCredentials: true })
      await load()
    } catch { setError('Invalid admin password'); setAuthed(false) }
  }

  useEffect(() => { load() }, []) // if a session cookie already exists, this logs back in silently

  const act = async (id, action, body={}) => {
    try {
      await axios.post(`${BASE}/admin/shops/${id}/${action}`, body, { withCredentials: true })
      load()
    } catch(e) { alert(e.response?.data?.error || 'Action failed') }
  }

  const filtered = shops.filter(s => {
    if (filter === 'pending') return s.subscriptionStatus === 'PENDING_PAYMENT'
    if (filter === 'active')  return s.subscriptionStatus === 'ACTIVE' || s.subscriptionStatus === 'TRIAL'
    if (filter === 'expired') return s.subscriptionStatus === 'EXPIRED'
    return true
  })

  if (!authed) return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-xs fade-up text-center">
        <div className="font-display font-bold text-2xl mb-1">Print<span className="text-accent">Drop</span></div>
        <p className="text-muted text-sm mb-6">Admin Panel</p>
        <input type="password" placeholder="Admin password" value={key}
          onChange={e=>setKey(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&login(key)}
          className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-paper text-sm mb-3 focus:outline-none focus:border-accent/50"/>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button onClick={()=>login(key)}
          className="w-full bg-accent text-white font-display font-semibold py-3 rounded-xl hover:bg-orange-600 transition-all">
          Login
        </button>
      </div>
    </div>
  )

  const pendingCount = shops.filter(s=>s.subscriptionStatus==='PENDING_PAYMENT').length

  return (
    <div className="min-h-screen bg-ink px-4 py-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl">ScanNprint Admin</h1>
            <p className="text-muted text-sm">{shops.length} total shops</p>
          </div>
          <button onClick={()=>load()} className="text-xs border border-white/10 text-muted px-3 py-1.5 rounded-lg hover:text-paper transition-colors">
            🔄 Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label:'Total', val: shops.length, color:'text-paper' },
            { label:'Active/Trial', val: shops.filter(s=>['ACTIVE','TRIAL'].includes(s.subscriptionStatus)).length, color:'text-green-400' },
            { label:'Pending Pay', val: pendingCount, color:'text-yellow-400' },
            { label:'Expired', val: shops.filter(s=>s.subscriptionStatus==='EXPIRED').length, color:'text-red-400' },
          ].map(s=>(
            <div key={s.label} className="bg-surface border border-white/8 rounded-xl p-3 text-center">
              <div className={`font-display font-bold text-xl ${s.color}`}>{s.val}</div>
              <div className="text-xs text-muted">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Announcement banner editor */}
        <div className="bg-surface border border-white/8 rounded-2xl p-4 mb-6">
          <div className="font-display font-semibold text-sm mb-2">Shop Announcement Banner</div>
          <p className="text-xs text-muted mb-3">Shown to shopkeepers on their dashboard. Leave blank to hide it for everyone.</p>
          <textarea
            value={announcement}
            onChange={e=>setAnnouncement(e.target.value)}
            rows={3}
            placeholder="e.g. Scheduled maintenance tonight 11pm–1am, printing may be briefly unavailable."
            className="w-full bg-ink border border-white/10 rounded-xl px-3 py-2 text-paper text-sm mb-3 focus:outline-none focus:border-accent/50 resize-none"
          />
          <div className="flex gap-2">
            <button onClick={saveAnnouncement} disabled={announcementSaving}
              className="text-xs bg-accent text-white px-3 py-2 rounded-lg hover:bg-orange-600 transition-colors font-semibold disabled:opacity-50">
              {announcementSaving ? 'Saving…' : 'Save Announcement'}
            </button>
            {announcement && (
              <button onClick={()=>setAnnouncement('')}
                className="text-xs border border-white/10 text-muted px-3 py-2 rounded-lg hover:text-paper transition-colors">
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-surface rounded-xl p-1 mb-4 w-fit">
          {[['all','All'],['pending','Needs Approval'],['active','Active'],['expired','Expired']].map(([val,label])=>(
            <button key={val} onClick={()=>setFilter(val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold transition-all ${filter===val?'bg-accent text-white':'text-muted hover:text-paper'}`}>
              {label}{val==='pending'&&pendingCount>0?` (${pendingCount})`:''}
            </button>
          ))}
        </div>

        {/* Shop list */}
        <div className="space-y-3">
          {filtered.map(s => {
            const expSoon = s.subscriptionEnd && new Date(s.subscriptionEnd)-Date.now() < 3*86400000
            const daysLeft = s.subscriptionEnd ? Math.ceil((new Date(s.subscriptionEnd)-Date.now())/86400000) : null
            return (
              <div key={s.id} className={`bg-surface border rounded-2xl p-4 ${s.subscriptionStatus==='PENDING_PAYMENT'?'border-yellow-400/30':'border-white/8'}`}>
                <div className="flex justify-between items-start flex-wrap gap-2 mb-3">
                  <div>
                    <div className="font-display font-semibold">{s.name} <span className="text-muted text-xs font-normal">({s.ownerName})</span></div>
                    <div className="text-xs text-muted mt-0.5">📧 {s.email} · 📞 {s.phone}</div>
                    <div className="text-xs text-muted mt-0.5">{s._count.orders} orders · joined {new Date(s.createdAt).toLocaleDateString('en-IN')}</div>
                    {s.upiId && <div className="text-xs text-muted mt-0.5">💳 UPI: <span className="font-mono text-paper">{s.upiId}</span></div>}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${s.emailVerified?'text-green-400 bg-green-400/10':'text-red-400 bg-red-400/10'}`}>
                      {s.emailVerified?'✓ Email':'✗ Email'}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${s.whatsappJoined?'text-green-400 bg-green-400/10':'text-red-400 bg-red-400/10'}`}>
                      {s.whatsappJoined?'✓ WA':'✗ WA'}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[s.subscriptionStatus]}`}>
                      {s.subscriptionStatus}{s.subscriptionPlan?` · ${s.subscriptionPlan}`:''}
                    </span>
                    {daysLeft!==null && (
                      <span className={`text-xs px-2 py-1 rounded-full ${expSoon?'text-yellow-400 bg-yellow-400/10':'text-muted bg-white/5'}`}>
                        {daysLeft>0?`${daysLeft}d left`:'Expired'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap">
                  {s.subscriptionStatus==='PENDING_PAYMENT' && (
                    <button onClick={()=>act(s.id,'approve')}
                      className="text-xs bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600 transition-colors font-semibold">
                      ✅ Approve Payment
                    </button>
                  )}
                  <button onClick={()=>act(s.id,'extend',{days:30})}
                    className="text-xs border border-white/10 text-paper px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
                    +30 days
                  </button>
                  <button onClick={()=>act(s.id,'extend',{days:90})}
                    className="text-xs border border-white/10 text-paper px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
                    +3 months
                  </button>
                  <button onClick={()=>act(s.id,'extend',{days:365})}
                    className="text-xs border border-white/10 text-paper px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
                    +1 year
                  </button>
                  {!s.emailVerified && (
                    <button onClick={()=>act(s.id,'verify-email')}
                      className="text-xs border border-blue-400/30 text-blue-400 px-3 py-2 rounded-lg hover:bg-blue-400/10 transition-colors">
                      Force verify email
                    </button>
                  )}
                  <button onClick={()=>{if(confirm('Suspend this shop?'))act(s.id,'suspend')}}
                    className="text-xs border border-red-400/30 text-red-400 px-3 py-2 rounded-lg hover:bg-red-400/10 transition-colors">
                    Suspend
                  </button>
                </div>
              </div>
            )
          })}
          {filtered.length===0 && <div className="text-center text-muted py-12">No shops in this filter.</div>}
        </div>
      </div>
    </div>
  )
}