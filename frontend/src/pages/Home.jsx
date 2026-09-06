import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import HeroAI from '../components/HeroAI';
import ActivitySearch from '../components/ActivitySearch';
import { ArchitecturalAdvantage, PlatformStrengthsSection } from '../components/FeaturesSection';
import { IndustryRecommendations, ProcessSteps, Testimonials } from '../components/StoriesSections';
import CTASection from '../components/CTASection';
import { Sparkles, Crown, ArrowRight } from 'lucide-react';

const ROTATING_KEYWORDS = [
  'Cheapest Free Zone License',
  'Mainland Trade License',
  'Cheap Visa Packages',
  'UAE Bank Account Opening',
  'Company Formation Dubai',
  'Activity Match Score',
  '0% Corporate Tax Zones',
  'Visa & Banking Fit',
  'Multi-Year Discounts',
  'Crypto / VARA Setup',
];

function RotatingKeywords() {
  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % ROTATING_KEYWORDS.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="py-7 bg-white border-b border-slate-200/70">
      <div className="max-w-[1480px] mx-auto px-5 lg:px-8 flex items-center justify-center gap-3 flex-wrap">
        <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-slate-500 shrink-0">We help with</span>
        <div className="h-7 overflow-hidden flex items-center">
          <div className="transition-transform duration-700 will-change-transform" style={{ transform: `translateY(-${idx * 28}px)` }}>
            {ROTATING_KEYWORDS.map((w) => (
              <div key={w} className="h-7 flex items-center gap-2 whitespace-nowrap">
                <Sparkles className="h-3.5 w-3.5 brand-bronze shrink-0" />
                <span className="font-display font-semibold text-slate-800 text-base lg:text-lg">{w}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FounderClubBanner() {
  const navigate = useNavigate();
  return (
    <div className="py-8 bg-gradient-to-br from-[#0F2A2A] to-[#13433f]">
      <div className="max-w-[1480px] mx-auto px-5 lg:px-8">
        <button
          type="button"
          onClick={() => navigate('/founder-club')}
          className="w-full text-left rounded-2xl border border-[#F0C674]/40 bg-white/5 backdrop-blur-sm text-white p-5 lg:p-6 hover:shadow-2xl hover:shadow-emerald-900/30 hover:bg-white/10 transition-all group"
          data-testid="home-founder-club-banner"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-[#F0C674]/15 grid place-items-center shrink-0">
                <Crown className="h-5 w-5 text-[#F0C674]" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-[#F0C674]">Founder Club</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F0C674] text-[#0F2A2A] font-bold">AED 999 · First 500</span>
                </div>
                <div className="mt-1.5 font-display text-lg lg:text-xl font-bold text-white">Cheap visa · Bank intro · Discounted company formation</div>
                <div className="mt-1 text-[13px] text-white/80">10% renewal off · up to 15% service discounts · dedicated advisor · tax & VAT filing support</div>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#F0C674] text-[#0F2A2A] font-bold text-sm group-hover:gap-3 transition-all">
              Join now <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

function TrustMarquee() {
  const items = ['IFZA', 'Meydan', 'SHAMS', 'SPC', 'RAKEZ', 'ANCFZ', 'JAFZA', 'DMCC', 'KIZAD', 'TECOM', 'DAFZA', 'DIFC', 'ADGM', 'Masdar City', 'Hamriyah FZ'];
  return (
    <div className="py-10 bg-[#F8F3E8] overflow-hidden border-y border-emerald-900/5">
      <div className="max-w-[1480px] mx-auto px-5 lg:px-8 flex items-center gap-6 flex-col lg:flex-row">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] font-semibold text-slate-600 shrink-0">
          <Sparkles className="h-3.5 w-3.5 brand-bronze" />
          Working alongside 40+ jurisdictions
        </div>
        <div className="flex-1 overflow-hidden w-full">
          <div className="marquee gap-12">
            {[...items, ...items].map((it, i) => (
              <span key={i} className="font-display text-xl lg:text-2xl font-semibold text-slate-400 hover:text-slate-700 transition-colors shrink-0">{it}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div>
      <Navbar />
      <HeroAI />
      <RotatingKeywords />
      <FounderClubBanner />
      <TrustMarquee />
      <ArchitecturalAdvantage />
      <ActivitySearch compact />
      <IndustryRecommendations />
      <ProcessSteps />
      <Testimonials />
      <PlatformStrengthsSection />
      <CTASection />
      <Footer />
    </div>
  );
}
