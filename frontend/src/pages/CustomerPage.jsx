import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../api.js'

const ALLOWED = '.pdf,.doc,.docx,.jpg,.jpeg,.png'

function FileRow({ file, opts, onChange, onRemove, index, bwPrice, colorPrice }) {
  return (
    <div className="bg-ink border border-white/10 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-display font-semibold text-sm truncate">{file.name}</div>
          <div className="text-xs text-muted">{(file.size/1024).toFixed(0)} KB</div>
        </div>
        <button onClick={() => onRemove(index)} className="text-muted hover:text-red-400 transition-colors text-lg shrink-0">✕</button>
      </div>

      {/* Print type */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { val:'BW', label:'⬛ B&W', price: bwPrice },
          { val:'COLOR', label:'🎨 Color', price: colorPrice }
        ].map(opt => (
          <button key={opt.val} onClick={() => onChange(index,'printType',opt.val)}
            className={`p-2.5 rounded-xl border text-left transition-all ${opts.printType===opt.val?'border-accent bg-accent/10':'border-white/10 hover:border-white/25'}`}>
            <div className="text-xs font-display font-semibold">{opt.label}</div>
            <div className="text-[10px] text-muted">₹{opt.price}/page</div>
          </button>
        ))}
      </div>

      {/* Copies */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted w-12">Copies</span>
        <button onClick={() => onChange(index,'copies',Math.max(1,opts.copies-1))} className="w-8 h-8 rounded-lg bg-surface border border-white/10 text-sm hover:border-white/25">−</button>
        <span className="font-display font-bold w-6 text-center">{opts.copies}</span>
        <button onClick={() => onChange(index,'copies',Math.min(50,opts.copies+1))} className="w-8 h-8 rounded-lg bg-surface border border-white/10 text-sm hover:border-white/25">+</button>
      </div>

      {/* Double sided */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={opts.doubleSided} onChange={e=>onChange(index,'doubleSided',e.target.checked)} className="accent-accent w-4 h-4"/>
        <span className="text-xs text-muted">Double-sided print</span>
      </label>

      {/* Page range — only for documents (PDF/DOC), not images */}
      {!opts.isImage && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted w-20 shrink-0">Page range</span>
          <input type="text" placeholder="all / 1-5 / 2,4,6"
            value={opts.pageRange}
            onChange={e=>onChange(index,'pageRange',e.target.value)}
            className="flex-1 bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-xs text-paper placeholder:text-white/20 focus:outline-none focus:border-accent/50"/>
        </div>
      )}

      {/* Photo Layout is now chosen globally below the file list, not per-card */}

      <div className="text-right text-xs text-accent font-display font-bold">
        Est. ₹{(opts.printType==='COLOR'?colorPrice:bwPrice) * opts.copies} (before page count)
      </div>
    </div>
  )
}

export default function CustomerPage() {
  const { shopId } = useParams()
  const nav = useNavigate()

  const [shop, setShop] = useState(null)
  const [shopError, setShopError] = useState('')
  const [files, setFiles] = useState([])
  const [fileOpts, setFileOpts] = useState([])
  const [phone, setPhone] = useState('')
  const [step, setStep] = useState('upload') // upload | pay | claiming
  const [result, setResult] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [photoLayout, setPhotoLayout] = useState(1) // global Photo Layout selection, applies to all image files
  const fileRef = useRef()

  useEffect(() => {
    const fetchShop = () => {
      api.get(`/shop/${shopId}/public`)
        .then(({ data }) => { setShop(data); setShopError('') })
        .catch(() => setShopError('Shop not found or invalid link.'))
    }
    fetchShop()
    // Re-check shop status periodically — a customer may already be sitting on this
    // page (mid-upload or mid-payment) when the shopkeeper toggles Open/Closed, and
    // we need that reflected without requiring a manual refresh.
    const iv = setInterval(fetchShop, 15000)
    return () => clearInterval(iv)
  }, [shopId])

  const addFiles = e => {
    const newFiles = Array.from(e.target.files)
    setFiles(f => [...f, ...newFiles])
    setFileOpts(o => [...o, ...newFiles.map(f => ({
      printType:'BW', copies:1, doubleSided:false, pageRange:'all',
      isImage: f.type.startsWith('image/'), imagesPerPage: photoLayout
    }))])
    fileRef.current.value = ''
  }

  const removeFile = i => {
    setFiles(f => f.filter((_,idx)=>idx!==i))
    setFileOpts(o => o.filter((_,idx)=>idx!==i))
  }

  const updateOpt = (i, key, val) => {
    setFileOpts(o => o.map((opt,idx) => idx===i ? {...opt,[key]:val} : opt))
  }

  // Applies the single global Photo Layout choice to every uploaded image file.
  // Backend still receives imagesPerPage per-file exactly as before — this just
  // keeps them all in sync from one control instead of one control per card.
  const setGlobalPhotoLayout = (n) => {
    setPhotoLayout(n)
    setFileOpts(o => o.map(opt => opt.isImage ? {...opt, imagesPerPage:n} : opt))
  }

  const totalEstimate = () => {
    if (!shop) return 0
    return fileOpts.reduce((sum,o,i) => {
      const price = o.printType==='COLOR' ? shop.colorPrice : shop.bwPrice
      return sum + price * o.copies
    }, 0)
  }

  const uploadAll = async () => {
    if (!files.length) { setError('Add at least one file'); return }
    if (!agreed) { setError('Please confirm you have the right to print these file(s) first'); return }
    setError(''); setUploading(true)
    try {
      const fd = new FormData()
      files.forEach(f => fd.append('files', f))
      fileOpts.forEach((o,i) => {
        fd.append('printType', o.printType)
        fd.append('copies', o.copies)
        fd.append('doubleSided', o.doubleSided)
        fd.append('pageRange', o.pageRange)
        fd.append('imagesPerPage', o.imagesPerPage || 1)
      })
      fd.append('customerPhone', phone)
      fd.append('agreed', agreed ? 'true' : 'false')
      const { data } = await api.post(`/order/upload/${shopId}`, fd)
      setResult(data)
      setStep('pay')
    } catch(e) {
      setError(e.response?.data?.error || 'Upload failed. Try again.')
    } finally { setUploading(false) }
  }


  const payOnline = async () => {
    try {
      const isQueue = result.isQueue && result.queueSessionId
      const { data } = await api.post(
        isQueue ? '/print-payment/create-session-order' : '/print-payment/create-order',
        isQueue ? { sessionId: result.queueSessionId } : { orderId: result.orders[0].orderId }
      )

      const options = {
        key:         data.key,
        amount:      data.amountPaise,
        currency:    data.currency,
        name:        'PrintDrop',
        description: isQueue ? `Print Order (${result.orders.length} files)` : 'Print Order',
        order_id:    data.razorpayOrderId,

        handler: async function (response) {
          await api.post('/print-payment/verify', {
            orderId:               isQueue ? data.anchorOrderId : result.orders[0].orderId,
            razorpay_order_id:     response.razorpay_order_id,
            razorpay_payment_id:   response.razorpay_payment_id,
            razorpay_signature:    response.razorpay_signature,
          })
          if (result.queueSessionId) {
            nav(`/session/${result.queueSessionId}`)
          } else {
            nav(`/order/${result.orders[0].orderId}`)
          }
        },

        theme: { color: '#f97316' }
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      alert(err.response?.data?.message || err.response?.data?.error || 'Unable to start payment.')
    }
  }

  const claimPaid = async () => {
    setStep('claiming')
    try {
      await api.post('/order/claim-paid', {
        sessionId: result.queueSessionId || undefined,
        orderId: !result.queueSessionId ? result.orders[0]?.orderId : undefined
      })
      // Navigate to status — if queue, go to session status; else single order
      if (result.queueSessionId) {
        nav(`/session/${result.queueSessionId}`)
      } else {
        nav(`/order/${result.orders[0].orderId}`)
      }
    } catch(e) {
      setError(e.response?.data?.error || 'Error. Try again.')
      setStep('pay')
    }
  }

  if (shopError) return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="text-center"><div className="text-4xl mb-3">🔗</div><div className="text-muted">{shopError}</div></div>
    </div>
  )
  if (!shop) return <div className="min-h-screen bg-ink flex items-center justify-center"><div className="text-muted text-sm">Loading...</div></div>

  if (shop.serviceSuspended) return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <div className="font-display font-bold text-xl mb-2">{shop.name}</div>
        <div className="text-muted">Service temporarily unavailable. Pay shopkeeper directly.</div>
      </div>
    </div>
  )

  if (!shop.isOpen) {
    const formatTime = (hhmm) => {
      if (!hhmm) return ''
      const [h, m] = hhmm.split(':').map(Number)
      const period = h >= 12 ? 'PM' : 'AM'
      const h12 = h % 12 === 0 ? 12 : h % 12
      return `${h12}:${String(m).padStart(2,'0')} ${period}`
    }
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🔴</div>
          <div className="font-display font-bold text-xl mb-2">{shop.name}</div>
          <div className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-red-400/10 text-red-400 mb-4">Shop Closed</div>
          <div className="text-paper text-sm mb-5">This print shop is currently unavailable.</div>

          {(shop.openingTime && shop.closingTime) && (
            <div className="bg-surface border border-white/8 rounded-2xl px-4 py-3 mb-4 inline-block">
              <div className="text-xs text-muted mb-1">🕘 Today's Business Hours</div>
              <div className="font-display font-semibold text-paper text-sm">
                {formatTime(shop.openingTime)} – {formatTime(shop.closingTime)}
              </div>
            </div>
          )}

          <div className="text-muted text-sm mb-1">Please visit during business hours.</div>
          <div className="text-muted text-xs">If you need assistance, please contact the respective shopkeeper directly.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ink flex flex-col">
      {/* Header */}
      <div className="bg-surface border-b border-white/5 px-5 py-4 flex items-center gap-3">
        <div className="w-9 h-9 bg-accent/20 rounded-xl flex items-center justify-center text-accent font-display font-bold text-sm">{shop.name[0]}</div>
        <div>
          <div className="font-display font-semibold text-sm">{shop.name}</div>
          <div className="text-xs text-green-400">● Open</div>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full">

        {/* UPLOAD STEP */}
        {step === 'upload' && (
          <div className="fade-up space-y-5">
            <div>
              <h1 className="font-display font-bold text-2xl">Print Documents</h1>
              <p className="text-muted text-sm mt-1">Add one or multiple files — they'll all print back-to-back.</p>
            </div>

            {/* File rows */}
            {files.map((file, i) => (
              <FileRow key={i} file={file} opts={fileOpts[i]} onChange={updateOpt} onRemove={removeFile} index={i}
                bwPrice={shop.bwPrice} colorPrice={shop.colorPrice} />
            ))}

            {/* Global Photo Layout — shown once, only if at least one image file is uploaded */}
            {fileOpts.some(o => o.isImage) && (
              <div className="bg-ink border border-white/10 rounded-2xl p-4 space-y-1.5">
                <span className="text-xs text-muted">Photo Layout <span className="text-white/25">(applies to all photos)</span></span>
                <div className="grid grid-cols-4 gap-2">
                  {[1,2,4,6].map(n => (
                    <button key={n} onClick={() => setGlobalPhotoLayout(n)}
                      className={`p-2 rounded-lg border text-xs font-display font-semibold transition-all ${photoLayout===n?'border-accent bg-accent/10 text-accent':'border-white/10 text-muted hover:border-white/25'}`}>
                      {n} {n===1?'Photo/Page':'Photos/Page'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Add file button */}
            <div onClick={() => fileRef.current.click()}
              className="border-2 border-dashed border-white/15 rounded-2xl p-6 text-center cursor-pointer hover:border-white/30 transition-all">
              <div className="text-2xl mb-1">📎</div>
              <div className="text-sm text-muted">{files.length ? 'Add another file' : 'Tap to select file(s)'}</div>
              <div className="text-xs text-white/25 mt-1">PDF, DOCX, JPG, PNG · Max 20MB each</div>
              <input ref={fileRef} type="file" accept={ALLOWED} multiple onChange={addFiles} className="hidden" />
            </div>

            {/* Phone */}
            <div>
              <label className="text-xs text-muted block mb-1.5">Your Phone (optional)</label>
              <input type="tel" placeholder="9876543210" value={phone} onChange={e=>setPhone(e.target.value)}
                className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-paper text-sm placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-colors"/>
            </div>

            {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-orange-500 shrink-0"/>
              <span className="text-xs text-muted leading-relaxed">
                I confirm I have the right to print these file(s), and agree to the{' '}
                <Link to={`/terms?returnTo=${encodeURIComponent(`/shop/${shopId}`)}`} target="_blank" className="text-accent hover:underline">Terms</Link>
                {' '}&{' '}
                <Link to={`/privacy?returnTo=${encodeURIComponent(`/shop/${shopId}`)}`} target="_blank" className="text-accent hover:underline">Privacy Policy</Link>.
              </span>
            </label>

            <button onClick={uploadAll} disabled={uploading||!files.length||!agreed}
              className="w-full bg-accent text-white font-display font-bold py-4 rounded-2xl text-lg hover:bg-orange-600 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-40 disabled:scale-100">
              {uploading ? 'Uploading...' : `Continue → Est. ₹${totalEstimate().toFixed(0)}`}
            </button>
          </div>
        )}

        {/* PAY STEP */}
        {step === 'pay' && result && (
          <div className="fade-up space-y-5">
            <div>
              <h1 className="font-display font-bold text-2xl">Pay {shop.name}</h1>
              <p className="text-muted text-sm mt-1">Payment goes directly to the shop's UPI.</p>
            </div>

            {/* Order summary */}
            <div className="bg-surface border border-white/8 rounded-2xl p-4 space-y-2">
              {result.orders.map((o,i) => (
                <div key={o.orderId} className="flex justify-between text-sm">
                  <span className="text-muted truncate max-w-[60%]">{i+1}. {o.fileName}</span>
                  <span className="text-paper">{o.printType==='COLOR'?'🎨':'⬛'} {o.copies}× ₹{o.amount}</span>
                </div>
              ))}
              <div className="border-t border-white/8 pt-2 flex justify-between font-display font-bold">
                <span>Total</span>
                <span className="text-accent text-lg">₹{result.totalAmount}</span>
              </div>
            </div>

            {result.isQueue && (
              <div className="bg-blue-400/10 border border-blue-400/20 rounded-xl px-4 py-3 text-blue-300 text-xs">
                📋 {result.orders.length} files in queue — all will print back-to-back automatically after payment confirmation.
              </div>
            )}

            {shop.upiId ? (
              <>
              <button onClick={payOnline}
                className="w-full bg-accent text-white font-display font-bold py-4 rounded-2xl text-lg hover:bg-orange-600 transition-all hover:scale-[1.01] active:scale-95">
                ⚡ Pay Online ₹{result.totalAmount}
              </button>
                <p className="text-xs text-muted text-center">UPI ID: <span className="text-paper font-mono">{shop.upiId}</span></p>
              </>
            ) : (
              <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-2xl p-4 text-yellow-400 text-sm text-center">
                ⚠️ Shop hasn't set up UPI yet. Pay the shopkeeper in cash directly.
              </div>
            )}

            {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}

            <button onClick={claimPaid}
              className="w-full border-2 border-accent text-accent font-display font-bold py-4 rounded-2xl text-lg hover:bg-accent/10 transition-all">
              ✅ I've Paid — Notify Shop
            </button>

            <p className="text-xs text-muted text-center">Shopkeeper confirms → printer starts automatically.</p>
            <button onClick={() => setStep('upload')} className="w-full text-muted text-sm hover:text-paper transition-colors">← Go back</button>
          </div>
        )}

        {/* CLAIMING */}
        {step === 'claiming' && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin"/>
            <div className="text-muted text-sm">Notifying shop...</div>
          </div>
        )}
      </div>
    </div>
  )
}