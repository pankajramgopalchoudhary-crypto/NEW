import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SelfieToPassport from '../components/SelfieToPassport';
import { Sparkles } from 'lucide-react';

export default function PhotoStudio() {
  return (
    <div data-testid="photo-studio-page">
      <Navbar />
      <section className="hero-gradient grain">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 pt-3 lg:pt-6 pb-9 text-center">
          <div className="inline-flex items-center gap-2 justify-center">
            <Sparkles className="h-4 w-4 brand-bronze" />
            <span className="text-xs uppercase tracking-[0.22em] text-slate-600 font-semibold">AI Photo Studio</span>
          </div>
          <h1 className="mt-3 font-display font-semibold text-slate-900" style={{ fontSize: 'clamp(2rem, 4.2vw, 3.8rem)', lineHeight: 1.05 }}>
            Passport-ready photo<br /><span className="shine-text">in 10 seconds.</span>
          </h1>
          <p className="mt-3 text-slate-600 max-w-2xl mx-auto" style={{ fontSize: 'clamp(0.95rem, 1.1vw, 1.125rem)' }}>
            For visa, Emirates ID, Golden Visa, school admission or driving licence. Take a selfie or upload any photo and our AI delivers a UAE-compliant white-background passport photo. Free for Founder Club members.
          </p>
        </div>
      </section>
      <section className="bg-[#FFFCF5] py-12">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <SelfieToPassport
            onResult={(b64) => {
              // For now, just keep the local download. Future: POST to /api/kyc/photo
              console.info('Passport photo ready: bytes', b64.length);
            }}
            onUseManualUpload={() => {
              window.location.href = '/dashboard?tab=documents';
            }}
          />
          <div className="mt-8 grid md:grid-cols-3 gap-4 text-sm text-slate-700">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-[10px] uppercase tracking-[0.22em] font-bold brand-emerald">UAE-compliant</div>
              <div className="mt-2 font-semibold text-slate-900">Meets ICA &amp; GDRFA rules</div>
              <p className="mt-1.5 text-xs text-slate-600">35×45 mm aspect, pure white background, shoulders-up framing, neutral expression, no headwear — exactly what the UAE authorities ask for.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-[10px] uppercase tracking-[0.22em] font-bold brand-emerald">Identity-safe</div>
              <div className="mt-2 font-semibold text-slate-900">Your features stay intact</div>
              <p className="mt-1.5 text-xs text-slate-600">AI only edits the background, framing and lighting. It will not alter facial features, ethnicity or age — guaranteed.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-[10px] uppercase tracking-[0.22em] font-bold brand-emerald">Private</div>
              <div className="mt-2 font-semibold text-slate-900">Photos are not stored</div>
              <p className="mt-1.5 text-xs text-slate-600">Each photo is processed in memory and discarded immediately. We never log or save selfies. Download the result and the input is gone.</p>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
