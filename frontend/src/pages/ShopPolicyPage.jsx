import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

export default function ShopPolicyPage() {
  const { shopId } = useParams()
  const [shop, setShop] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    axios.get(`${BASE}/shop/${shopId}/public`)
      .then(({ data }) => setShop(data))
      .catch(() => setError('Shop not found'))
  }, [shopId])

  if (error) return <div style={styles.page}><p>{error}</p></div>
  if (!shop) return <div style={styles.page}><p>Loading…</p></div>

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.h1}>{shop.name}</h1>
        <p style={styles.sub}>Print &amp; document services — pay-per-page printing, powered by ScanNprint</p>

        <Section title="About this business">
          <p>{shop.name} offers walk-in and online document printing — black &amp; white and color, paid per page. Customers upload a file, pay online or in person, and collect their prints at the shop.</p>
        </Section>

        <Section title="Pricing">
          <table style={styles.table}>
            <tbody>
              <tr><td style={styles.td}>Black &amp; White printing</td><td style={styles.td}>₹{shop.bwPrice} / page</td></tr>
              <tr><td style={styles.td}>Color printing</td><td style={styles.td}>₹{shop.colorPrice} / page</td></tr>
            </tbody>
          </table>
          <p style={styles.note}>Final amount is calculated automatically from the number of pages, copies, and color/B&amp;W selection at checkout.</p>
        </Section>

        <Section title="Business hours">
          <p>{shop.openingTime} – {shop.closingTime}, daily. Orders placed outside these hours are queued for the next opening time.</p>
        </Section>

        <Section title="Refund & Cancellation Policy">
          <p>Because each order is printed on demand specifically for the customer, we're generally not able to offer a refund once printing has started — there's no physical item to return.</p>
          <ul style={styles.ul}>
            <li>If your order fails to print due to a technical issue on our end (printer, file, or system error), you'll receive a full refund, processed within 5–7 business days to your original payment method.</li>
            <li>If you cancel before printing has started, you'll receive a full refund.</li>
            <li>If a print comes out visibly incorrect or damaged due to our error, contact us within 24 hours for a free reprint or refund.</li>
          </ul>
        </Section>

        <Section title="Privacy">
          <p>Files you upload are used only to print your order and are automatically deleted from our systems after processing. We don't share your documents with anyone outside this transaction.</p>
        </Section>

        <Section title="Contact us">
          <p>Phone: {shop.phone}</p>
        </Section>

        <p style={styles.footer}>
          <Link to={`/shop/${shopId}`}>← Back to {shop.name}</Link>
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={styles.section}>
      <h2 style={styles.h2}>{title}</h2>
      {children}
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', background: '#f7f7f8', padding: '32px 16px', fontFamily: 'system-ui, sans-serif', color: '#1a1a1a' },
  card: { maxWidth: 640, margin: '0 auto', background: '#fff', borderRadius: 12, padding: '32px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  h1: { fontSize: 24, margin: '0 0 4px' },
  sub: { color: '#666', marginTop: 0 },
  section: { marginTop: 28 },
  h2: { fontSize: 16, marginBottom: 8 },
  table: { width: '100%', borderCollapse: 'collapse' },
  td: { padding: '6px 0', borderBottom: '1px solid #eee' },
  note: { color: '#666', fontSize: 13, marginTop: 8 },
  ul: { paddingLeft: 20, lineHeight: 1.6 },
  footer: { marginTop: 32, fontSize: 14 },
}