import React, { useState } from 'react'
import { Link } from 'react-router-dom'

// TODO: once shops carry lat/lng + verification fields in the DB, swap this
// for a fetch('/api/partners?verified=true') — the card/map below already
// render off this shape, so the API just needs to match it.
const PARTNERS = [
  {
    id: 'city-mobiles',
    name: 'City Mobiles & Xerox',
    area: 'Queeny',
    city: 'Goa',
    since: 2026,
    services: ['Printing', 'Mobile Repair', 'PC Services'],
    x: 38, // position on the mini map, % from left
    y: 46, // position on the mini map, % from top
  },
  {
    id: 'sai-xerox',
    name: 'Sai Xerox',
    area: 'Ponda',
    city: 'Goa',
    since: 2026,
    services: ['Printing', 'Scanning'],
    x: 58,
    y: 62,
  },
  {
    id: 'fast-prints',
    name: 'Fast Prints',
    area: 'Margao',
    city: 'Goa',
    since: 2026,
    services: ['Printing', 'Binding'],
    x: 66,
    y: 80,
  },
]

function PartnerMap({ partners, selectedId, onSelect }) {
  return (
    <div className="relative w-full aspect-[4/5] max-w-xs mx-auto bg-surface border border-white/8 rounded-2xl overflow-hidden">
      {/* faint reference grid so the pins read as "a map", not a random scatter */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.08]" xmlns="http://www.w3.org/2000/svg">
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={`${(i + 1) * 14}%`} x2="100%" y2={`${(i + 1) * 14}%`} stroke="currentColor" />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={`v${i}`} x1={`${(i + 1) * 14}%`} y1="0" x2={`${(i + 1) * 14}%`} y2="100%" stroke="currentColor" />
        ))}
      </svg>

      <span className="absolute top-3 left-3 text-[11px] uppercase tracking-wide text-muted">Goa</span>

      {partners.map((p) => {
        const active = p.id === selectedId
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            className={`absolute -translate-x-1/2 -translate-y-full flex flex-col items-center group`}
            aria-label={`${p.name}, ${p.area}`}
          >
            <span
              className={`text-lg leading-none transition-transform group-hover:scale-110 ${
                active ? 'text-accent scale-125' : 'text-paper/70'
              }`}
            >
              📍
            </span>
            <span
              className={`mt-1 text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap transition-opacity ${
                active ? 'opacity-100 bg-accent/20 text-accent' : 'opacity-0 group-hover:opacity-100 bg-black/60 text-paper'
              }`}
            >
              {p.area}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function PartnerCard({ partner, active, onSelect }) {
  return (
    <button
      onClick={() => onSelect(partner.id)}
      className={`w-full text-left border rounded-xl px-4 py-3 transition-colors ${
        active ? 'border-accent/40 bg-accent/5' : 'border-white/8 bg-surface hover:border-white/20'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-display font-semibold text-paper text-sm">{partner.name}</div>
          <div className="text-muted text-xs mt-0.5">{partner.area}, {partner.city}</div>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-accent">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          Verified
        </span>
      </div>

      {active && (
        <div className="mt-3 pt-3 border-t border-white/8 space-y-1.5">
          {partner.services.map((s) => (
            <div key={s} className="flex items-center gap-2 text-xs text-muted">
              <span className="text-accent">✔</span> {s}
            </div>
          ))}
          <div className="text-[11px] text-muted pt-1">Partner since {partner.since}</div>
        </div>
      )}
    </button>
  )
}

export default function LandingPage() {
  const [selectedId, setSelectedId] = useState(PARTNERS[0].id)
  const selectPartner = (id) => setSelectedId((current) => (current === id ? null : id))

  return (
    <div className="min-h-screen bg-ink flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 border-b border-white/5">
        <span className="font-display font-bold text-xl tracking-tight">
  Scan<span className="text-accent">NPrint</span>
</span>
        <div className="flex gap-3">
          <Link to="/login" className="text-sm text-muted hover:text-paper transition-colors px-4 py-2">
            Login
          </Link>
          <Link to="/signup" className="text-sm bg-accent text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors font-medium">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="fade-up max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 text-accent text-xs font-medium px-3 py-1 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            Auto-print on payment
          </div>
          
          <h1 className="font-display font-extrabold text-5xl md:text-6xl leading-tight mb-5">
            Print shop,<br />
            <span className="text-accent">zero friction.</span>
          </h1>
          
          <p className="text-muted text-lg mb-8 leading-relaxed max-w-xl mx-auto">
            Customer scans QR → uploads document → pays online → printer fires automatically. No manual handling.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/signup" className="bg-accent text-white font-display font-semibold px-8 py-3.5 rounded-xl hover:bg-orange-600 transition-all hover:scale-[1.02] active:scale-95">
              Become a Partner →
            </Link>
            <Link to="/login" className="border border-white/10 text-paper px-8 py-3.5 rounded-xl hover:bg-white/5 transition-all font-medium">
              Already have account
            </Link>
          </div>
        </div>

        {/* Flow diagram */}
        <div className="fade-up-2 mt-16 flex flex-wrap items-center justify-center gap-4 text-sm">
          {['Scan QR', 'Upload Doc', 'Choose Color/BW', 'Pay UPI', 'Auto Print ✓'].map((step, i) => (
            <React.Fragment key={step}>
              <div className="bg-surface border border-white/8 rounded-xl px-4 py-3 text-center">
                <div className="text-xs text-muted mb-1">Step {i + 1}</div>
                <div className="font-display font-semibold text-paper text-sm">{step}</div>
              </div>
              {i < 4 && <div className="text-accent text-lg">→</div>}
            </React.Fragment>
          ))}
        </div>
      </main>

      {/* Social proof */}
      <section className="px-6 py-16 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-2">
            <h2 className="font-display font-bold text-2xl md:text-3xl">
              🏪 Trusted by Print Shops
            </h2>
            <p className="text-muted text-sm mt-2">
              {PARTNERS.length} Verified Partner Shops · Goa · Growing Every Week
            </p>
          </div>

          <div className="mt-10 grid md:grid-cols-2 gap-8 items-start">
            <div className="space-y-3 order-2 md:order-1">
              {PARTNERS.map((p) => (
                <PartnerCard
                  key={p.id}
                  partner={p}
                  active={p.id === selectedId}
                  onSelect={selectPartner}
                />
              ))}
            </div>

            <div className="order-1 md:order-2">
              <PartnerMap partners={PARTNERS} selectedId={selectedId} onSelect={selectPartner} />
              <p className="text-center text-muted text-[11px] mt-3">
                Tap a pin or a shop to see details
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="text-center text-muted text-xs py-6 border-t border-white/5">
        ScanNPrint — Built for Indian print shops
      </footer>
    </div>
  )
}