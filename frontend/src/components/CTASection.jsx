import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { ArrowRight, Phone } from 'lucide-react';

export default function CTASection() {
  const navigate = useNavigate();
  return (
    <section className="py-14 lg:py-20 relative overflow-hidden bg-[#FFFCF5]">
      <div className="max-w-6xl mx-auto px-5 lg:px-8">
        <div className="relative card-elevated rounded-3xl p-10 lg:p-16 text-center overflow-hidden">
          <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-[#0F766E]/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-[#B45309]/10 blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-900/10">
              <span className="pulse-dot" />
              <span className="text-[11px] uppercase tracking-[0.22em] font-semibold brand-emerald">Advisors online now</span>
            </div>
            <h2 className="mt-5 font-display text-4xl lg:text-6xl font-semibold text-slate-900 leading-[1.02] max-w-3xl mx-auto">
              Start your UAE business journey today
            </h2>
            <p className="mt-5 text-lg text-slate-600 max-w-2xl mx-auto">Speak to our team or use the Smart Finder. No commitment. No pressure. Just honest guidance.</p>
            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              <Button onClick={() => navigate('/consultation')} className="btn-primary rounded-full h-12 px-7"><Phone className="h-4 w-4 mr-2" /> Book Free Consultation</Button>
              <Button onClick={() => navigate('/free-zones')} variant="outline" className="rounded-full h-12 px-7 border-slate-300">Compare Free Zones <ArrowRight className="h-4 w-4 ml-2" /></Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
