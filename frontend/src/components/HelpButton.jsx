import React, { useState } from 'react'
import api from '../api.js'

export default function HelpButton() {
  const [open, setOpen] = useState(false)
  const [links, setLinks] = useState(null)

  const toggle = async () => {
    if (!open && !links) {
      try { const { data } = await api.get('/auth/plan-info'); setLinks(data) } catch { /* still show static options */ }
    }
    setOpen(o => !o)
  }

  const supportEmail = links?.supportEmail || 'tech.support.dev@gmail.com'

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 bg-surface border border-white/10 rounded-2xl shadow-2xl p-2 w-56 space-y-0.5 fade-up">
          {links?.whatsapp && (
            <a href={links.whatsapp} target="_blank" rel="noreferrer"
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/5 text-sm text-paper transition-colors">
              💬 WhatsApp Support
            </a>
          )}
          <a href={`mailto:${supportEmail}`}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/5 text-sm text-paper transition-colors">
            ✉️ Email Support
          </a>
          <a href="/help"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/5 text-sm text-paper transition-colors">
            📖 Documentation
          </a>
          <a href={`mailto:${supportEmail}?subject=${encodeURIComponent('Bug Report — ScanNPrint')}`}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/5 text-sm text-paper transition-colors">
            🐞 Report a Bug
          </a>
        </div>
      )}
      <button onClick={toggle}
        className="w-13 h-13 w-[52px] h-[52px] rounded-full bg-accent text-white shadow-2xl flex items-center justify-center text-xl font-bold hover:scale-105 active:scale-95 transition-transform">
        {open ? '✕' : '?'}
      </button>
    </div>
  )
}
