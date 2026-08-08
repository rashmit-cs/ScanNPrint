import { useEffect, useState } from 'react'
import api from '../api.js'

export default function AnnouncementBanner() {
  const [ann, setAnn] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('token')) return
    api.get('/shop/announcement')
      .then(({ data }) => {
        if (data.message) {
          const seenAt = localStorage.getItem('dismissedAnnouncementAt')
          setDismissed(seenAt === data.updatedAt)
          setAnn(data)
        }
      })
      .catch(() => {})
  }, [])

  if (!ann || !ann.message || dismissed) return null

  const dismiss = () => {
    localStorage.setItem('dismissedAnnouncementAt', ann.updatedAt)
    setDismissed(true)
  }

  return (
    <div style={styles.banner}>
      <span style={styles.icon}>📢</span>
      <p style={styles.text}>{ann.message}</p>
      <button onClick={dismiss} style={styles.dismiss}>Dismiss</button>
    </div>
  )
}

const styles = {
  banner: { display: 'flex', alignItems: 'center', gap: 12, background: '#1e293b', border: '1px solid #f97316', borderRadius: 10, padding: '12px 16px', margin: '0 0 20px', color: '#fff' },
  icon: { fontSize: 18 },
  text: { flex: 1, margin: 0, fontSize: 14, whiteSpace: 'pre-wrap' },
  dismiss: { background: 'transparent', border: '1px solid #64748b', color: '#cbd5e1', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' },
}