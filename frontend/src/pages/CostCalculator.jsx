import React, { useEffect, useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { loadCheckoutPricing, getVisaPrice } from '../lib/checkoutSupabase';
import { Calculator, Sparkles, CheckCircle2, ChevronRight, Phone, Tag, Building2, Calendar, BadgePercent } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Base DURATION_OPTIONS — used only as a fallback when a zone has NO
// `package_discounts` rows. If the zone offers real multi-year discounts,
// those rows override these defaults.
const DURATION_OPTIONS_FALLBACK = [
  { id: '1y', label: '1 Year', years: 1, discountPct: 0 },
];

const OFFICE_OPTIONS = [
  { id: 'virtual', label: 'Virtual Desk', priceAdj: 0, note: 'Lowest cost. Most free zones.' },
  { id: 'flexi', label: 'Flexi Desk', priceAdj: 1500, note: 'Shared workspace access.' },
  { id: 'warehouse', label: 'Warehouse / Industrial', priceAdj: 8500, note: 'Physical storage / industrial use.' },
];

// Simple in-app coupon catalog as a fallback when Supabase coupons table isn't present.
const COUPON_CATALOG = [
  { code: 'WELCOME5', percent: 5, label: '5% off setup' },
  { code: 'FOUNDER10', percent: 10, label: '10% off — founders only' },
  { code: 'EARLY15', percent: 15, label: '15% off — early bird' },
];

// Free add-ons we always offer alongside paid options. Shown with FREE badge.
const FREE_ADDONS = [
  { id: 'name-reservation', label: 'Trade Name Reservation', price: 0, free: true, note: 'We reserve up to 3 preferred names with the authority. No charge.' },
  { id: 'consult-call', label: '1-on-1 Advisor Call (30 min)', price: 0, free: true, note: 'Pre-setup consultation with a licensed UAE advisor.' },
];

export default function CostCalculator() {
  const navigate = useNavigate();
  const [zones, setZones] = useState([]);
  const [addonOptions, setAddonOptions] = useState([]);
  const [packageDiscounts, setPackageDiscounts] = useState([]); // per-zone multi-year discounts from Supabase
  const [zoneId, setZoneId] = useState('');
  const [visas, setVisas] = useState(1);
  const [addons, setAddons] = useState({});
  const [pricingError, setPricingError] = useState('');
  const [durationId, setDurationId] = useState('1y');
  const [officeId, setOfficeId] = useState('virtual');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponMessage, setCouponMessage] = useState('');
  const [founderClubActive, setFounderClubActive] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setFounderClubActive(localStorage.getItem('ssu_founder_club') === '1');
    } catch (err) {
      console.warn('[calc] could not read founder club flag', err);
      setFounderClubActive(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadCheckoutPricing()
      .then((pricing) => {
        if (cancelled) return;
        setZones(pricing.zones);
        // Strip AED-0 paid addons (user said "many show 0 AED so why is it there")
        // and inject our two free addons (Name Reservation, Advisor Call) at the top
        // so they're always visible but clearly marked FREE.
        const paid = (pricing.addons || []).filter((a) => Number(a.price || 0) > 0);
        setAddonOptions([...FREE_ADDONS, ...paid]);
        setZoneId((current) => current || pricing.zones[0]?.selection_id || pricing.zones[0]?.id || '');
        setPricingError('');
      })
      .catch((error) => {
        if (!cancelled) setPricingError(error.message || 'Live pricing could not be loaded from Supabase.');
      });
    // Also load multi-year discounts directly from Supabase
    const supaUrl = process.env.REACT_APP_SUPABASE_URL;
    const supaKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
    if (supaUrl && supaKey) {
      fetch(`${supaUrl}/rest/v1/package_discounts?select=*&is_active=eq.true&limit=200`, {
        headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` },
      })
        .then((r) => (r.ok ? r.json() : []))
        .then((rows) => { if (!cancelled) setPackageDiscounts(rows || []); })
        .catch((err) => { if (!cancelled) console.warn('[calc] package discounts load failed', err); });
    }
    return () => { cancelled = true; };
  }, []);

  const zone = zones.find((z) => (z.selection_id || z.id) === zoneId) || null;

  // Build duration options dynamically per zone using package_discounts.
  // Schema: package_discounts(package_id, years, discount_pct, is_active)
  // If the selected zone has rows, build options from them; otherwise show 1-year only.
  const durationOptions = useMemo(() => {
    if (!zone) return DURATION_OPTIONS_FALLBACK;
    const zoneKey = String(zone.package_id || zone.selection_id || zone.id || '').toLowerCase();
    const zoneSlug = String(zone.slug || zone.zone_slug || '').toLowerCase();
    const matching = packageDiscounts.filter((d) => {
      const pid = String(d.package_id || '').toLowerCase();
      const zs  = String(d.zone_slug || d.freezone || '').toLowerCase();
      return (pid && pid === zoneKey) || (zs && zoneSlug && zs.includes(zoneSlug));
    });
    const opts = [{ id: '1y', label: '1 Year', years: 1, discountPct: 0 }];
    matching.forEach((d) => {
      const years = Number(d.years || d.duration_years || 1);
      const pct = Number(d.discount_pct || d.percent || 0);
      if (years > 1 && pct > 0 && !opts.find((o) => o.years === years)) {
        opts.push({ id: `${years}y`, label: `${years} Years`, years, discountPct: pct });
      }
    });
    return opts.sort((a, b) => a.years - b.years);
  }, [zone, packageDiscounts]);

  const zoneOffersDiscount = durationOptions.length > 1;

  // Reset duration if current selection no longer exists for this zone.
  useEffect(() => {
    if (!durationOptions.find((d) => d.id === durationId)) {
      setDurationId(durationOptions[0]?.id || '1y');
    }
  }, [durationOptions, durationId]);

  const duration = durationOptions.find((d) => d.id === durationId) || durationOptions[0] || DURATION_OPTIONS_FALLBACK[0];
  const office = OFFICE_OPTIONS.find((o) => o.id === officeId) || OFFICE_OPTIONS[0];

  // Per-zone visa cap. Falls back to 5 if zone is missing.
  const maxVisas = Math.max(0, Number(zone?.visa_quota || zone?.raw?.visa_count || 5));

  // Clamp visas when zone changes.
  useEffect(() => {
    setVisas((v) => Math.min(v, maxVisas));
  }, [maxVisas]);

  const breakdown = useMemo(() => {
    const items = [];
    const baseGov = (zone?.gov || 0) * duration.years;
    if (zone) {
      items.push({
        l: `${zone.name}${zone.package_name ? ' · ' + zone.package_name : ''} — Trade Licence × ${duration.years}y`,
        v: baseGov,
        type: 'gov',
      });
    }
    if (visas > 0) {
      items.push({
        l: `Investor visa setup × ${visas}`,
        v: getVisaPrice(zone?.name) * visas,
        type: 'gov',
      });
    }
    if (office.priceAdj > 0) {
      items.push({
        l: `Office upgrade — ${office.label}`,
        v: office.priceAdj,
        type: 'addon',
      });
    }
    if (zone) {
      items.push({
        l: 'SmartSetupUAE service & advisory',
        v: zone.svc || 0,
        type: 'svc',
      });
    }
    Object.entries(addons).forEach(([id, count]) => {
      if (count > 0) {
        const a = addonOptions.find((x) => x.id === id);
        if (a) items.push({ l: `${a.label} × ${count}`, v: a.price * count, type: 'addon' });
      }
    });

    const subtotal = items.reduce((s, x) => s + x.v, 0);
    const durationDiscount = Math.round((subtotal * duration.discountPct) / 100);
    const couponDiscount = appliedCoupon
      ? Math.round(((subtotal - durationDiscount) * appliedCoupon.percent) / 100)
      : 0;
    const total = Math.max(0, subtotal - durationDiscount - couponDiscount);

    return { items, subtotal, durationDiscount, couponDiscount, total };
  }, [zone, visas, addons, addonOptions, duration, office, appliedCoupon]);

  const toggleAddon = (id, delta) => {
    setAddons((a) => {
      const next = Math.max(0, (a[id] || 0) + delta);
      return { ...a, [id]: next };
    });
  };

  const applyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setAppliedCoupon(null);
      setCouponMessage('');
      return;
    }
    // Phase 20: ONE coupon at a time — if a coupon is already applied, the user
    // must clear it first. Founder Club members already get baked-in benefits
    // (advisor priority + Year-2 discount) and CANNOT stack a fresh discount
    // on the first order; their discount kicks in on renewal.
    if (appliedCoupon && appliedCoupon.code === code) {
      setCouponMessage(`${appliedCoupon.label} is already applied`);
      return;
    }
    if (appliedCoupon) {
      setCouponMessage(`Remove "${appliedCoupon.code}" first — only one coupon per order`);
      return;
    }
    const found = COUPON_CATALOG.find((c) => c.code === code);
    if (found) {
      // Block Founder Club promo + cart coupon double-dipping
      if (founderClubActive && found.code !== 'FOUNDER_RENEWAL') {
        setCouponMessage('Founder Club members enjoy lifetime perks on the first order — your discount kicks in on renewal.');
        return;
      }
      setAppliedCoupon(found);
      setCouponMessage(`✓ ${found.label} applied`);
    } else {
      setAppliedCoupon(null);
      setCouponMessage('Invalid coupon code');
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponMessage('Coupon removed.');
  };

  const goToCheckout = () => {
    if (!zone) return;
    navigate('/checkout', {
      state: {
        order: {
          zone_slug: zone.slug,
          zone_name: zone.name,
          package_id: zone.package_id || zone.selection_id || null,
          package_name: zone.package_name || zone.name,
          mode: 'freezone',
          visa_count: Number(visas) || 0,
          office_type: office.label,
          duration: duration.label,
          duration_years: duration.years,
          coupon_code: appliedCoupon?.code || null,
          addons: Object.entries(addons).filter(([, c]) => c > 0).flatMap(([id, c]) => {
            const a = addonOptions.find((x) => x.id === id);
            return a ? Array.from({ length: c }, () => ({ id: a.id, label: a.label, price: a.price })) : [];
          }),
          total_aed: breakdown.total,
          subtotal_aed: breakdown.subtotal,
          duration_discount_aed: breakdown.durationDiscount,
          coupon_discount_aed: breakdown.couponDiscount,
          contact: { name: '', email: '', phone: '' },
          business: { activity: '', company_names: ['', '', ''], shareholders: 1 },
        },
      },
    });
  };

  return (
    <div data-testid="cost-calculator-page">
      <Navbar />
      <section className="hero-gradient grain">
        <div className="max-w-5xl mx-auto px-5 lg:px-8 pt-3 lg:pt-6 pb-9 text-center">
          <div className="flex items-center gap-2 fade-up justify-center">
            <Sparkles className="h-4 w-4 brand-bronze" />
            <span className="text-xs uppercase tracking-[0.22em] text-slate-600 font-semibold">Cost Calculator</span>
          </div>
          <h1 className="mt-5 font-display font-semibold text-slate-900 fade-up delay-100" style={{ fontSize: 'clamp(2.6rem, 5.4vw, 5rem)', lineHeight: 1.02 }}>
            Estimate your<br /><span className="shine-text">true UAE setup cost.</span>
          </h1>
          <p className="mt-5 text-slate-600 max-w-2xl mx-auto fade-up delay-200" style={{ fontSize: 'clamp(0.95rem, 1.1vw, 1.125rem)' }}>
            Live calculator connected to Supabase pricing. Pick jurisdiction, visas, office and duration — see your real number instantly. Covers <b>free zone licence cost</b>, <b>mainland LLC fees</b>, <b>investor visa</b>, <b>establishment card</b>, <b>medical &amp; Emirates ID</b> and <b>bank account opening</b>.
          </p>
          {/* Contextual SEO chips — costs/keywords users actually search */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2 fade-up delay-300">
            <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-slate-500">Calculate for:</span>
            {['IFZA Dubai cost', 'ANCFZ Ajman cheapest', 'Meydan FZ pricing', 'DMCC fee 2025', 'Mainland LLC Dubai', 'Investor visa cost', '2-year residence visa AED 400K'].map((k) => (
              <span key={k} className="text-[11.5px] px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700">{k}</span>
            ))}
          </div>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl fade-up delay-200">
            Live calculator connected to Supabase pricing. Pick jurisdiction, visas, office and duration — see your real number instantly.
          </p>
        </div>
      </section>

      <section className="pb-24 bg-[#FFFCF5]">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 grid lg:grid-cols-12 gap-8">
          {/* LEFT PANEL */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1 - Jurisdiction */}
            <div className="card-elevated rounded-2xl p-7" data-testid="calc-step-zone">
              <StepHeader step="Step 1" title="Choose your jurisdiction" />
              {pricingError ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{pricingError}</div>
              ) : (
                <Select value={zoneId} onValueChange={setZoneId}>
                  <SelectTrigger className="mt-4 h-12 rounded-lg" data-testid="calc-zone-select">
                    <SelectValue placeholder="Loading live pricing…" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((z) => (
                      <SelectItem key={z.selection_id || z.id} value={z.selection_id || z.id}>
                        {z.name}{z.package_name ? ` · ${z.package_name}` : ''} · AED {(z.gov || 0).toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {zone && (
                <p className="mt-2 text-xs text-slate-500">
                  Visa quota: <span className="font-semibold text-slate-700">Up to {maxVisas}</span>
                  {zone.workspace ? <> · Office options: <span className="text-slate-700">{zone.workspace}</span></> : null}
                </p>
              )}
            </div>

            {/* Step 2 - Duration */}
            <div className="card-elevated rounded-2xl p-7" data-testid="calc-step-duration">
              <StepHeader step="Step 2" title="License duration" icon={Calendar} />
              {!zoneOffersDiscount && (
                <p className="mt-2 text-[12px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                  This jurisdiction is billed <b>annually</b>. Multi-year prepayment discount is not offered by the authority for this package.
                </p>
              )}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {durationOptions.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDurationId(d.id)}
                    data-testid={`calc-duration-${d.id}`}
                    className={`rounded-xl p-3 text-left border transition-all ${
                      durationId === d.id
                        ? 'border-emerald-700 bg-emerald-50 ring-2 ring-emerald-700/15'
                        : 'border-slate-200 bg-white hover:border-emerald-400'
                    }`}
                  >
                    <div className="font-semibold text-slate-900 text-sm">{d.label}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {d.discountPct ? <span className="text-emerald-700 font-semibold">Save {d.discountPct}%</span> : 'Standard'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3 - Visas */}
            <div className="card-elevated rounded-2xl p-7" data-testid="calc-step-visas">
              <StepHeader step="Step 3" title="How many investor visas?" />
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => setVisas((v) => Math.max(0, v - 1))}
                  data-testid="calc-visa-minus"
                  className="h-11 w-11 rounded-full border border-slate-300 hover:border-emerald-900/30 text-lg"
                >−</button>
                <div className="font-display text-3xl font-bold w-14 text-center text-slate-900" data-testid="calc-visa-count">{visas}</div>
                <button
                  onClick={() => setVisas((v) => Math.min(maxVisas, v + 1))}
                  data-testid="calc-visa-plus"
                  disabled={visas >= maxVisas}
                  className="h-11 w-11 rounded-full border border-slate-300 hover:border-emerald-900/30 text-lg disabled:opacity-40 disabled:cursor-not-allowed"
                >+</button>
                <div className="text-sm text-slate-500 ml-2">
                  Max {maxVisas} for {zone?.name || 'this package'}
                </div>
              </div>
            </div>

            {/* Step 4 - Office */}
            <div className="card-elevated rounded-2xl p-7" data-testid="calc-step-office">
              <StepHeader step="Step 4" title="Office type" icon={Building2} />
              <div className="mt-4 grid sm:grid-cols-3 gap-2">
                {OFFICE_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setOfficeId(o.id)}
                    data-testid={`calc-office-${o.id}`}
                    className={`rounded-xl p-3 text-left border transition-all ${
                      officeId === o.id
                        ? 'border-emerald-700 bg-emerald-50 ring-2 ring-emerald-700/15'
                        : 'border-slate-200 bg-white hover:border-emerald-400'
                    }`}
                  >
                    <div className="font-semibold text-slate-900 text-sm">{o.label}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {o.priceAdj > 0 ? `+ AED ${o.priceAdj.toLocaleString()}` : 'Included'}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">{o.note}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 5 - Add-ons */}
            {addonOptions.length > 0 && (
              <div className="card-elevated rounded-2xl p-7" data-testid="calc-step-addons">
                <StepHeader step="Step 5" title="Add-on services" />
                <div className="mt-5 grid md:grid-cols-2 gap-3">
                  {addonOptions.filter((a) => !['extra_visa'].includes(a.id)).map((a) => {
                    const count = addons[a.id] || 0;
                    return (
                      <div
                        key={a.id}
                        className={`p-4 rounded-xl border transition-colors ${
                          count > 0 ? 'border-emerald-700/30 bg-emerald-50' : 'border-slate-200'
                        }`}
                        data-testid={`calc-addon-${a.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                              {a.label}
                              {a.free && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-700 text-white">FREE</span>}
                            </div>
                            <div className="text-xs text-slate-500">
                              {a.free ? <span className="text-emerald-700 font-semibold">No charge</span> : <>AED {Number(a.price || 0).toLocaleString()}{a.unit ? ` · ${a.unit}` : ''}</>}
                              {a.note ? <span className="ml-1 text-slate-400">· {a.note}</span> : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button onClick={() => toggleAddon(a.id, -1)} className="h-7 w-7 rounded-full border border-slate-300 text-sm hover:border-emerald-900/30">−</button>
                            <div className="w-5 text-center text-sm font-bold">{count}</div>
                            <button onClick={() => toggleAddon(a.id, 1)} className="h-7 w-7 rounded-full border border-slate-300 text-sm hover:border-emerald-900/30">+</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 6 - Coupon */}
            <div className="card-elevated rounded-2xl p-7" data-testid="calc-step-coupon">
              <StepHeader step="Step 6" title="Coupon code" icon={BadgePercent} />
              {founderClubActive && (
                <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-900">
                  👑 You are a <b>Founder Club</b> member. Lifetime perks + Year-2 renewal discount are already applied — first-order coupons are disabled. Renewal discount kicks in on next year&apos;s licence.
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => { setCouponInput(e.target.value); setCouponMessage(''); }}
                  placeholder="Enter ONE coupon (e.g. WELCOME5)"
                  data-testid="calc-coupon-input"
                  disabled={!!appliedCoupon}
                  className="flex-1 h-11 rounded-lg border border-slate-300 px-4 text-sm focus:outline-none focus:border-emerald-600 uppercase disabled:bg-slate-50 disabled:text-slate-500"
                />
                {appliedCoupon ? (
                  <Button onClick={removeCoupon} variant="outline" className="rounded-lg h-11 px-5 border-rose-300 text-rose-700 hover:bg-rose-50" data-testid="calc-coupon-remove">
                    Remove
                  </Button>
                ) : (
                  <Button onClick={applyCoupon} variant="outline" className="rounded-lg h-11 px-5 border-slate-300" data-testid="calc-coupon-apply">
                    Apply
                  </Button>
                )}
              </div>
              {couponMessage && (
                <p
                  data-testid="calc-coupon-msg"
                  className={`mt-2 text-xs font-semibold ${appliedCoupon ? 'text-emerald-700' : 'text-rose-600'}`}
                >
                  {couponMessage}
                </p>
              )}
              <p className="mt-2 text-[11px] text-slate-400">Try: WELCOME5 · FOUNDER10 · EARLY15 · Only one coupon per order</p>
            </div>
          </div>

          {/* RIGHT: SUMMARY */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-24 card-elevated rounded-2xl p-7" data-testid="calc-summary">
              <div className="text-[10px] uppercase tracking-[0.22em] font-semibold brand-bronze">Your estimate</div>
              <div className="flex items-baseline gap-2 mt-1">
                <div className="font-display text-5xl font-bold text-slate-900" data-testid="calc-total">
                  AED {breakdown.total.toLocaleString()}
                </div>
              </div>
              <div className="text-xs text-slate-500">
                {duration.years > 1 ? `${duration.years}-year total` : 'Year 1'} — indicative, subject to authority approvals
              </div>

              <div className="mt-5 space-y-1 max-h-72 overflow-y-auto pr-2">
                {breakdown.items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="h-3.5 w-3.5 brand-emerald shrink-0" />
                      <span className="text-slate-700 truncate">{it.l}</span>
                    </div>
                    <div className="font-semibold text-slate-900 shrink-0">AED {it.v.toLocaleString()}</div>
                  </div>
                ))}
              </div>

              <div className="mt-3 space-y-1 text-sm">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>AED {breakdown.subtotal.toLocaleString()}</span>
                </div>
                {breakdown.durationDiscount > 0 && (
                  <div className="flex items-center justify-between text-emerald-700" data-testid="calc-duration-discount">
                    <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" /> {duration.label} discount ({duration.discountPct}%)</span>
                    <span>− AED {breakdown.durationDiscount.toLocaleString()}</span>
                  </div>
                )}
                {breakdown.couponDiscount > 0 && (
                  <div className="flex items-center justify-between text-emerald-700" data-testid="calc-coupon-discount">
                    <span className="inline-flex items-center gap-1"><BadgePercent className="h-3 w-3" /> Coupon {appliedCoupon.code} ({appliedCoupon.percent}%)</span>
                    <span>− AED {breakdown.couponDiscount.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="mt-5 p-4 rounded-xl bg-emerald-50 border border-emerald-900/10">
                <div className="text-[11px] uppercase tracking-[0.22em] brand-emerald font-semibold">Reserve today</div>
                <div className="flex items-baseline gap-2">
                  <div className="font-display text-2xl font-bold text-slate-900">AED 999</div>
                  <div className="text-xs text-slate-600">refundable pre-booking</div>
                </div>
              </div>

              <Button
                data-testid="calc-reserve-btn"
                disabled={!zone || !!pricingError}
                onClick={goToCheckout}
                className="btn-primary rounded-full w-full h-12 mt-5"
              >
                Get Started · AED {breakdown.total.toLocaleString()} <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
              <Button
                onClick={() => navigate('/consultation')}
                variant="outline"
                className="rounded-full w-full h-11 mt-2 border-slate-300"
                data-testid="calc-advisor-btn"
              >
                <Phone className="h-4 w-4 mr-2" /> Talk to Advisor
              </Button>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}

function StepHeader({ step, title, icon: Icon = Calculator }) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 brand-emerald" />
        <div className="text-[10px] uppercase tracking-[0.22em] font-semibold brand-emerald">{step}</div>
      </div>
      <h3 className="font-display text-2xl font-semibold mt-2 text-slate-900">{title}</h3>
    </>
  );
}
