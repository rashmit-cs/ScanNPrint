import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api.js'

export default function SetupPage() {
  const nav = useNavigate()
  const [form, setForm] = useState({ colorPrice:10, bwPrice:2, upiId:'', isOpen:true })
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [rzp, setRzp] = useState({ keyId:'', keySecret:'', webhookSecret:'' })
  const [rzpConnected, setRzpConnected] = useState(false)
  const [rzpMasked, setRzpMasked] = useState('')
  const [rzpSaving, setRzpSaving] = useState(false)
  const [rzpError, setRzpError] = useState('')
  const [rzpSaved, setRzpSaved] = useState(false)

  // Danger Zone / delete account
  const [delPassword, setDelPassword] = useState('')
  const [delConfirmText, setDelConfirmText] = useState('')
  const [delError, setDelError] = useState('')
  const [delLoading, setDelLoading] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    api.get('/shop/me').then(({data}) => {
      setForm({ colorPrice:data.colorPrice, bwPrice:data.bwPrice, upiId:data.upiId||'', isOpen:data.isOpen })
      setRzpConnected(data.razorpayConnected)
      setRzpMasked(data.razorpayKeyMasked || '')
    }).catch(()=>nav('/login'))
  },[])

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))
  const setRzpField = k => e => setRzp(f=>({...f,[k]:e.target.value}))

  const save = async () => {
    setError(''); setLoading(true)
    try {
      await api.put('/shop/settings', form)
      setSaved(true)
      setTimeout(()=>nav('/dashboard'), 1200)
    } catch(e) { setError(e.response?.data?.error||'Failed to save') }
    finally { setLoading(false) }
  }

  const saveRazorpay = async () => {
    setRzpError(''); setRzpSaving(true)
    try {
      const { data } = await api.put('/shop/razorpay-settings', rzp)
      setRzpConnected(true)
      setRzpMasked(data.razorpayKeyMasked)
      setRzp({ keyId:'', keySecret:'', webhookSecret:'' })
      setRzpSaved(true)
      setTimeout(()=>setRzpSaved(false), 2500)
    } catch(e) { setRzpError(e.response?.data?.error||'Failed to save') }
    finally { setRzpSaving(false) }
  }

  const disconnectRazorpay = async () => {
    if (!confirm('Disconnect Razorpay? Customers will fall back to manual UPI payment until you reconnect.')) return
    await api.delete('/shop/razorpay-settings')
    setRzpConnected(false); setRzpMasked('')
  }

  const requestDelete = () => {
    setDelError('')
    if (!delPassword) { setDelError('Enter your password'); return }
    if (delConfirmText !== 'DELETE') { setDelError('Type DELETE (in capitals) to confirm'); return }
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    setDelError(''); setDelLoading(true)
    try {
      await api.post('/shop/delete-account', { password: delPassword, confirmText: delConfirmText })
      localStorage.removeItem('token')
      nav('/', { replace: true })
    } catch(e) {
      setShowDeleteModal(false)
      setDelError(e.response?.data?.error || 'Failed to delete account')
    } finally {
      setDelLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink px-4 py-10">
      <div className="max-w-lg mx-auto fade-up">
        <div className="flex items-center gap-3 mb-8">
          <Link to="/dashboard" className="text-muted hover:text-paper transition-colors text-sm">← Dashboard</Link>
          <div>
            <h1 className="font-display font-bold text-2xl">Shop Settings</h1>
            <p className="text-muted text-sm">Configure pricing, UPI, and printer setup.</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* UPI ID */}
          <div className="bg-surface border border-white/8 rounded-2xl p-5">
            <h2 className="font-display font-semibold text-sm text-muted uppercase tracking-wider mb-1">Your UPI ID</h2>
            <p className="text-xs text-muted mb-3">
              Customer payments go <span className="text-accent font-semibold">directly to this UPI</span>. ScanNprint never touches this money.
            </p>
            <input type="text" placeholder="yourname@paytm / yourname@ybl / 9XXXXXXXXX@upi"
              value={form.upiId} onChange={set('upiId')}
              className="w-full bg-ink border border-white/10 rounded-xl px-4 py-3 text-paper text-sm placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-colors font-mono"/>
            {!form.upiId && <p className="text-xs text-yellow-400 mt-2">⚠️ Without UPI, customers will be told to pay in cash.</p>}
          </div>

          {/* Razorpay — per-shop, so print payments go straight to YOUR account */}
          <div className="bg-surface border border-white/8 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-display font-semibold text-sm text-muted uppercase tracking-wider">Online Payments (Razorpay)</h2>
              {rzpConnected && <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full font-semibold">● Connected</span>}
            </div>
            <p className="text-xs text-muted mb-3">
              Connect your own Razorpay account so customers can pay online instantly. Money settles <span className="text-accent font-semibold">directly to your account</span> — ScanNprint never sees or touches it.
            </p>

            {rzpConnected ? (
              <div className="bg-ink rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="text-xs font-mono text-paper">{rzpMasked}</div>
                <button onClick={disconnectRazorpay} className="text-xs text-red-400 border border-red-400/30 px-3 py-1.5 rounded-lg hover:bg-red-400/10 transition-colors">Disconnect</button>
              </div>
            ) : (
              <div className="space-y-3">
                <details className="text-xs text-muted bg-ink rounded-xl p-3">
                  <summary className="cursor-pointer text-paper font-semibold">Where do I find these?</summary>
                  <ol className="mt-2 space-y-1 list-decimal list-inside">
                    <li>Sign up / log in at razorpay.com with your own bank details</li>
                    <li>Dashboard → Settings → API Keys → Generate Key (copy Key ID and Key Secret)</li>
                    <li>Dashboard → Settings → Webhooks → Add New Webhook → URL: <code className="text-accent break-all">{(import.meta.env.VITE_API_URL||'https://your-server.com/api').replace(/\/api$/,'')}/api/print-payment/webhook</code> → Active events: <code className="text-accent">payment.captured</code> → copy the Webhook Secret shown</li>
                  </ol>
                </details>
                <input type="text" placeholder="Key ID (rzp_live_... or rzp_test_...)"
                  value={rzp.keyId} onChange={setRzpField('keyId')}
                  className="w-full bg-ink border border-white/10 rounded-xl px-4 py-3 text-paper text-sm placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-colors font-mono"/>
                <input type="password" placeholder="Key Secret"
                  value={rzp.keySecret} onChange={setRzpField('keySecret')}
                  className="w-full bg-ink border border-white/10 rounded-xl px-4 py-3 text-paper text-sm placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-colors font-mono"/>
                <input type="password" placeholder="Webhook Secret"
                  value={rzp.webhookSecret} onChange={setRzpField('webhookSecret')}
                  className="w-full bg-ink border border-white/10 rounded-xl px-4 py-3 text-paper text-sm placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-colors font-mono"/>
                {rzpError && <p className="text-red-400 text-xs bg-red-400/10 rounded-lg px-3 py-2">{rzpError}</p>}
                {rzpSaved && <p className="text-green-400 text-xs">✓ Connected</p>}
                <button onClick={saveRazorpay} disabled={rzpSaving || !rzp.keyId || !rzp.keySecret || !rzp.webhookSecret}
                  className="w-full bg-accent/90 text-white font-display font-semibold py-2.5 rounded-xl hover:bg-accent transition-all text-sm disabled:opacity-40">
                  {rzpSaving?'Connecting...':'Connect Razorpay'}
                </button>
                <p className="text-[10px] text-muted">Haven't set this up yet? No problem — customers can still pay you directly via the UPI ID above until you connect Razorpay.</p>
              </div>
            )}
          </div>

          {/* Pricing */}
          <div className="bg-surface border border-white/8 rounded-2xl p-5">
            <h2 className="font-display font-semibold text-sm text-muted uppercase tracking-wider mb-4">Print Pricing (per page)</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted block mb-1.5">🎨 Color Print (₹)</label>
                <input type="number" min="1" value={form.colorPrice} onChange={set('colorPrice')}
                  className="w-full bg-ink border border-white/10 rounded-xl px-4 py-3 text-paper text-sm focus:outline-none focus:border-accent/50 transition-colors"/>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1.5">⬛ B&W Print (₹)</label>
                <input type="number" min="1" value={form.bwPrice} onChange={set('bwPrice')}
                  className="w-full bg-ink border border-white/10 rounded-xl px-4 py-3 text-paper text-sm focus:outline-none focus:border-accent/50 transition-colors"/>
              </div>
            </div>
          </div>

          {/* Open/Closed */}
          <div className="bg-surface border border-white/8 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="font-display font-semibold text-sm">Shop Status</div>
              <div className="text-xs text-muted mt-0.5">Customers can {form.isOpen?'':'NOT '}place orders right now</div>
            </div>
            <button onClick={()=>setForm(f=>({...f,isOpen:!f.isOpen}))}
              className={`relative w-12 h-6 rounded-full transition-colors ${form.isOpen?'bg-accent':'bg-white/10'}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.isOpen?'left-7':'left-1'}`}/>
            </button>
          </div>

          {/* Printer info */}
          <div className="bg-blue-400/10 border border-blue-400/20 rounded-2xl p-4 text-xs text-blue-300">
            🖨️ <strong>Printers are auto-detected</strong> — run the PC Agent (Dashboard → 🖥 Agent tab) and all your printers appear automatically. Assign Color/B&W roles from there.
          </div>

          {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}

          {saved
            ? <div className="text-center py-4 text-green-400 font-display font-semibold">✓ Saved! Going to dashboard...</div>
            : <button onClick={save} disabled={loading}
                className="w-full bg-accent text-white font-display font-bold py-3.5 rounded-xl hover:bg-orange-600 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50">
                {loading?'Saving...':'Save Settings ✓'}
              </button>
          }

          {/* Danger Zone */}
          <div className="bg-red-950/20 border border-red-500/20 rounded-2xl p-5 mt-2">
            <h2 className="font-display font-semibold text-sm text-red-400 uppercase tracking-wider mb-1">Danger Zone</h2>
            <p className="text-xs text-muted mb-4">
              This permanently deletes your ScanNprint account — your login, saved settings, connected Razorpay account, and PC Agent credentials. This cannot be undone.
            </p>

            <div className="space-y-3">
              <input type="password" placeholder="Your password"
                value={delPassword} onChange={e=>setDelPassword(e.target.value)}
                className="w-full bg-ink border border-white/10 rounded-xl px-4 py-3 text-paper text-sm placeholder:text-white/20 focus:outline-none focus:border-red-400/50 transition-colors"/>
              <input type="text" placeholder='Type "DELETE" to confirm'
                value={delConfirmText} onChange={e=>setDelConfirmText(e.target.value)}
                className="w-full bg-ink border border-white/10 rounded-xl px-4 py-3 text-paper text-sm placeholder:text-white/20 focus:outline-none focus:border-red-400/50 transition-colors font-mono"/>

              {delError && <p className="text-red-400 text-xs bg-red-400/10 rounded-lg px-3 py-2">{delError}</p>}

              <button onClick={requestDelete}
                disabled={!delPassword || delConfirmText !== 'DELETE'}
                className="w-full bg-red-500/10 border border-red-500/40 text-red-400 font-display font-semibold py-3 rounded-xl hover:bg-red-500/20 transition-colors text-sm disabled:opacity-40">
                Delete My Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center px-4 z-50">
          <div className="bg-surface border border-red-500/30 rounded-2xl p-6 max-w-sm w-full fade-up">
            <h3 className="font-display font-bold text-lg text-paper mb-2">Delete Account?</h3>
            <p className="text-sm text-muted mb-1">This action cannot be undone.</p>
            <p className="text-sm text-muted mb-5">
              Your account, saved settings, connected Razorpay account, and agent credentials will be removed.
            </p>
            <div className="flex gap-3">
              <button onClick={()=>setShowDeleteModal(false)} disabled={delLoading}
                className="flex-1 bg-white/5 border border-white/10 text-paper font-display font-semibold py-2.5 rounded-xl hover:bg-white/10 transition-colors text-sm disabled:opacity-40">
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={delLoading}
                className="flex-1 bg-red-500 text-white font-display font-semibold py-2.5 rounded-xl hover:bg-red-600 transition-colors text-sm disabled:opacity-40">
                {delLoading ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}