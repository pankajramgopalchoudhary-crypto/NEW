import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { COMPANY_INFO } from '../data/zones';

export default function WhatsAppFloat() {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-5 right-5 z-[60]">
      {open && (
        <div className="mb-3 w-80 card-elevated rounded-2xl p-5 fade-up">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-500 grid place-items-center text-white">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-slate-900 text-sm">WhatsApp Agent</div>
                <div className="text-[11px] text-emerald-600 flex items-center gap-1"><span className="pulse-dot" /> Online — replies instantly</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-4 text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-3">
            👋 Hi there! Need help comparing UAE free zones? Tap below to chat with our advisor on WhatsApp.
          </div>
          <a href={`https://wa.me/${COMPANY_INFO.whatsappNumber}?text=Hello%20SmartSetupUAE%2C%20I%20need%20help%20with%20business%20setup`} target="_blank" rel="noreferrer" className="mt-4 block w-full text-center btn-primary rounded-full py-2.5 text-sm font-semibold">Chat on WhatsApp</a>
        </div>
      )}
      <button onClick={() => setOpen(!open)} className="h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-600 transition-colors text-white grid place-items-center shadow-2xl shadow-emerald-500/30 relative" aria-label="WhatsApp Chat">
        <MessageCircle className="h-6 w-6" />
        {!open && <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-amber-400 ring-2 ring-white animate-pulse" />}
      </button>
    </div>
  );
}
