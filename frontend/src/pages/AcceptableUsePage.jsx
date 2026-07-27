import React from 'react'
import { Link, useLocation } from 'react-router-dom'

// Only allow returning to known-safe internal destinations — this value comes from
// a URL query param, so it must be validated rather than trusted outright.
function safeReturnTo(raw) {
  if (!raw) return null
  if (raw === '/dashboard') return raw
  if (/^\/shop\/[^/?#]+$/.test(raw)) return raw
  return null
}

export default function AcceptableUsePage() {
  const location = useLocation()
  const returnTo = safeReturnTo(new URLSearchParams(location.search).get('returnTo'))
  // Context (where the link was clicked from) always wins. A JWT in localStorage is
  // no longer the decider — a customer scanning a QR in the same browser as a logged-in
  // shopkeeper must never be routed to /dashboard just because a token happens to exist.
  const homeHref = returnTo || (localStorage.getItem('token') ? '/dashboard' : '/')
  return (
    <div className="min-h-screen bg-ink">
      <nav className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <Link to={homeHref} className="font-display font-bold text-lg">Print<span className="text-accent">Drop</span></Link>
        <Link to={homeHref} className="text-xs text-muted hover:text-paper">← Home</Link>
      </nav>
      <div className="max-w-2xl mx-auto px-5 py-10 space-y-8 text-sm text-paper/90 leading-relaxed">
        <div>
          <h1 className="font-display font-bold text-2xl text-paper">Acceptable Use Policy</h1>
          <p className="text-muted text-xs mt-1">Last updated: {new Date().toLocaleDateString('en-IN', { year:'numeric', month:'long', day:'numeric' })}</p>
        </div>

        <p>This policy sets out what you can't do when using PrintDrop, whether you're a Shop or a Customer. It's part of, and should be read alongside, the <Link to="/terms" className="text-accent hover:underline">Terms of Service</Link>.</p>

        <section className="space-y-3 bg-surface border border-white/8 rounded-2xl p-5">
          <h2 className="font-display font-bold text-lg text-accent">Content you may not upload or print</h2>
          <ul className="list-disc list-inside space-y-1.5 text-paper">
            <li>Copyrighted material you don't have permission to reproduce</li>
            <li>Pirated books, media, or cracked software</li>
            <li>Fake or forged identity documents, certificates, or other official documents</li>
            <li>Content that is illegal to possess, distribute, or reproduce</li>
            <li>Files containing malware or malicious code</li>
            <li>Material intended to harass, threaten, or defame a specific person</li>
          </ul>
          <p className="text-xs text-muted">A Shop may refuse to print any job it reasonably believes falls into one of these categories.</p>
        </section>

        <section className="space-y-3 bg-surface border border-white/8 rounded-2xl p-5">
          <h2 className="font-display font-bold text-lg text-accent">Conduct that isn't allowed on the platform</h2>
          <ul className="list-disc list-inside space-y-1.5 text-paper">
            <li>Attempting to bypass, interfere with, or circumvent payment processing</li>
            <li>Scraping, reverse-engineering, or sending automated/bot traffic to the platform</li>
            <li>Impersonating a Shop, a Customer, or PrintDrop staff</li>
            <li>Harassing Shop staff, Customers, or PrintDrop support</li>
            <li>Creating fake Shop accounts or submitting fraudulent orders</li>
            <li>Using the platform for spam or unsolicited bulk activity</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">What happens if this policy is violated</h2>
          <p>We may suspend or terminate access — a Shop's account, or a Customer's ability to submit orders through the platform — for violating this policy, with or without prior notice, as described in the Terms of Service.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">Reporting misuse</h2>
          <p>If you believe someone is misusing PrintDrop — uploading infringing content, running a fraudulent Shop, or anything else covered above — contact us at <a href={`mailto:${import.meta.env.VITE_SUPPORT_EMAIL || 'tech.support.dev@gmail.com'}`} className="text-accent hover:underline">{import.meta.env.VITE_SUPPORT_EMAIL || 'tech.support.dev@gmail.com'}</a>.</p>
        </section>

        <footer className="pt-4 border-t border-white/8 text-xs text-muted space-y-1">
          <p>© {new Date().getFullYear()} PrintDrop. All rights reserved.</p>
          <p>PrintDrop is an independent software platform that connects customers with independent print shops. Physical printing is provided by the participating Shops using their own equipment.</p>
        </footer>
      </div>
    </div>
  )
}