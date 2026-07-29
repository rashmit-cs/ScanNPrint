import React from 'react'
import { Link } from 'react-router-dom'

const FAQS = [
  {
    q: 'How do I set up the PC Agent?',
    a: 'Go to Settings → PC Agent → Download Windows Agent, and Download config.env. Put both in the same folder on the shop\'s computer, run "pip install -r requirements.txt" once, then "python agent.py". Full steps are in the INSTALL.md file inside the download.'
  },
  {
    q: 'My PC Agent shows "Unauthorized"',
    a: 'Your config.env secret no longer matches the dashboard — usually because the secret was regenerated. Go to Settings → PC Agent → Regenerate Secret, download the new config.env, replace the old file, and restart the agent.'
  },
  {
    q: 'Nothing is printing even though the order shows PAID',
    a: 'Check that the PC Agent is running and showing "polling" in its window, that the printer is powered on and online in Windows, and that it\'s assigned a Color or B&W role in the dashboard\'s Printers tab.'
  },
  {
    q: 'How does the free trial work?',
    a: 'Every shop gets 15 days free on signup. You can upgrade to a paid plan at any point during the trial — it activates instantly and simply extends your access, it never interrupts what you already have.'
  },
  {
    q: 'Where does customer payment money go?',
    a: 'Directly to your own connected Razorpay account (or your UPI ID if you haven\'t connected Razorpay yet). ScanNprint never touches or holds this money — see the Privacy Policy for details.'
  },
  {
    q: 'How do I change my subscription plan?',
    a: 'Dashboard → 🚀 Upgrade. Payment is handled by Razorpay Checkout and your plan updates automatically — no waiting for approval.'
  },
  {
    q: 'Why is the amount I receive slightly less than what the customer paid?',
    a: "That's Razorpay's own payment gateway fee, not ScanNprint's — we take zero commission. As an approximate example, at Razorpay's standard published rate (2% + 18% GST on the fee), a ₹10 job nets you about ₹9.76, a ₹100 job nets about ₹97.64, and a ₹500 job nets about ₹488.20. Plain bank-to-bank UPI payments are often charged little or no fee under RBI's zero-MDR rule, so your actual numbers may be better than this. Check your Razorpay dashboard for your exact rate — it can vary by plan and payment method."
  },
]

const CUSTOMER_FAQS = [
  {
    q: 'The shop\'s printer is offline or not responding',
    a: 'This is on the shop\'s end, not something ScanNprint can fix remotely. Let the shopkeeper know directly — they can usually get it back online in a couple of minutes.'
  },
  {
    q: 'There\'s a paper jam or the printer ran out of paper',
    a: 'Flag this to the shopkeeper in person. Your order stays queued and will print automatically once the printer is cleared and ready again.'
  },
  {
    q: 'The printer is out of ink or toner',
    a: 'Let the shopkeeper know — refilling ink/toner is the shop\'s responsibility, not ScanNprint\'s. Your order will resume once it\'s topped up.'
  },
  {
    q: 'My payment went through but the order still shows pending',
    a: 'For online payments this is usually just a short delay in confirmation — it should update within a minute or two. If it doesn\'t, show the shopkeeper your payment confirmation directly.'
  },
  {
    q: 'Why is my print taking longer than expected?',
    a: 'Printing depends on the shop\'s own printer, queue, and internet connection, which ScanNprint doesn\'t control. If it\'s taking unusually long, check with the shopkeeper.'
  },
  {
    q: 'How do refunds work?',
    a: 'Your payment goes directly to the shop\'s own account — ScanNprint never holds it. Refunds are handled by the shop, not ScanNprint, so raise refund requests with the shopkeeper directly.'
  },
  {
    q: 'What\'s my Order Number for?',
    a: 'It\'s a quick reference so the shopkeeper can find your order if you need to ask about it in person — just mention the number shown on your order status screen.'
  },
  {
    q: 'How do I contact the shopkeeper?',
    a: 'ScanNprint doesn\'t provide in-app messaging with the shop — reach out to them directly (in person, by phone, or however you\'d normally contact that shop) and reference your Order Number.'
  },
]

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-ink">
      <nav className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <Link to="/" className="font-display font-bold text-lg">Print<span className="text-accent">Drop</span></Link>
        <Link to="/dashboard" className="text-xs text-muted hover:text-paper">← Dashboard</Link>
      </nav>
      <div className="max-w-2xl mx-auto px-5 py-10 space-y-8">
        <div>
          <h1 className="font-display font-bold text-2xl text-paper">Help & Documentation</h1>
          <p className="text-muted text-sm mt-1">Common questions from shop owners and customers. Still stuck? Use the help button in the corner.</p>
        </div>
        <div className="space-y-3">
          <h2 className="font-display font-semibold text-sm text-accent uppercase tracking-wide">For Shop Owners</h2>
          {FAQS.map((f,i) => (
            <details key={i} className="bg-surface border border-white/8 rounded-2xl p-4 group">
              <summary className="cursor-pointer font-display font-semibold text-sm text-paper list-none flex items-center justify-between">
                {f.q}
                <span className="text-muted group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="text-sm text-muted mt-2 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
        <div className="space-y-3">
          <h2 className="font-display font-semibold text-sm text-accent uppercase tracking-wide">For Customers</h2>
          {CUSTOMER_FAQS.map((f,i) => (
            <details key={i} className="bg-surface border border-white/8 rounded-2xl p-4 group">
              <summary className="cursor-pointer font-display font-semibold text-sm text-paper list-none flex items-center justify-between">
                {f.q}
                <span className="text-muted group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="text-sm text-muted mt-2 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  )
}