import React, { useEffect, useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PageFAQ from '../components/PageFAQ';
import { faqMainland } from '../constants/pageFaqs';
import LeadBox from '../components/LeadBox';
import { MAINLAND_ZONES } from '../data/zones';
import { Button } from '../components/ui/button';
import { CheckCircle2, XCircle, Building, ShieldCheck, Briefcase, Globe, Sparkles, ArrowRight, ChevronRight, Clock, AlertCircle } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { loadFreezonePricingBundle } from '../lib/pricingService';

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function packagePrice(pkg) {
  return Number(pkg?.base_price || pkg?.total_with_service || pkg?.raw?.total_aed || pkg?.raw?.price || 0) || 0;
}

function packageVisaCount(pkg) {
  return Number(pkg?.visa_count || pkg?.includes_visa || pkg?.raw?.visa_quota || pkg?.raw?.visas || 0) || 0;
}

function matchesMainlandPackage(pkg, zone) {
  const haystack = [
    pkg?.slug,
    pkg?.freezone_name,
    pkg?.package_name,
    pkg?.category,
    pkg?.raw?.freezone,
    pkg?.raw?.freezone_name,
    pkg?.raw?.jurisdiction,
    pkg?.raw?.authority,
    pkg?.raw?.emirate,
    pkg?.raw?.slug,
  ].filter(Boolean).join(' ').toLowerCase();

  if (!haystack) return false;
  const emirate = String(zone?.emirate || zone?.loc || '').toLowerCase();
  const zoneSlug = String(zone?.slug || '').toLowerCase();

  return (
    haystack.includes('mainland') ||
    haystack.includes('ded') ||
    haystack.includes(zoneSlug) ||
    (emirate && haystack.includes(emirate))
  );
}

export default function Mainland() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(0);
  const [pricingBundle, setPricingBundle] = useState({ packages: [], benefits: [], addons: [], discounts: [] });
  const [pricingStatus, setPricingStatus] = useState('loading');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const zone = MAINLAND_ZONES[selected];

  useEffect(() => {
    let cancelled = false;
    setPricingStatus('loading');
    loadFreezonePricingBundle()
      .then((bundle) => {
        if (cancelled) return;
        setPricingBundle(bundle);
        setPricingStatus('loaded');
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('[mainland] Live Supabase pricing unavailable:', error.message);
        setPricingBundle({ packages: [], benefits: [], addons: [], discounts: [] });
        setPricingStatus('fallback');
      });
    return () => { cancelled = true; };
  }, []);

  const mainlandPackages = useMemo(() => {
    return (pricingBundle.packages || [])
      .filter((pkg) => matchesMainlandPackage(pkg, zone))
      .sort((a, b) => packagePrice(a) - packagePrice(b));
  }, [pricingBundle.packages, zone]);

  const selectedPackage = useMemo(() => {
    return mainlandPackages.find((pkg) => String(pkg.package_id || pkg.id) === selectedPackageId) || mainlandPackages[0] || null;
  }, [mainlandPackages, selectedPackageId]);

  useEffect(() => {
    setSelectedPackageId('');
  }, [selected]);

  const liveStartingPrice = selectedPackage ? packagePrice(selectedPackage) : 0;
  const fallbackStartingPrice = Math.min(...zone.licenceTypes.map((lt) => lt.price));
  const heroStartingPrice = liveStartingPrice || fallbackStartingPrice;

  const benefits = [
    { icon: Globe, t: 'Trade anywhere in UAE', d: 'No restrictions on where you operate, sign contracts or open branches.' },
    { icon: Briefcase, t: 'Government contracts', d: 'Eligible to bid for UAE federal and emirate-level tenders.' },
    { icon: ShieldCheck, t: '100% foreign ownership', d: 'Across most professional and commercial activities under the latest reform.' },
    { icon: Building, t: 'Multiple branch offices', d: 'Open additional branches across emirates under a single trade name.' },
  ];

  const reserveMainlandSlot = (pkg = selectedPackage) => {
    const fallbackLicence = zone.licenceTypes[0];
    const total = pkg ? packagePrice(pkg) : fallbackLicence.price;
    navigate('/checkout', { state: { order: {
      zone_slug: pkg?.slug || zone.slug,
      zone_name: pkg?.freezone_name || zone.name,
      mode: 'mainland',
      visa_count: pkg ? packageVisaCount(pkg) : 1,
      office_type: pkg?.workspace || 'Mainland office / Ejari as per package',
      addons: [],
      total_aed: total,
      package_id: pkg?.package_id || pkg?.id || fallbackLicence.id,
      package_name: pkg?.package_name || fallbackLicence.label,
      contact: { name: '', email: '', phone: '' },
      business: { activity: '', company_names: ['', '', ''], shareholders: 1 },
    }}});
  };

  return (
    <div>
      <Navbar />
      {/* HERO */}
      <section className="hero-gradient grain">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 pt-8 lg:pt-12 pb-16 grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7">
            <nav className="flex items-center gap-1.5 text-sm text-slate-600 fade-up">
              <Link to="/" className="hover:brand-emerald">Home</Link>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-semibold text-slate-900">Mainland</span>
            </nav>
            <div className="mt-5 flex items-center gap-2 fade-up delay-100"><Sparkles className="h-4 w-4 brand-bronze" /><span className="text-xs uppercase tracking-[0.22em] text-slate-600 font-semibold">Mainland Company Formation</span></div>
            <h1 className="mt-4 font-display text-5xl lg:text-7xl font-semibold leading-[1.02] text-slate-900 fade-up delay-200">Trade across the UAE<br /><span className="shine-text">without restrictions.</span></h1>
            <p className="mt-5 text-lg text-slate-600 max-w-2xl fade-up delay-300">A mainland licence lets you sell to government, sign large UAE contracts and open offices anywhere in the country. Starting from AED {heroStartingPrice.toLocaleString()}.</p>
            <div className="mt-4 text-xs text-slate-500 fade-up delay-300">
              {mainlandPackages.length > 0 ? 'Live Supabase mainland pricing connected.' : 'Static fallback shown until Mainland package rows are returned by Supabase.'}
            </div>
            <div className="mt-7 flex flex-wrap gap-3 fade-up delay-400">
              <Button data-testid="mainland-quote-btn" onClick={() => reserveMainlandSlot()} className="btn-primary rounded-full px-7 h-12">Get Mainland Quote <ArrowRight className="h-4 w-4 ml-2" /></Button>
              <Button onClick={() => navigate('/mainland-vs-freezone')} variant="outline" className="rounded-full px-7 h-12 border-slate-300">Mainland vs Free Zone</Button>
            </div>
          </div>
          <div className="lg:col-span-5 lg:sticky lg:top-24 self-start">
            <LeadBox sourcePage="mainland" freezoneName="Mainland" />
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="py-20 bg-[#FFFCF5]">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((b, i) => (
            <div key={b.t || i} className="card-elevated rounded-2xl p-6 reveal" style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="h-11 w-11 rounded-xl bg-emerald-50 grid place-items-center"><b.icon className="h-5 w-5 brand-emerald" /></div>
              <div className="font-display text-lg font-semibold text-slate-900 mt-4">{b.t}</div>
              <p className="text-sm text-slate-600 mt-1.5">{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MAINLAND BY EMIRATE */}
      <section className="py-20 bg-[#F8F3E8]">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <div className="text-center max-w-2xl mx-auto reveal">
            <div className="text-[11px] uppercase tracking-[0.22em] font-semibold brand-bronze">Compare by Emirate</div>
            <h2 className="mt-3 font-display text-4xl lg:text-5xl font-semibold text-slate-900 leading-[1.05]">Mainland licence — every emirate</h2>
          </div>
          <div className="mt-8 flex gap-2 justify-center flex-wrap">
            {MAINLAND_ZONES.map((z, i) => (
              <button key={z.id} onClick={() => setSelected(i)} className={`text-sm font-semibold px-5 py-2.5 rounded-full transition ${selected === i ? 'btn-primary shadow-lg' : 'bg-white border border-slate-200 text-slate-700 hover:border-emerald-900/30'}`}>
                {z.name}
              </button>
            ))}
          </div>

          <div className="mt-10 card-elevated rounded-3xl p-8 lg:p-10 fade-up" key={zone.id}>
            <div className="grid lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5">
                <div className="text-[10px] uppercase tracking-[0.22em] font-semibold brand-emerald">Authority</div>
                <div className="font-display text-3xl font-semibold text-slate-900 mt-1">{zone.name}</div>
                <div className="text-sm text-slate-500 mt-1">{zone.fullName}</div>
                <div className="mt-5 flex items-center gap-4 text-sm flex-wrap">
                  <div className="flex items-center gap-1 text-slate-700"><Clock className="h-4 w-4 brand-emerald" /> {zone.proc}</div>
                  <div className="flex items-center gap-1 text-slate-700"><Building className="h-4 w-4 brand-emerald" /> {zone.acts} activities</div>
                </div>
                <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-900/10">
                  <div className="text-[11px] uppercase tracking-[0.22em] font-semibold brand-emerald">SmartSetupUAE note</div>
                  <p className="text-sm text-slate-700 mt-1">{zone.highlight}</p>
                </div>
              </div>
              <div className="lg:col-span-7">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-slate-500">Live Mainland packages</div>
                  <div className="text-xs text-slate-500">{pricingStatus === 'loading' ? 'Loading Supabase…' : `${mainlandPackages.length} matched rows`}</div>
                </div>
                {mainlandPackages.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {mainlandPackages.map((pkg) => {
                      const key = String(pkg.package_id || pkg.id);
                      const active = key === String(selectedPackage?.package_id || selectedPackage?.id);
                      return (
                        <button key={key} type="button" onClick={() => setSelectedPackageId(key)} className={`w-full text-left p-4 rounded-xl border transition-colors ${active ? 'border-emerald-500 bg-emerald-50/60' : 'border-slate-200 hover:border-emerald-900/30 bg-white'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-semibold text-slate-900">{pkg.package_name}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{pkg.workspace || pkg.duration || 'Mainland package'} · {packageVisaCount(pkg)} visas</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-display text-xl font-bold text-slate-900">AED {packagePrice(pkg).toLocaleString()}</div>
                              <div className="text-[10px] text-slate-500">live Supabase</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex gap-3">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">No live Mainland rows returned yet.</div>
                      <p className="mt-1">The page remains safe with static fallback pricing below. Once Supabase returns Mainland package rows, this section will automatically replace the fallback cards.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8">
              <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-slate-500">Fallback licence types</div>
              <div className="mt-3 grid md:grid-cols-3 gap-3">
                {zone.licenceTypes.map((lt) => (
                  <button key={lt.id} type="button" onClick={() => reserveMainlandSlot({ id: lt.id, package_name: lt.label, freezone_name: zone.name, slug: zone.slug, base_price: lt.price, workspace: 'Mainland licence', visa_count: 1 })} className="text-left p-4 rounded-xl border border-slate-200 hover:border-emerald-900/30 transition-colors bg-white">
                    <div className="font-semibold text-slate-900">{lt.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{lt.desc}</div>
                    <div className="font-display text-xl font-bold text-slate-900 mt-3">AED {lt.price.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-500">fallback until official live row selected</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 grid md:grid-cols-2 gap-5">
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] font-semibold brand-emerald">Pros</div>
                <ul className="mt-2 space-y-2 text-sm">
                  {zone.pros.map((p) => (<li key={`pro-${p}`} className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 brand-emerald shrink-0 mt-0.5" /><span className="text-slate-700">{p}</span></li>))}
                </ul>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] font-semibold brand-bronze">Things to consider</div>
                <ul className="mt-2 space-y-2 text-sm">
                  {zone.cons.map((c) => (<li key={`con-${c}`} className="flex items-start gap-2"><XCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" /><span className="text-slate-700">{c}</span></li>))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section className="py-20 bg-[#FFFCF5]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <div className="text-[11px] uppercase tracking-[0.22em] font-semibold brand-bronze">Step-by-step</div>
            <h2 className="mt-3 font-display text-4xl lg:text-5xl font-semibold text-slate-900">Mainland setup process</h2>
          </div>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {[
              { n: '01', t: 'Activity & name', d: 'Confirm DED-approved activity and reserve trade name (initial approval).' },
              { n: '02', t: 'MoA & lease', d: 'Sign MoA / LSA agreement (if needed). Provide Ejari office address.' },
              { n: '03', t: 'Licence + visa', d: 'Receive DED trade licence. Apply investor visa, Emirates ID and bank account.' },
            ].map((s, i) => (
              <div key={s.n} className="card-elevated rounded-2xl p-6 reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="font-display text-4xl font-bold brand-emerald">{s.n}</div>
                <div className="font-display text-xl font-semibold text-slate-900 mt-2">{s.t}</div>
                <p className="text-sm text-slate-600 mt-1">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <PageFAQ title="Mainland (DED) Licence — Common questions" intro="Mainland trade licences, cost in 2026, mainland vs free zone, visas, banking and renewals." items={faqMainland} testId="faq-mainland" />
      <Footer />
    </div>
  );
}
