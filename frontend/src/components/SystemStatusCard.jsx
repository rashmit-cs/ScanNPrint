import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api.js'

function timeAgo(dateStr) {
  if (!dateStr) return null
  const mins = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins === 1) return '1 minute ago'
  if (mins < 60) return `${mins} minutes ago`
  const hrs = Math.round(mins / 60)
  return `${hrs} hour${hrs > 1 ? 's' : ''} ago`
}

export default function SystemStatusCard() {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    if (!localStorage.getItem('token')) return
    const load = () => api.get('/shop/status').then(({ data }) => setStatus(data)).catch(() => {})
    load()
    const iv = setInterval(load, 60000) // keep "last seen" fresh
    return () => clearInterval(iv)
  }, [])

  if (!status) return null

  const items = [
    { label: 'Subscription Active', ok: status.subscriptionActive },
    { label: 'Razorpay Connected', ok: status.razorpayConnected, to: '/setup', cta: 'Open Settings' },
    { label: status.agentOnline ? 'PC Agent Online' : 'PC Agent Offline', ok: status.agentOnline,
      sub: status.agentLastSeen ? `Last seen: ${timeAgo(status.agentLastSeen)}` : 'Never connected',
      to: '/dashboard?tab=agent', cta: 'Open Agent Guide' },
    { label: status.printerConnected ? 'Printer Connected' : 'Printer Offline', ok: status.printerConnected,
      to: '/dashboard?tab=printers', cta: 'Open Printers' },
  ]
  const allOk = items.every(i => i.ok)

  return (
    <div style={styles.card}>
      <div style={styles.title}>{allOk ? '🟢 All Systems Operational' : '⚠️ System Status'}</div>
      <ul style={styles.list}>
        {items.map(i => (
          <li key={i.label} style={styles.item}>
            <div>
              <span>{i.ok ? '🟢' : '🔴'} {i.label}</span>
              {i.sub && <div style={styles.sub}>{i.sub}</div>}
            </div>
            {!i.ok && i.to && <Link to={i.to} style={styles.link}>{i.cta} →</Link>}
          </li>
        ))}
      </ul>
    </div>
  )
}

const styles = {
  card: { background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 16, color: '#fff' },
  title: { fontWeight: 600, fontSize: 14, marginBottom: 10 },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 },
  item: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 },
  sub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  link: { fontSize: 12, color: '#f97316', textDecoration: 'none', whiteSpace: 'nowrap' },
}