import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';
import { paymentsApi } from '../lib/backendApi';
import {
  Crown, CheckCircle2, ArrowRight, Sparkles, ShieldCheck, Bell,
  TrendingUp, Users, Gift, Headphones, Loader2,
} from 'lucide-react';

const BENEFITS = [
  '10% Renewal Discount',
  'Up to 15% Service Discounts',
  'Tax Support',
  'VAT Support',
  'Compliance Reviews',
  'Priority Support',
  'Partner Discounts',
  'Networking Events',
  'Business Opportunity Feed',
  'AI Founder Assistant',
  'Savings Tracker',
  'Renewal Alerts',
  'Tax & VAT Alerts',
  'Visa Alerts',
  'Dedicated Advisor Access',
  'Early Access Offers',
  'Partner Marketplace Access',
  'Grant & Funding Opportunities',
];

const SAVINGS = [
  { label: 'Annual licence renewal (10% off)', amount: 'AED 1,190 – 2,500' },
  { label: 'Service & PRO discounts (up to 15%)', amount: 'AED 750 – 3,000' },
  { label: 'Tax & VAT support bundle', amount: 'AED 1,200+' },
  { label: 'Priority processing & advisory', amount: 'Priceless' },
];

const COMPARISON = [
  { feature: 'Renewal discount', free: '—', founder: '10%' },
  { feature: 'Service discounts', free: '—', founder: 'Up to 15%' },
  { feature: 'Dedicated advisor', free: '—', founder: 'Yes' },
  { feature: 'Tax / VAT / Visa alerts', free: '—', founder: 'Yes' },
  { feature: 'Networking events', free: '—', founder: 'Yes' },
  { feature: 'Savings tracker dashboard', free: '—', founder: 'Yes' },
  { feature: 'Partner marketplace', free: '—', founder: 'Yes' },
];

const FAQS = [
  { q: 'Is the AED 999 a one-time fee?', a: 'Yes. For the first 500 founders, Founder Club membership is a one-time AED 999 — no annual renewal, no hidden top-ups. After the first 500 slots are filled the price becomes AED 1,051 per year.' },
  { q: 'Is the SmartSetupUAE advisory really free?', a: 'Yes — for the first 500 founders our advisory + setup service fee is AED 0. You only pay the actual government / freezone fee. From the 501st founder onward we add a flat 5% service fee on top of the freezone fee.' },
  { q: 'Do I pay VAT on top of the service fee?', a: 'UAE VAT (5%) only applies once a business crosses AED 375,000 in taxable supplies in any 12-month window. Below that, no VAT is added to our fee. Once you cross the threshold, our invoice will show the 5% VAT line separately (it is always included in the displayed price for clarity).' },
  { q: 'When do the savings start?', a: 'Immediately. Your renewal discount, service discounts and dedicated advisor access activate as soon as your membership is confirmed.' },
  { q: 'Can I add Founder Club during checkout?', a: 'Yes. You can add Founder Club as an add-on during any company setup checkout and the discount engine applies automatically.' },
  { q: 'Is the membership refundable?', a: 'Membership is non-refundable once any benefit (renewal discount, advisor session, partner discount) is used. If you cancel BEFORE activating any benefit we issue a full refund within 7 working days.' },
];

export default function FounderClub() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const [buying, setBuying] = useState(false);

  // Direct 1-click Stripe checkout for AED 999 lifetime membership.
  const buyNow = async () => {
    if (!user) { navigate('/login?next=/founder-club?buy=1'); return; }
    setBuying(true);
    try {
      const res = await paymentsApi.createSession({
        amount_aed: 999,
        currency: 'AED',
        customer_email: user.email,
        description: 'SmartSetupUAE Founder Club — Lifetime',
        origin_url: window.location.origin,
        package_id: 'founder_club_lifetime',
      });
      if (res?.url) window.location.href = res.url;
      else throw new Error('No checkout URL returned');
    } catch (e) {
      toast({ title: 'Could not start checkout', description: e.message || 'Please try again.' });
      setBuying(false);
    }
  };

  // Auto-open Stripe when user lands with ?buy=1 (from Dashboard / Home / direct link).
  useEffect(() => {
    if (params.get('buy') === '1' && user && !buying) buyNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, user]);

  return (
    <div data-testid="founder-club-page">
      <Navbar />

      {/* HERO */}
      <section className="hero-gradient grain">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 pt-12 lg:pt-16 pb-14">
          <div className="flex items-center gap-2 fade-up">
            <Crown className="h-4 w-4 brand-bronze" />
            <span className="text-xs uppercase tracking-[0.22em] text-slate-600 font-semibold">SmartSetupUAE Founder Club</span>
          </div>
          <h1 className="mt-4 font-display text-5xl lg:text-7xl font-semibold leading-[1.02] text-slate-900 fade-up delay-100">
            Join the founders<br /><span className="shine-text">who save every year.</span>
          </h1>
          <p className="mt-5 text-lg text-slate-600 max-w-2xl fade-up delay-200">
            One membership. Lifetime savings on renewals, services, tax and compliance — plus a dedicated advisor and exclusive founder opportunities.
          </p>
          <div className="mt-7 flex flex-wrap gap-3 fade-up delay-300">
            <Button data-testid="founder-join-hero" onClick={buyNow} disabled={buying} className="btn-primary rounded-full px-7 h-12">
              {buying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting checkout…</> : <>Join for AED 999 <ArrowRight className="h-4 w-4 ml-2" /></>}
            </Button>
            <Button data-testid="founder-talk" variant="outline" onClick={() => navigate('/consultation?service=Founder%20Club')} className="rounded-full px-7 h-12">
              Talk to an Advisor
            </Button>
          </div>
        </div>
      </section>

      {/* LAUNCH OFFER + PRICING */}
      <section className="py-20 bg-[#FFFCF5]">
        <div className="max-w-5xl mx-auto px-5 lg:px-8 grid md:grid-cols-2 gap-6">
          <div className="card-elevated rounded-3xl p-8 border-2 border-emerald-600/30" data-testid="founder-launch-offer">
            <div className="text-[11px] uppercase tracking-[0.22em] font-semibold brand-emerald flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Launch Offer — First 500 Founders
            </div>
            <div className="mt-3 font-display text-5xl font-semibold text-slate-900">AED 999</div>
            <div className="text-slate-500 mt-1">One-time membership</div>
            <ul className="mt-5 space-y-2">
              {['All 18 Founder Club benefits', 'Locked-in lifetime founder status', 'No annual fee for launch members'].map((p) => (
                <li key={p} className="flex items-start gap-2"><CheckCircle2 className="h-5 w-5 brand-emerald shrink-0 mt-0.5" /><span className="text-slate-700">{p}</span></li>
              ))}
            </ul>
            <Button data-testid="founder-join-card" onClick={buyNow} disabled={buying} className="btn-primary rounded-full mt-6 px-6 h-11 w-full">
              {buying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting checkout…</> : 'Claim Founder Slot — AED 999'}
            </Button>
          </div>
          <div className="card-elevated rounded-3xl p-8" data-testid="founder-standard-pricing">
            <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-slate-500">After Launch</div>
            <div className="mt-3 font-display text-5xl font-semibold text-slate-900">AED 1,051<span className="text-lg text-slate-400 font-normal"> / year</span></div>
            <div className="text-slate-500 mt-1">Annual membership</div>
            <ul className="mt-5 space-y-2">
              {['Same 18 benefits, billed yearly', 'Cancel anytime before renewal', 'Founder slot not guaranteed'].map((p) => (
                <li key={p} className="flex items-start gap-2"><CheckCircle2 className="h-5 w-5 brand-bronze shrink-0 mt-0.5" /><span className="text-slate-700">{p}</span></li>
              ))}
            </ul>
            <div className="mt-6 rounded-2xl bg-amber-50 text-amber-800 text-sm px-4 py-3">
              Lock the one-time AED 999 price before the first 500 slots are gone.
            </div>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="py-20 bg-[#F8F3E8]">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <h2 className="font-display text-3xl lg:text-4xl font-semibold text-slate-900">Everything inside the Founder Club</h2>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {BENEFITS.map((b, i) => (
              <div key={b} className="card-elevated rounded-2xl p-5 flex items-start gap-3 reveal" style={{ transitionDelay: `${i * 30}ms` }}>
                <CheckCircle2 className="h-5 w-5 brand-emerald shrink-0 mt-0.5" />
                <span className="text-slate-700 font-medium">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SAVINGS EXAMPLES */}
      <section className="py-20 bg-[#FFFCF5]">
        <div className="max-w-5xl mx-auto px-5 lg:px-8">
          <h2 className="font-display text-3xl lg:text-4xl font-semibold text-slate-900">What members typically save</h2>
          <div className="mt-8 card-elevated rounded-3xl overflow-hidden">
            {SAVINGS.map((s) => (
              <div key={s.label} className="flex items-center justify-between px-6 py-4 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-3 text-slate-700"><TrendingUp className="h-4 w-4 brand-emerald" /> {s.label}</div>
                <div className="font-semibold text-slate-900">{s.amount}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MEMBERSHIP COMPARISON */}
      <section className="py-20 bg-[#F8F3E8]">
        <div className="max-w-4xl mx-auto px-5 lg:px-8">
          <h2 className="font-display text-3xl lg:text-4xl font-semibold text-slate-900">Standard vs Founder Club</h2>
          <div className="mt-8 card-elevated rounded-3xl overflow-hidden">
            <div className="grid grid-cols-3 bg-[#0F2A2A] text-white text-sm font-semibold px-6 py-4">
              <div>Feature</div><div className="text-center">Standard</div><div className="text-center">Founder Club</div>
            </div>
            {COMPARISON.map((row) => (
              <div key={row.feature} className="grid grid-cols-3 px-6 py-3.5 border-b border-slate-100 last:border-0 text-sm">
                <div className="text-slate-700">{row.feature}</div>
                <div className="text-center text-slate-400">{row.free}</div>
                <div className="text-center font-semibold brand-emerald">{row.founder}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-[#FFFCF5]">
        <div className="max-w-3xl mx-auto px-5 lg:px-8">
          <h2 className="font-display text-3xl lg:text-4xl font-semibold text-slate-900">Founder Club FAQs</h2>
          <div className="mt-8 space-y-4">
            {FAQS.map((f) => (
              <div key={f.q} className="card-elevated rounded-2xl p-6">
                <div className="font-semibold text-slate-900">{f.q}</div>
                <p className="mt-2 text-slate-600 text-sm leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-[#0F2A2A] text-white">
        <div className="max-w-4xl mx-auto px-5 lg:px-8 text-center">
          <Crown className="h-8 w-8 text-[#F0C674] mx-auto" />
          <h2 className="mt-4 font-display text-3xl lg:text-5xl font-semibold">Become a founding member today</h2>
          <p className="mt-4 text-[#A9C0BB] max-w-xl mx-auto">Only the first 500 founders lock the one-time AED 999 price. Start saving from day one.</p>
          <Button data-testid="founder-join-cta" onClick={buyNow} disabled={buying} className="mt-7 rounded-full px-8 h-12 bg-[#F0C674] text-[#0F2A2A] hover:bg-[#e6b95c]">
            {buying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting…</> : <>Join the Founder Club — AED 999 <ArrowRight className="h-4 w-4 ml-2" /></>}
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
