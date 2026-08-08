import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api.js'

export default function SetupProgressCard() {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    if (!localStorage.getItem('token')) return
    api.get('/shop/status').then(({ data }) => setStatus(data)).catch(() => {})
  }, [])

  if (!status) return null

  const steps = [
    { label: 'Email Verified', done: status.emailVerified },
    { label: 'Subscription Active', done: status.subscriptionActive },
    { label: 'Razorpay Connected', done: status.razorpayConnected, to: '/setup' },
    { label: 'Printer Added', done: status.printerCount > 0, to: '/dashboard?tab=printers' },
    { label: 'PC Agent Running', done: status.agentOnline, to: '/dashboard?tab=agent' },
  ]
  const doneCount = steps.filter(s => s.done).length
  if (doneCount === steps.length) return null // fully set up — nothing to show

  const pct = Math.round((doneCount / steps.length) * 100)

  return (
    <div style={styles.card}>
      <div style={styles.title}>Welcome to ScanNPrint — let's finish setup</div>
      <div style={styles.barTrack}><div style={{ ...styles.barFill, width: `${pct}%` }} /></div>
      <div style={styles.pct}>{pct}% complete</div>
      <ul style={styles.list}>
        {steps.map(s => (
          <li key={s.label} style={styles.item}>
            <span>{s.done ? '✔' : '☐'} {s.label}</span>
            {!s.done && s.to && <Link to={s.to} style={styles.link}>Fix →</Link>}
          </li>
        ))}
      </ul>
    </div>
  )
}

const styles = {
  card: { background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 16, color: '#fff' },
  title: { fontWeight: 600, fontSize: 14, marginBottom: 10 },
  barTrack: { background: '#0f172a', borderRadius: 8, height: 8, overflow: 'hidden' },
  barFill: { background: '#f97316', height: '100%', transition: 'width 0.3s' },
  pct: { fontSize: 12, color: '#94a3b8', margin: '6px 0 12px' },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  item: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 },
  link: { fontSize: 12, color: '#f97316', textDecoration: 'none' },
}