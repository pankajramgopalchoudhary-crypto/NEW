import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PageFAQ from '../components/PageFAQ';
import { faqVisa } from '../constants/pageFaqs';
import { VISA_TYPES } from '../mock';
import { Crown, Briefcase, UserCheck, Users, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';

const ICONS = { Crown, Briefcase, UserCheck, Users };

export default function VisaServices() {
  const navigate = useNavigate();
  return (
    <div>
      <Navbar />
      <section className="hero-gradient grain">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 pt-3 lg:pt-6 pb-10">
          <div className="flex items-center gap-2 fade-up">
            <Sparkles className="h-4 w-4 brand-bronze" />
            <span className="text-xs uppercase tracking-[0.22em] text-slate-600 font-semibold">UAE Visa Services</span>
          </div>
          <h1 className="mt-4 font-display text-5xl lg:text-7xl font-semibold leading-[1.02] text-slate-900 fade-up delay-100">All the visas—<br /><span className="shine-text">one trusted advisor.</span></h1>
          <p className="mt-5 text-lg text-slate-600 max-w-2xl fade-up delay-200">Golden Visa, investor partner visa, employment visa and family visa. Eligibility check is free — we'll tell you honestly if you're not ready.</p>
        </div>
      </section>
      <section className="py-20 bg-[#FFFCF5]">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {VISA_TYPES.map((v, i) => {
            const Icon = ICONS[v.icon] || Crown;
            const isB = v.color === 'bronze';
            return (
              <div key={v.name} className="card-elevated rounded-2xl p-6 reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                <div className={`h-11 w-11 rounded-xl grid place-items-center ${isB ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                  <Icon className={`h-5 w-5 ${isB ? 'brand-bronze' : 'brand-emerald'}`} />
                </div>
                <div className="font-display text-xl font-semibold text-slate-900 mt-4">{v.name}</div>
                <div className="text-[11px] uppercase tracking-[0.2em] font-semibold mt-1.5 text-slate-500">Duration: {v.duration}</div>
                <p className="text-sm text-slate-600 mt-3 leading-relaxed">{v.audience}</p>
                <Button
                  onClick={() => navigate(`/consultation?service=${encodeURIComponent(v.name)}&source=visa-services`, { state: { service: v.name, message: `I want to check eligibility for ${v.name}.` } })}
                  variant="outline"
                  size="sm"
                  className="mt-5 rounded-full border-slate-300 h-9 text-xs"
                >
                  Check Eligibility
                </Button>
              </div>
            );
          })}
        </div>
      </section>
      <PageFAQ title="UAE Visa Services — Common questions" intro="Investor, employment, Golden, family — durations, costs, processing time, eligibility, family sponsorship and rejection handling." items={faqVisa} testId="faq-visa" />
      <Footer />
    </div>
  );
}
