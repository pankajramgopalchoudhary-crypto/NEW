import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import LeadBox from '../components/LeadBox';
import PageFAQ from '../components/PageFAQ';
import { Button } from '../components/ui/button';
import { getZoneBySlug, ZONES, ADD_ONS } from '../data/zones';
import { loadFreezonePricingBundle, mergeZoneWithLivePackage, mergeZonesWithLivePackages, getZonePackages, getZoneBenefits, getZoneAddons, getZoneDiscounts } from '../lib/pricingService';
import { ChevronRight, MapPin, Clock, Users2, ShieldCheck, CheckCircle2, XCircle, Building2, Sparkles, ArrowRight, Globe, ArrowUpRight } from 'lucide-react';

// Per-freezone FAQ generator — every zone gets 6 SEO-rich, specific Q&As.
function buildZoneFaqs(zone, livePkg) {
  const name = zone?.name || 'this Free Zone';
  const emirate = zone?.loc || 'UAE';
  const price = (livePkg?.base_price || zone?.gov || 0).toLocaleString();
  const pkgName = livePkg?.package_name || 'Starter';
  const visas = livePkg?.visa_count ?? 1;
  const acts = livePkg?.activities_allowed ?? 3;
  const years = livePkg?.duration_years || 1;
  return [
    { q: `How much does a ${name} business licence cost in 2026?`,
      a: `The cheapest published ${name} package is the ${pkgName} at AED ${price} per ${years}-year term — covers ${acts} activities and ${visas} visa allocation${visas === 1 ? '' : 's'}. Add-ons (extra visas, immigration card, Establishment Card) are quoted line-by-line on checkout — never bundled into a hidden number.` },
    { q: `Which business activities are allowed in ${name}?`,
      a: `${name} supports professional, commercial and most service activities — including trading, consultancy, technology, e-commerce and media. Industrial or regulated activities (pharma, financial services) may require special approval. Use the AI Activity Search above to confirm your exact activity code against the live ${name} list.` },
    { q: `How long does it take to register a company in ${name}?`,
      a: `${name} (${emirate}) typically issues the trade licence within 3–7 working days after the KYC pack is approved. Visa stamping adds 7–10 working days (medical + Emirates ID + status change). Total realistic timeline: 2–3 weeks from signed application to a stamped passport.` },
    { q: `Can I open a UAE bank account with a ${name} licence?`,
      a: `Yes. ${name} licences are accepted by WIO, Mashreq NeoBiz, RAKBank and Emirates NBD digital. Approval usually takes 7–15 working days after KYC. We coordinate the bank introduction free of charge for Founders Club members. Bank acceptance depends more on activity, nationality and KYC quality than on the freezone itself.` },
    { q: `What is the renewal cost for ${name}?`,
      a: `${name} renewals are typically 90% of the original licence fee (no setup-only charges) plus visa renewal (medical + EID + stamping) per active visa. We send 90 / 60 / 30 / 7-day renewal reminders so you never pay a late penalty (AED 1,000+ per month overdue).` },
    { q: `Is ${name} subject to UAE Corporate Tax?`,
      a: `Yes — every UAE entity must register for Corporate Tax. However, qualifying ${name} free-zone persons (international trade, IP holding, distribution within free-zone substance) can maintain 0% Corporate Tax on qualifying income. Non-qualifying income is taxed at 9% above AED 375K. We help structure operations to maintain QFZP status.` },
  ];
}

export default function FreeZoneDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const baseZone = getZoneBySlug(slug);
  const [withVisa, setWithVisa] = useState(false);
  const [pricingBundle, setPricingBundle] = useState({ packages: [], benefits: [], addons: [], discounts: [] });
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const livePackages = pricingBundle.packages;
  const zone = mergeZoneWithLivePackage(baseZone, livePackages);
  const zonePackages = getZonePackages(pricingBundle.packages, zone);
  const selectedPackage = zonePackages.find((pkg) => String(pkg.package_id || pkg.id) === selectedPackageId) || zone.livePackage || zonePackages[0] || null;
  const zoneBenefits = getZoneBenefits(pricingBundle.benefits, zone, selectedPackage?.package_name);
  const zoneAddons = getZoneAddons(pricingBundle.addons, zone);
  const zoneDiscounts = getZoneDiscounts(pricingBundle.discounts, zone);

  const isVisaAddon = (a) => /visa/i.test(a.category || '') || /visa/i.test(a.addon_name || '');
  const visaAddons = zoneAddons.filter(isVisaAddon);
  const otherAddons = zoneAddons.filter((a) => !isVisaAddon(a));

  // Show only 3 popular packages (0 / 1 / 2 visas); rest via dropdown
  const pickCheapestByVisa = (n) =>
    zonePackages
      .filter((p) => (p.visa_count || 0) === n)
      .sort((a, b) => (a.base_price || 0) - (b.base_price || 0))[0];
  let popularPackages = [0, 1, 2].map(pickCheapestByVisa).filter(Boolean);
  // For RAKEZ, ensure we show exactly 3 prices
  if (zone.slug === 'rakez' && popularPackages.length < 3) {
    const remaining = zonePackages.filter((p) => !popularPackages.some((pp) => (pp.package_id || pp.id) === (p.package_id || p.id)));
    popularPackages = [...popularPackages, ...remaining.slice(0, 3 - popularPackages.length)];
  }
  if (popularPackages.length === 0) popularPackages = zonePackages.slice(0, 3);
  const popularKeys = new Set(popularPackages.map((p) => String(p.package_id || p.id)));
  const extraPackages = zonePackages.filter((p) => !popularKeys.has(String(p.package_id || p.id)));
  const otherZones = (ZONES || []).filter((z) => z.slug !== slug).slice(0, 4);

  useEffect(() => {
    let cancelled = false;
    loadFreezonePricingBundle()
      .then((bundle) => { if (!cancelled) setPricingBundle(bundle); })
      .catch(() => { if (!cancelled) setPricingBundle({ packages: [], benefits: [], addons: [], discounts: [] }); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [slug]);

  if (!zone) {
    return (
      <div>
        <Navbar />
        <div className="max-w-3xl mx-auto px-5 py-32 text-center">
          <h1 className="font-display text-4xl font-semibold">Free Zone not found</h1>
          <Button onClick={() => navigate('/free-zones')} className="btn-primary rounded-full mt-6">Back to Free Zones</Button>
        </div>
        <Footer />
      </div>
    );
  }

  const getPackageLabel = (pkg, z) => {
    const visas = pkg.visa_count || 0;
    if (z.slug === 'rakez') {
      const workspace = (pkg.workspace || '').toLowerCase();
      if (workspace.includes('virtual')) return `Virtual Desk · ${visas} Visa${visas === 1 ? '' : 's'}`;
      if (workspace.includes('flexi')) return `Flexi Desk · ${visas} Visa${visas === 1 ? '' : 's'}`;
      if (workspace.includes('warehouse') || workspace.includes('industrial')) return `Warehouse · ${visas} Visa${visas === 1 ? '' : 's'}`;
    }
    return `${visas === 0 ? 'Basic' : visas === 1 ? 'Growth' : 'Premium'} · ${visas} Visa${visas === 1 ? '' : 's'}`;
  };

  const selectedGovernmentTotal = Number(selectedPackage?.base_price || selectedPackage?.total_with_service || 0);
  const selectedServiceFee = Number(selectedPackage?.service_fee || 0);
  const total = selectedGovernmentTotal + selectedServiceFee;
  const ctaLabel = 'Reserve your slot';
  const reserveSlot = () => {
    const pkgId = selectedPackage?.package_id || selectedPackage?.id || '';
    const qs = new URLSearchParams({
      freezone: zone.slug,
      zone: zone.slug,
      ...(pkgId ? { package: pkgId } : {}),
    });
    navigate(`/checkout?${qs.toString()}`, {
      state: {
        order: {
          zone_slug: zone.slug,
          zone_name: zone.name,
          total_aed: total,
          package_id: pkgId || null,
          package_name: selectedPackage?.package_name || zone.livePackage?.package_name || zone.name,
          visa_count: selectedPackage?.visa_count || 0,
          addons: [],
          contact: { name: '', email: '', phone: '' },
          business: { activity: '', activities: [], company_names: ['', '', ''], shareholders: 1 },
        },
      },
    });
  };

  return (
    <div>
      <Navbar />
      {/* HERO with breadcrumb */}
      <section className="hero-gradient grain">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 pt-8 lg:pt-12 pb-16 grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-sm text-slate-600 fade-up">
              <Link to="/" className="hover:brand-emerald">Home</Link>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              <Link to="/free-zones" className="hover:brand-emerald">Free Zones</Link>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-semibold text-slate-900">{zone.name}</span>
            </nav>

            <div className="mt-5 flex flex-wrap items-center gap-2 fade-up delay-100">
              <span className="text-[10px] uppercase tracking-[0.22em] font-bold px-2.5 py-1 rounded-full bg-amber-50 brand-bronze border border-amber-200">{zone.tag || 'UAE FREE ZONE'}</span>
              <span className="flex items-center gap-1 text-sm text-slate-600"><MapPin className="h-3.5 w-3.5" /> {zone.loc}</span>
            </div>

            <h1 className="mt-4 font-display text-[44px] lg:text-[64px] leading-[1.02] font-semibold text-slate-900 fade-up delay-200">
              {zone.name}<br /><span className="shine-text text-[32px] lg:text-[44px]">{zone.fullName}</span>
            </h1>
            <p className="mt-5 text-lg text-slate-600 max-w-xl fade-up delay-300">{zone.highlight}</p>

            <div className="mt-7 flex flex-wrap items-center gap-6 fade-up delay-400">
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-semibold">From</div>
                <div className="font-display text-4xl font-bold text-slate-900">AED {zone.gov.toLocaleString()}</div>
                <div className="text-xs text-slate-500">starting package{zone.priceSource === 'supabase' ? ' · live Supabase' : ''}</div>
              </div>
              <div className="h-12 w-px bg-slate-200" />
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-semibold">Live Packages</div>
                <div className="font-display text-2xl font-bold brand-emerald">{zonePackages.length || 1}</div>
              </div>
              <div className="h-12 w-px bg-slate-200" />
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-semibold">Processing</div>
                <div className="font-semibold text-slate-800 flex items-center gap-1"><Clock className="h-4 w-4 brand-emerald" /> {zone.proc}</div>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap gap-3 fade-up delay-500">
              <Button data-testid="fz-get-quote-btn" onClick={reserveSlot} className="btn-primary rounded-full px-7 h-12">Get Your Quote <ArrowRight className="h-4 w-4 ml-2" /></Button>
              <a href={zone.officialUrl} target="_blank" rel="noreferrer"><Button variant="outline" className="rounded-full px-7 h-12 border-slate-300">Official Authority <ArrowUpRight className="h-4 w-4 ml-2" /></Button></a>
            </div>
          </div>

          {/* RIGHT: Lead Box */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 self-start">
            <LeadBox sourcePage={`freezone:${zone.slug}`} freezoneName={zone.name} />
          </div>
        </div>
      </section>

      {/* QUICK STATS */}
      <section className="py-12 bg-[#F8F3E8]">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 grid grid-cols-2 lg:grid-cols-5 gap-5">
          {[
            { l: 'Activities', v: zone.acts, i: Building2 },
            { l: 'Visa Quota', v: `${zone.maxVis} visas`, i: Users2 },
            { l: 'Ownership', v: `${zone.ownership}%`, i: ShieldCheck },
            { l: 'Corporate Tax', v: zone.corpTax ? `${zone.corpTax}%` : '0%', i: Sparkles },
            { l: 'Office', v: zone.physical, i: Globe },
          ].map((s) => (
            <div key={s.l} className="card-elevated rounded-2xl p-5 reveal">
              <div className="h-9 w-9 rounded-lg bg-emerald-50 grid place-items-center"><s.i className="h-4 w-4 brand-emerald" /></div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-semibold mt-3">{s.l}</div>
              <div className="font-display text-lg font-bold text-slate-900">{s.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* LIVE SUPABASE PACKAGES */}
      <section className="py-20 bg-[#FFFCF5]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="text-center">
            <div className="text-[11px] uppercase tracking-[0.22em] font-semibold brand-bronze">Verified pricing</div>
            <h2 className="mt-3 font-display text-4xl lg:text-5xl font-semibold text-slate-900 leading-[1.05]">Choose your package</h2>
            <p className="mt-3 text-sm text-slate-600">Transparent, up-to-date pricing. Select a package to see your total — visas and add-ons below.</p>
          </div>

          {zonePackages.length > 0 ? (
            <>
            {extraPackages.length > 0 && (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3" data-testid="package-more-dropdown">
                <span className="text-sm text-slate-500">Need a different visa count?</span>
                <select
                  className="h-10 rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  value={popularKeys.has(selectedPackageId) ? '' : selectedPackageId}
                  onChange={(e) => e.target.value && setSelectedPackageId(e.target.value)}
                  data-testid="package-select"
                >
                  <option value="">More packages ({extraPackages.length})…</option>
                  {extraPackages.map((p) => {
                    const k = String(p.package_id || p.id);
                    return <option key={k} value={k}>{p.package_name} — AED {(p.base_price || 0).toLocaleString()} · {p.visa_count || 0} visa{(p.visa_count || 0) === 1 ? '' : 's'}</option>;
                  })}
                </select>
              </div>
            )}
            <div className="mt-8 grid md:grid-cols-3 gap-5">
              {[...popularPackages, ...((popularKeys.has(selectedPackageId) || !selectedPackageId) ? [] : extraPackages.filter((p) => String(p.package_id || p.id) === selectedPackageId))].map((pkg) => {
                const key = String(pkg.package_id || pkg.id);
                const active = key === String(selectedPackage?.package_id || selectedPackage?.id);
                const price = pkg.base_price || pkg.total_with_service || 0;
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setSelectedPackageId(key)}
                    className={`text-left card-elevated rounded-3xl p-6 border transition ${active ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-transparent hover:border-slate-200'}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.22em] brand-bronze font-bold">{getPackageLabel(pkg, zone)}</div>
                        <div className="mt-1 font-display text-2xl font-semibold text-slate-900">{pkg.package_name}</div>
                        <div className="mt-1 text-sm text-slate-500">{pkg.workspace || 'Workspace as per authority package'}</div>
                      </div>
                      {active && <span className="text-xs rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 font-semibold">Selected</span>}
                    </div>
                    <div className="mt-5 rounded-2xl bg-slate-50 p-4 space-y-2.5">
                      <div className="flex items-baseline justify-between pb-2.5 border-b border-slate-200/70">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold">Package Price</div>
                        <div className="font-display text-2xl font-bold text-slate-900">AED {price.toLocaleString()}</div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="text-slate-600">Included visas</div>
                        <div className="font-display font-semibold text-slate-900">{pkg.visa_count || pkg.includes_visa || 0}</div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="text-slate-600">Validity</div>
                        <div className="font-semibold text-slate-900">{pkg.raw?.duration_years ? `${pkg.raw.duration_years} year${pkg.raw.duration_years > 1 ? 's' : ''}` : (pkg.duration || '1 year')}</div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="text-slate-600">Activities allowed</div>
                        <div className="font-semibold text-slate-900">{pkg.raw?.activities_allowed || 3}</div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="text-slate-600">Shareholders</div>
                        <div className="font-semibold text-slate-900">{(pkg.raw?.shareholder_count && pkg.raw.shareholder_count < 50) ? `Up to ${pkg.raw.shareholder_count}` : 'Up to 50'}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            </>
          ) : (
            <div className="mt-10 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
              Pricing verification in progress for this jurisdiction. Please request a quotation and our team will share verified pricing right away.
            </div>
          )}

          <div className="mt-10 card-elevated rounded-3xl p-8 lg:p-10">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] font-semibold brand-emerald">Selected total</div>
                <div className="font-display text-6xl font-bold text-slate-900 mt-1">AED {total.toLocaleString()}</div>
                <div className="text-sm text-slate-500 mt-1">{selectedPackage?.package_name || zone.name} · Year 1</div>
                <Button data-testid="fz-reserve-btn" onClick={reserveSlot} className="btn-primary rounded-full mt-6 px-6 h-11">{ctaLabel} · AED {total.toLocaleString()}</Button>
              </div>
              <div className="space-y-3">
                {[
                  { l: 'Authority/package amount', v: selectedGovernmentTotal, sub: selectedPackage?.workspace || 'Selected authority package' },
                  { l: 'SmartSetupUAE service & advisory', v: selectedServiceFee, sub: selectedServiceFee > 0 ? 'End-to-end setup' : 'Included / not configured' },
                ].map((r) => (
                  <div key={r.l} className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <div className="font-medium text-slate-800">{r.l}</div>
                      <div className="text-xs text-slate-500">{r.sub}</div>
                    </div>
                    <div className="font-display font-semibold text-slate-900">AED {r.v.toLocaleString()}</div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <div className="font-semibold text-slate-900">Total</div>
                  <div className="font-display text-2xl font-bold brand-emerald">AED {total.toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROS / CONS */}
      <section className="py-20 bg-[#F8F3E8]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 grid lg:grid-cols-2 gap-6">
          <div className="card-elevated rounded-2xl p-7">
            <div className="text-[11px] uppercase tracking-[0.22em] font-semibold brand-emerald">Why founders choose {zone.name}</div>
            <ul className="mt-4 space-y-3">
              {(zoneBenefits.length ? zoneBenefits.map((b) => b.benefit) : zone.pros).map((p) => (
                <li key={`pro-${p}`} className="flex items-start gap-3 reveal"><CheckCircle2 className="h-5 w-5 brand-emerald shrink-0 mt-0.5" /><span className="text-slate-700">{p}</span></li>
              ))}
            </ul>
          </div>
          <div className="card-elevated rounded-2xl p-7">
            <div className="text-[11px] uppercase tracking-[0.22em] font-semibold brand-bronze">What to keep in mind</div>
            <ul className="mt-4 space-y-3">
              {zone.cons.map((c) => (
                <li key={`con-${c}`} className="flex items-start gap-3 reveal"><XCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" /><span className="text-slate-700">{c}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* DETAILS */}
      <section className="py-20 bg-[#FFFCF5]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 grid md:grid-cols-3 gap-6">
          {[
            { t: 'Banking', d: zone.banking },
            { t: 'Visa & Residency', d: zone.visa },
            { t: 'Renewal Cost', d: zone.renewal },
          ].map((s) => (
            <div key={s.t} className="card-elevated rounded-2xl p-6 reveal">
              <div className="font-display text-xl font-semibold text-slate-900">{s.t}</div>
              <p className="text-slate-600 mt-2 leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* VISA OPTIONS */}
      <section className="py-16 bg-[#FFFCF5]" data-testid="visa-options-section">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <div className="max-w-2xl">
            <div className="text-[11px] uppercase tracking-[0.22em] font-semibold brand-bronze">Visa Options</div>
            <h2 className="mt-3 font-display text-3xl lg:text-4xl font-semibold text-slate-900">Investor & employee visa costs</h2>
            <p className="mt-2 text-sm text-slate-600">Add visas to any package. Transparent per-visa pricing.</p>
          </div>
          {visaAddons.length > 0 ? (
            <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visaAddons.map((a, i) => (
                <div key={a.id} className="card-elevated rounded-2xl p-5 flex items-start justify-between gap-3" data-testid={`visa-addon-${i}`}>
                  <div>
                    <div className="font-semibold text-slate-900">{a.addon_name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{a.notes || 'Per visa'}</div>
                  </div>
                  <div className="font-display text-lg font-bold brand-emerald whitespace-nowrap">AED {Number(a.price || 0).toLocaleString()}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              Visa pricing for {zone.name} is confirmed at quotation. Investor and employee visas typically range AED 3,500–6,000 per visa.
            </div>
          )}
        </div>
      </section>

      {/* ADD-ONS */}
      <section className="py-20 bg-[#F8F3E8]">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <div className="max-w-2xl reveal">
            <div className="text-[11px] uppercase tracking-[0.22em] font-semibold brand-bronze">Add-On Services</div>
            <h2 className="mt-3 font-display text-3xl lg:text-4xl font-semibold text-slate-900">Optional services with transparent rates</h2>
          </div>
          <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {(otherAddons.length ? otherAddons : ADD_ONS.slice(0, 9).map((a) => ({ id: a.id, addon_name: a.label, unit: a.unit, price: a.price, notes: a.desc }))).slice(0, 9).map((a, i) => (
              <div key={a.id} className="card-elevated rounded-2xl p-5 reveal" style={{ transitionDelay: `${i * 50}ms` }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{a.addon_name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{a.unit}</div>
                  </div>
                  <div className="font-display text-lg font-bold brand-emerald">AED {Number(a.price || 0).toLocaleString()}</div>
                </div>
                <p className="text-xs text-slate-600 mt-3 leading-relaxed line-clamp-3">{a.notes}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {zoneDiscounts.length > 0 && (
        <section className="py-16 bg-[#FFFCF5]">
          <div className="max-w-6xl mx-auto px-5 lg:px-8">
            <div className="text-[11px] uppercase tracking-[0.22em] font-semibold brand-bronze">Live discounts</div>
            <div className="mt-5 grid md:grid-cols-3 gap-4">
              {zoneDiscounts.map((d) => (
                <div key={d.id} className="card-elevated rounded-2xl p-5">
                  <div className="font-display text-2xl font-bold brand-emerald">{d.discount_percent}%</div>
                  <div className="font-semibold text-slate-900">{d.duration || d.package_name}</div>
                  <p className="text-xs text-slate-600 mt-2">{d.notes || d.applies_to}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* COMPARE OTHER */}
      <section className="py-20 bg-[#FFFCF5]">
        <div className="max-w-[1100px] mx-auto px-5 lg:px-8">
          <PageFAQ
            title={`${zone.name} — Frequently Asked Questions`}
            intro={`Costs, activities, timelines, banking, renewals and Corporate Tax — answered specifically for ${zone.name} (${zone.loc || 'UAE'}).`}
            items={buildZoneFaqs(zone, selectedPackage)}
            testId={`faq-${zone.slug || 'zone'}`}
          />
        </div>
      </section>

      <section className="py-20 bg-[#FFFCF5] rounded-t-[36px] mx-3 lg:mx-6 shadow-[0_-20px_40px_-30px_rgba(15,42,42,0.15)]">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] font-semibold brand-bronze">Compare more</div>
              <h2 className="mt-3 font-display text-3xl lg:text-4xl font-semibold text-slate-900">Other UAE free zones</h2>
            </div>
            <Link to="/free-zones" className="text-sm font-semibold brand-emerald link-underline flex items-center gap-1">View all <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {otherZones.map((z) => (
              <Link key={z.id} to={`/free-zones/${z.slug}`} className="card-elevated rounded-2xl p-5 group">
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold px-2 py-1 rounded-full bg-emerald-50 brand-emerald inline-block border border-emerald-900/10">{z.tag || 'UAE FZ'}</div>
                <div className="font-display text-lg font-semibold text-slate-900 mt-3">{z.name}</div>
                <div className="text-xs text-slate-500">{z.loc}</div>
                <div className="mt-3 text-sm text-slate-700">From <span className="font-bold">AED {z.gov.toLocaleString()}</span></div>
                <div className="mt-3 text-xs font-semibold brand-emerald group-hover:underline flex items-center gap-1">View Details <ArrowRight className="h-3 w-3" /></div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
