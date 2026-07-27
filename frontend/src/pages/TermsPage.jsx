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

export default function TermsPage() {
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
          <h1 className="font-display font-bold text-2xl text-paper">Terms & Conditions</h1>
          <p className="text-muted text-xs mt-1">Last updated: {new Date().toLocaleDateString('en-IN', { year:'numeric', month:'long', day:'numeric' })}</p>
        </div>

        <p>PrintDrop has two kinds of users, and these terms apply differently to each:</p>
        <ul className="list-disc list-inside space-y-1 text-paper">
          <li><strong>Shops</strong> — print shop owners who subscribe to PrintDrop's software</li>
          <li><strong>Customers</strong> — anyone who scans a Shop's QR code to upload and pay for a print job, without creating any account</li>
        </ul>
        <p>Using PrintDrop in either role means you agree to the sections below that apply to you.</p>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">Definitions</h2>
          <p><strong>"Platform"</strong> or <strong>"PrintDrop"</strong> means this software, including the website, dashboard, and PC Agent.<br/>
          <strong>"Shop"</strong> means a print shop owner with a PrintDrop account.<br/>
          <strong>"Customer"</strong> means anyone printing through a Shop's QR code, without an account.<br/>
          <strong>"Order"</strong> means a single print job submitted by a Customer to a Shop.</p>
        </section>

        {/* ───────── SHOP TERMS ───────── */}
        <section className="space-y-4 bg-surface border border-white/8 rounded-2xl p-5">
          <h2 className="font-display font-bold text-lg text-accent">Part A — For Shops (Subscribers)</h2>

          <div className="space-y-2">
            <h3 className="font-display font-semibold text-paper">A1. What PrintDrop is</h3>
            <p>PrintDrop is a software platform, not a print shop, not a payment aggregator, and not your employer. You operate an independent business and are responsible for your own equipment, pricing, service quality, tax, and legal compliance.</p>
          </div>

          <div className="space-y-2">
            <h3 className="font-display font-semibold text-paper">A2. Subscription & billing</h3>
            <p>You pay a recurring fee to access the platform (Monthly / Quarterly / Half-Yearly / Yearly, as priced at signup or upgrade). Subscriptions don't auto-renew unless a recurring method is explicitly set up; access ends if a subscription lapses. Fees already paid are non-refundable except where required by law.</p>
          </div>

          <div className="space-y-2">
            <h3 className="font-display font-semibold text-paper">A3. Print payments belong to you</h3>
            <p>Money a customer pays for a print job goes directly to you — via your own connected Razorpay account, or UPI if you haven't connected one. PrintDrop takes zero commission, never holds this money, and is not a party to it. Razorpay may charge its own standard payment gateway fees on transactions it processes, separately from and unrelated to PrintDrop — that's between you and Razorpay under their own pricing, and PrintDrop doesn't receive any part of it.</p>
          </div>

          <div className="space-y-2">
            <h3 className="font-display font-semibold text-paper">A4. Your responsibility for what gets printed</h3>
            <p>Customers confirm they have the right to print their files before uploading, but you remain responsible for how your shop operates — including refusing jobs you believe are illegal, infringing, or inappropriate, and handling any customer dispute over a print job yourself.</p>
          </div>

          <div className="space-y-2">
            <h3 className="font-display font-semibold text-paper">A5. No warranty, limited liability</h3>
            <p>PrintDrop is provided "as is." We're not liable for lost revenue, failed prints, payment disputes, data loss, or the actions of any customer, other Shop, domain registrant, or third party operating an instance of this software. Our total liability in any circumstance is limited to the subscription fees you paid in the preceding month.</p>
          </div>

          <div className="space-y-2">
            <h3 className="font-display font-semibold text-paper">A6. Termination & platform updates</h3>
            <p>We may suspend or terminate your access for violating these terms, non-payment, or misuse of the platform, with or without notice. We may also perform routine maintenance and updates to the platform, which we aim to schedule during off-peak hours where possible.</p>
          </div>

          <div className="space-y-2">
            <h3 className="font-display font-semibold text-paper">A7. Maintenance</h3>
            <p>Keep your printer stocked with paper and ink/toner, and keep the PC Agent running during your business hours so orders print without delay. The PC Agent interacts with your local computer; you install and run it at your own risk — PrintDrop isn't liable for operating-system crashes, driver conflicts, local network issues, or hardware failures on your own machine. If your printer or PC Agent goes offline, incoming orders will simply queue until it's back up.</p>
          </div>

          <div className="space-y-2">
            <h3 className="font-display font-semibold text-paper">A8. Local compliance</h3>
            <p>You're operating an independent business and are responsible for your own tax, licensing, and compliance with local laws applicable to running a print shop — PrintDrop doesn't handle this on your behalf.</p>
          </div>
        </section>

        {/* ───────── CUSTOMER TERMS ───────── */}
        <section className="space-y-4 bg-surface border border-white/8 rounded-2xl p-5">
          <h2 className="font-display font-bold text-lg text-accent">Part B — For Customers (Printing a Document)</h2>

          <div className="space-y-2">
            <h3 className="font-display font-semibold text-paper">B1. No account, no PrintDrop relationship with you</h3>
            <p>You don't sign up for PrintDrop — you're using a Shop's own service, which happens to run on PrintDrop's software. Your transaction, including any refund or quality issue, is between you and that Shop.</p>
          </div>

          <div className="space-y-2">
            <h3 className="font-display font-semibold text-paper">B2. You confirm you have the right to print your files</h3>
            <p>By uploading, you confirm the file(s) are yours to print, or you otherwise have permission — for example, you won't upload someone else's copyrighted work, identity documents that aren't yours, or anything illegal to reproduce or possess. You're responsible for the content you upload.</p>
            <p>You may not upload, and a Shop may refuse to print: copyrighted material you don't have permission to reproduce; pirated books or media; fake or forged identity documents, certificates, or other official documents; content that is illegal to possess or distribute; files containing malware or malicious code; or material intended to harass, threaten, or defame a specific person.</p>
          </div>

          <div className="space-y-2">
            <h3 className="font-display font-semibold text-paper">B3. Payment</h3>
            <p>When you pay online, your payment goes directly to the Shop's own Razorpay account — PrintDrop doesn't receive or hold it. If you pay by UPI and mark "I've Paid," the Shop confirms receipt on their end. Refunds, if any, are handled by the Shop, not PrintDrop.</p>
          </div>

          <div className="space-y-2">
            <h3 className="font-display font-semibold text-paper">B4. Your files are temporary</h3>
            <p>Uploaded files are used only to complete your print job and are automatically deleted afterward (see the Privacy Policy for the exact retention window).</p>
          </div>

          <div className="space-y-2">
            <h3 className="font-display font-semibold text-paper">B5. No warranty</h3>
            <p>Printing depends on the Shop's own hardware, drivers, and internet connection — things PrintDrop doesn't control. We don't guarantee uptime, print quality, or turnaround time.</p>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">Acceptable use</h2>
          <p>Beyond the upload rules in B2, you agree not to: attempt to bypass or interfere with payment processing; scrape, reverse-engineer, or overload the platform with automated requests; impersonate a Shop, a Customer, or PrintDrop staff; harass Shop staff or other Customers; create fake Shop accounts or submit fraudulent orders; or use the platform for spam or unsolicited bulk activity. We reserve the right to rate-limit or block traffic that attempts any of the above, and may suspend access for any of these.</p>
          <p>If you believe someone is misusing PrintDrop, contact us at <a href={`mailto:${import.meta.env.VITE_SUPPORT_EMAIL || 'tech.support.dev@gmail.com'}`} className="text-accent hover:underline">{import.meta.env.VITE_SUPPORT_EMAIL || 'tech.support.dev@gmail.com'}</a>.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">Refunds</h2>
          <p><strong>Subscriptions (Shops):</strong> fees already paid to PrintDrop are non-refundable, except where required by law.</p>
          <p><strong>Print payments (Customers):</strong> this money goes directly to the Shop, so refund decisions for a print job are made by the Shop, not PrintDrop. Raise refund requests with the Shop directly, quoting your Order Number.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">Indemnification</h2>
          <p>You agree to cover PrintDrop for any claims, losses, or costs arising from content you upload or print, your violation of these terms, or your violation of any law or third party's rights — to the extent caused by you rather than by PrintDrop.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">Intellectual property</h2>
          <p>The PrintDrop software, branding, logo, interface, and underlying code are owned by PrintDrop and its developer. Except for what's needed to use the platform as intended, you may not copy, reverse-engineer, or resell any part of it without permission. This doesn't affect ownership of your own shop's name, content, or the files customers upload.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">Third-party services</h2>
          <p>PrintDrop relies on third-party providers — including Razorpay for payments, and standard cloud hosting and database providers — to operate. See the <Link to="/privacy" className="text-accent hover:underline">Privacy Policy</Link> for details on how each is used.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">Governing law</h2>
          <p>These terms are governed by the laws of India. Any dispute arising from your use of PrintDrop is subject to the exclusive jurisdiction of the courts of Goa, India.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">Independent operation</h2>
          <p>Anyone who deploys, rebrands, purchases a domain for, or otherwise operates an instance of this software does so independently and at their own responsibility. The original developer is not responsible for how any deployed instance is operated, represented, or used by a third party.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">Changes to these terms</h2>
          <p>These terms may be updated from time to time. Continued use after a change means you accept the updated terms.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">Grievance contact</h2>
          <p>For grievances relating to content on the platform, including takedown requests, contact <a href={`mailto:${import.meta.env.VITE_SUPPORT_EMAIL || 'tech.support.dev@gmail.com'}`} className="text-accent hover:underline">{import.meta.env.VITE_SUPPORT_EMAIL || 'tech.support.dev@gmail.com'}</a>. We aim to acknowledge and act on verified, legally valid requests promptly.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-semibold text-paper">Contact</h2>
          <p>Questions: <a href={`mailto:${import.meta.env.VITE_SUPPORT_EMAIL || 'tech.support.dev@gmail.com'}`} className="text-accent hover:underline">{import.meta.env.VITE_SUPPORT_EMAIL || 'tech.support.dev@gmail.com'}</a></p>
        </section>

        <footer className="pt-4 border-t border-white/8 text-xs text-muted space-y-1">
          <p>© {new Date().getFullYear()} PrintDrop. All rights reserved.</p>
          <p>PrintDrop, including its software, website, source code, interface, branding, and logo, is protected by applicable intellectual property laws. Unauthorized copying, reproduction, resale, redistribution, or reverse engineering without prior written permission is prohibited, except where permitted by applicable law.</p>
          <p>PrintDrop is an independent software platform that connects customers with independent print shops. Physical printing is provided by the participating Shops using their own equipment.</p>
        </footer>
      </div>
    </div>
  )
}