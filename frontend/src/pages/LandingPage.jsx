import React from 'react'
import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ink flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 border-b border-white/5">
        <span className="font-display font-bold text-xl tracking-tight">
          Print<span className="text-accent">Drop</span>
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
              Register Your Shop →
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

      <footer className="text-center text-muted text-xs py-6 border-t border-white/5">
        PrintDrop — Built for Indian print shops
      </footer>
    </div>
  )
}
