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

export default function ShopkeeperAgreement() {
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
          <h1 className="font-display font-bold text-2xl text-paper">Shopkeeper Agreement</h1>
          <p className="text-muted text-xs mt-1">Last updated: {new Date().toLocaleDateString('en-IN', { year:'numeric', month:'long', day:'numeric' })}</p>
        </div>

        <p>This agreement sets out what's expected of you as a Shop on ScanNprint, in more detail than Part A of the <Link to="/terms" className="text-accent hover:underline">Terms of Service</Link>. If anything here conflicts with the Terms, the Terms govern.</p>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">1. Your printer & hardware</h2>
          <p>You're responsible for your own printer, paper, ink or toner, electricity, and internet connection. ScanNprint's software and PC Agent send jobs to your printer, but we don't control or guarantee your hardware's uptime, condition, or performance.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">2. Maintenance</h2>
          <p>Keep your printer stocked with paper and ink/toner, and keep the PC Agent running during your business hours so orders can print without delay. If your printer goes offline or your PC Agent stops running, incoming orders will queue until it's back up.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">3. Customer service & disputes</h2>
          <p>Customers interact with your shop through ScanNprint's software, but the printing relationship is with you. You're responsible for resolving disputes about print quality, missed orders, or service directly with the customer. ScanNprint is not a party to that relationship and doesn't mediate these disputes.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">4. Payments & refunds</h2>
          <p>Customer print payments go directly to your own connected Razorpay account or UPI ID — ScanNprint never holds this money and takes no commission. Refund decisions for print payments are yours to make, in line with applicable consumer protection law. Your ScanNprint subscription fee is separate and billed independently of customer payments.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">5. Subscription</h2>
          <p>Continued access to the platform depends on an active subscription. Fees already paid to ScanNprint are non-refundable except where required by law. If your subscription lapses, your dashboard and QR code stop accepting new orders until you renew.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">6. What you print</h2>
          <p>Customers confirm they have the right to print their files before uploading, but you retain the right — and responsibility — to refuse any job you reasonably believe is illegal, infringing, or otherwise inappropriate.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">7. Local compliance</h2>
          <p>You're operating an independent business. You're responsible for your own tax, licensing, and compliance with local laws applicable to running a print shop — ScanNprint doesn't handle this on your behalf.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">8. Termination</h2>
          <p>Either you or ScanNprint can end this arrangement at any time. We may suspend or terminate your account for violating the Terms of Service, the Acceptable Use Policy, or this agreement, for non-payment, or for misuse of the platform.</p>
        </section>

        <footer className="pt-4 border-t border-white/8 text-xs text-muted space-y-1">
          <p>© {new Date().getFullYear()} ScanNprint. All rights reserved.</p>
          <p>ScanNprint is an independent software platform. Physical printing is provided by participating Shops using their own equipment, as independent businesses.</p>
        </footer>
      </div>
    </div>
  )
}