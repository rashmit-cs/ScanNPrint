import React from 'react'
import { Link, useLocation } from 'react-router-dom'

// Only allow returning to known-safe internal destinations — this value comes from
// a URL query param, so it must be validated rather than trusted outright.
function safeReturnTo(raw) {
  if (!raw) return null
  if (raw === '/dashboard') return raw
  if (raw === '/signup') return raw
  if (/^\/shop\/[^/?#]+$/.test(raw)) return raw
  return null
}

export default function PrivacyPage() {
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
          <h1 className="font-display font-bold text-2xl text-paper">Privacy Policy</h1>
          <p className="text-muted text-xs mt-1">Last updated: {new Date().toLocaleDateString('en-IN', { year:'numeric', month:'long', day:'numeric' })}</p>
        </div>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">What PrintDrop is</h2>
          <p>PrintDrop is a software tool that lets a print shop ("Shop") receive files from its customers via a QR code and print them automatically. PrintDrop is the software provider only — each Shop is independently owned and operated, and is solely responsible for how it runs its own business.</p>
          <p>This policy covers two different people: <strong>Shops</strong>, who create an account and subscribe, and <strong>Customers</strong>, who use a Shop's QR code without ever creating a PrintDrop account.</p>
        </section>

        {/* ───────── SHOP DATA ───────── */}
        <section className="space-y-3 bg-surface border border-white/8 rounded-2xl p-5">
          <h2 className="font-display font-bold text-lg text-accent">Part A — Data We Collect From Shops</h2>
          <p><strong>Account data:</strong> shop name, owner name, email, phone number, and a hashed password — we never store your plain-text password.</p>
          <p><strong>Payment configuration:</strong> if you connect your own Razorpay account, your Key ID is stored as-is; your Key Secret and Webhook Secret are encrypted (AES-256-GCM) before storage and are never sent back to any browser once saved. They're used only, server-side, to create payment requests on your behalf so customer money settles directly into your own account.</p>
          <p><strong>Usage data:</strong> your printer configuration, pricing, order history, and subscription status.</p>
          <p><strong>Why:</strong> to run your dashboard, route customer payments to you, print jobs on your connected printer, and manage your subscription.</p>
        </section>

        {/* ───────── CUSTOMER DATA ───────── */}
        <section className="space-y-3 bg-surface border border-white/8 rounded-2xl p-5">
          <h2 className="font-display font-bold text-lg text-accent">Part B — Data We Collect From Customers</h2>
          <p>Customers don't create an account. When you scan a Shop's QR code to print something, we collect:</p>
          <p><strong>The file(s) you upload</strong> — used only to render and send your print job to the Shop's printer.</p>
          <p><strong>Print settings</strong> you choose — color/B&W, copies, page range, double-sided, images-per-page.</p>
          <p><strong>Phone number</strong> — optional, used only so the Shop can reach you about your order.</p>
          <p><strong>Payment info</strong> — if you pay online, Razorpay processes the transaction; we don't store your card or UPI details. We do record which payment method was used and a confirmation timestamp.</p>
          <p><strong>Technical logs</strong> — like most web applications, our servers automatically log basic technical information such as IP addresses, browser type, and request timestamps, used only for security, diagnostics, and preventing automated abuse.</p>
          <p><strong>File retention:</strong> your uploaded file(s) are automatically deleted — typically within 30 minutes of a successful print, and in all cases within about 2 hours of upload, whether or not printing succeeded.</p>
          <p><strong>Your consent:</strong> before uploading, you're asked to confirm you have the right to print the file(s) and to accept these terms. We record that confirmation (with a timestamp) against your order for accountability, but this is not tied to any ongoing account or profile — it's discarded along with the order data.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">How Razorpay keys are protected</h2>
          <p>If a Shop connects its own Razorpay account, the Key Secret and Webhook Secret are encrypted before they are stored and are never sent back to any browser once saved. They are used only, server-side, to create payment requests and verify webhook signatures for that Shop's own account.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">How payments work</h2>
          <p>There are two separate money flows on PrintDrop:</p>
          <p><strong>1. Customer → Shop (print payments).</strong> Money goes directly to the Shop's own connected Razorpay account or UPI ID. PrintDrop does not receive, hold, or take any commission on this money, and is not a party to that transaction. Razorpay may deduct its own standard gateway/processing fees from these payments under their own pricing — that's separate from and unrelated to PrintDrop, which doesn't receive any part of it.</p>
          <p><strong>2. Shop → PrintDrop (subscription).</strong> Shops pay PrintDrop a subscription fee to use the software. This is the only revenue PrintDrop earns.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">Cookies & local storage</h2>
          <p>PrintDrop doesn't use advertising or tracking cookies. Shops' browsers store a login token locally (in browser storage, not a tracking cookie) so you stay signed in — this is used only to authenticate your session and is never shared with third parties.</p>
          <p>We don't currently use third-party analytics or advertising trackers. If that changes, this policy will be updated accordingly.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">Third-party services</h2>
          <p>PrintDrop relies on a small number of infrastructure providers to operate: Razorpay (payment processing), and standard cloud hosting and database providers for our servers and database. These providers process data only as needed to run the platform and have their own privacy policies governing their handling of that data.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">Data retention</h2>
          <p>Shop account data is kept for as long as the account is active, plus a limited period afterward for backups and legal/accounting purposes, unless you request earlier deletion (see "Your rights" below). Customer file and order data is discarded automatically as described in Part B above. Other transactional details tied to an order (such as order logs and phone numbers) are not kept longer than necessary for accountability and legal/accounting purposes.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">What we don't do</h2>
          <p>We don't sell personal data to third parties. We don't use uploaded customer files for anything other than delivering the print job. We don't display ads.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">Data security incidents</h2>
          <p>In the event of a security incident affecting your account data, we will notify affected Shops via dashboard alert or email once the incident is confirmed, in line with applicable law.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">Your rights</h2>
          <p>Shops can request deletion of their account and associated data, or disconnect their Razorpay keys, at any time. Customers can request access to or deletion of any remaining data linked to their order before it's automatically purged, by contacting us below.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">Disclaimer of responsibility</h2>
          <p>PrintDrop provides software only. We are not responsible for: the conduct of any Shop or its staff; the accuracy, legality, or quality of anything printed; disputes between a Shop and its customers over money, refunds, or service; or how a Shop or any third party (including whoever registers a domain or deploys this software) chooses to configure, operate, brand, or represent the platform. Each Shop operates its own independent business and is solely responsible for its own compliance with applicable laws.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">Contact</h2>
          <p>Questions about this policy: <a href={`mailto:${import.meta.env.VITE_SUPPORT_EMAIL || 'tech.support.dev@gmail.com'}`} className="text-accent hover:underline">{import.meta.env.VITE_SUPPORT_EMAIL || 'tech.support.dev@gmail.com'}</a></p>
        </section>

        <footer className="pt-4 border-t border-white/8 text-xs text-muted space-y-1">
          <p>© {new Date().getFullYear()} PrintDrop. All rights reserved.</p>
          <p>PrintDrop is an independent software platform that connects customers with independent print shops. Physical printing is provided by the participating Shops using their own equipment.</p>
        </footer>
      </div>
    </div>
  )
}