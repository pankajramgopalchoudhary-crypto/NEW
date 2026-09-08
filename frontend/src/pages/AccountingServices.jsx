import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';
import { servicesApi, paymentsApi, ordersApi } from '../lib/backendApi';
import { createServiceOrder } from '../lib/checkoutSupabase';
import { CheckCircle2, Loader2, Calculator, FileCheck2, BookOpenCheck, ShieldCheck, Receipt, ArrowRight } from 'lucide-react';

const ICONS = {
  'corporate-tax-registration': Calculator,
  'corporate-tax-filing': FileCheck2,
  auditing: ShieldCheck,
  bookkeeping: BookOpenCheck,
  'vat-filing': Receipt,
};

const money = (value) => `AED ${Number(value || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AccountingServices() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState([]);
  const [auditTier, setAuditTier] = useState('up-to-5m');
  const [couponCode, setCouponCode] = useState(() => params.get('coupon')?.toUpperCase() || '');
  const [busy, setBusy] = useState(false);
  const [founder, setFounder] = useState({ member: false, service_pct: 0 });

  useEffect(() => {
    if (!user?.email) return;
    ordersApi.founderStatus(user.email).then(setFounder).catch(() => {});
  }, [user?.email]);

  useEffect(() => {
    let alive = true;
    servicesApi.list()
      .then((d) => alive && setServices((d.services || []).filter((s) => s.category !== 'membership')))
      .catch((e) => alive && setError(e.message || 'Could not load services'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const serviceBySlug = useMemo(() => Object.fromEntries(services.map((service) => [service.slug, service])), [services]);
  const getPrice = (service) => service?.slug === 'auditing'
    ? (service.pricing_options || []).find((option) => option.id === auditTier)
    : service;
  const isSelected = (slug) => selected.includes(slug);
  const toggle = (slug) => setSelected((prev) => (prev.includes(slug) ? prev.filter((item) => item !== slug) : [...prev, slug]));

  const selectedItems = useMemo(() => selected.map((slug) => ({
    slug,
    service_variant: slug === 'auditing' ? auditTier : null,
  })), [selected, auditTier]);

  const total = selected.reduce((sum, slug) => {
    const service = serviceBySlug[slug];
    const price = getPrice(service);
    return sum + Number(price?.annual ?? price?.price_aed ?? 0);
  }, 0);

  const founderTotal = founder.member ? total * (1 - Number(founder.service_pct || 0) / 100) : total;
  const buy = async (items = selectedItems) => {
    if (!items.length) return toast({ title: 'Pick at least one service' });
    if (!user) { navigate('/login?next=/accounting'); return; }
    setBusy(true);
    try {
      const order = await createServiceOrder({
        slugs: items,
        couponCode,
        contact: { name: user.user_metadata?.full_name || user.email, email: user.email },
        user,
      });
      const res = await paymentsApi.createSession({
        order_ref: order.id,
        amount_aed: order.final_total,
        currency: 'AED',
        customer_email: user.email,
        description: `SmartSetupUAE — ${order.package_name}`,
        origin_url: window.location.origin,
      });
      if (res?.url) window.location.href = res.url;
      else throw new Error('No checkout URL returned');
    } catch (e) {
      toast({ title: 'Could not start checkout', description: e.message || 'Please try again.' });
      setBusy(false);
    }
  };

  return (
    <div data-testid="accounting-services-page">
      <Navbar />
      <section className="hero-gradient grain">
        <div className="max-w-6xl mx-auto px-5 pt-20 pb-16">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[#A9C0BB] font-semibold">Accounting · Tax · Audit · VAT</div>
          <h1 className="mt-5 font-display text-4xl sm:text-5xl lg:text-6xl font-semibold text-white leading-[1.05] max-w-3xl">Stay compliant<br /><span className="shine-text">without a finance team.</span></h1>
          <p className="mt-6 text-base md:text-lg text-[#A9C0BB] max-w-2xl">Annual compliance services with transparent monthly equivalents. Auditing is priced by yearly turnover and billed annually.</p>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-5">
          {founder.member && <div className="mb-8 rounded-2xl border border-[#0A3D34]/20 bg-[#0A3D34]/[0.04] px-5 py-4" data-testid="founder-member-banner"><span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#0A3D34]">Founder Club</span><span className="ml-3 text-sm text-slate-700">Original prices are shown beside your {founder.service_pct}% discounted member price.</span></div>}
          {!founder.member && user && <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><span className="text-sm text-slate-700">Founder Club members get 15% off these services and see the saving before checkout.</span><button onClick={() => navigate('/founder-club')} className="text-sm font-semibold text-[#0A3D34] underline whitespace-nowrap">Join for AED 999 →</button></div>}

          {loading && <div className="flex items-center gap-2 text-slate-500" data-testid="services-loading"><Loader2 className="h-4 w-4 animate-spin" /> Loading live pricing…</div>}
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" data-testid="services-error">{error}</div>}

          <div className="grid gap-5 md:grid-cols-2">
            {services.map((svc) => {
              const Icon = ICONS[svc.slug] || Calculator;
              const chosenPrice = getPrice(svc);
              const annual = chosenPrice?.annual ?? svc.price_aed;
              const discounted = founder.member ? Number(annual) * (1 - Number(founder.service_pct || 0) / 100) : Number(annual);
              const selectedCard = isSelected(svc.slug);
              return (
                <div key={svc.slug} data-testid={`service-card-${svc.slug}`} className={`rounded-3xl border p-7 transition-colors duration-200 ${selectedCard ? 'border-[#0A3D34] bg-[#0A3D34]/[0.03]' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <div className="flex items-start justify-between gap-4"><div className="h-11 w-11 rounded-2xl bg-[#0A3D34]/8 flex items-center justify-center"><Icon className="h-5 w-5 text-[#0A3D34]" /></div><button type="button" onClick={() => toggle(svc.slug)} data-testid={`service-select-${svc.slug}`} className={`text-[10px] uppercase tracking-[0.18em] font-bold px-3 py-1.5 rounded-full ${selectedCard ? 'bg-[#0A3D34] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{selectedCard ? 'Selected' : 'Select'}</button></div>
                  <h2 className="mt-5 font-display text-base md:text-lg font-semibold text-slate-900">{svc.name}</h2>
                  {svc.slug === 'auditing' && <select value={auditTier} onChange={(e) => setAuditTier(e.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700" aria-label="Audit turnover band">{(svc.pricing_options || []).map((option) => <option key={option.id} value={option.id} disabled={option.on_request}>{option.label}{option.on_request ? ' · quote required' : ` · ${money(option.monthly)}/month`}</option>)}</select>}
                  <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1"><div className="font-display text-3xl font-semibold text-slate-900" data-testid={`service-price-${svc.slug}`}>{chosenPrice?.on_request ? 'Quote required' : money(discounted)}</div>{founder.member && !chosenPrice?.on_request && <div className="text-base text-slate-400 line-through">{money(annual)}</div>}</div>
                  {!chosenPrice?.on_request && <div className="text-sm text-[#0A3D34] font-semibold mt-1" data-testid={`service-label-${svc.slug}`}>{svc.monthly_equivalent ? `${money(founder.member ? svc.monthly_equivalent * (1 - founder.service_pct / 100) : svc.monthly_equivalent)}/month equivalent · billed annually` : svc.price_label}{founder.member && ` · ${founder.service_pct}% off`}</div>}
                  <p className="mt-4 text-sm text-slate-600 leading-relaxed">{svc.description}</p>
                  <ul className="mt-5 space-y-2">{(svc.features || []).map((f) => <li key={f} className="flex gap-2 text-sm text-slate-700"><CheckCircle2 className="h-4 w-4 text-[#0A3D34] shrink-0 mt-0.5" /> {f}</li>)}</ul>
                  <Button onClick={() => buy([{ slug: svc.slug, service_variant: svc.slug === 'auditing' ? auditTier : null }])} disabled={busy || chosenPrice?.on_request} data-testid={`service-buy-${svc.slug}`} className="mt-6 w-full rounded-full bg-[#0A3D34] hover:bg-[#062A24] text-white">{busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting…</> : <>Buy annually <ArrowRight className="h-4 w-4 ml-2" /></>}</Button>
                </div>
              );
            })}
          </div>

          {serviceBySlug.bookkeeping && <div className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" data-testid="recommended-services"><div><div className="text-[10px] uppercase tracking-[0.2em] text-amber-700 font-bold">Frequently added by customers</div><div className="font-display text-xl font-semibold text-slate-900 mt-1">Add Bookkeeping + VAT Filing to stay fully compliant</div><div className="text-sm text-slate-600 mt-1">Both are annual services; the page shows monthly equivalents and checkout bills the full year.</div></div><Button onClick={() => { setSelected((prev) => [...new Set([...prev, 'bookkeeping', ...(serviceBySlug['vat-filing'] ? ['vat-filing'] : [])])]); }} className="rounded-full bg-[#0A3D34] text-white">Add recommended services</Button></div>}

          {selected.length > 0 && <div className="mt-8 rounded-3xl border border-[#0A3D34]/15 bg-[#0A3D34]/[0.04] p-6 flex flex-col gap-4"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div><div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">{selected.length} services selected · annual checkout</div><div className="font-display text-2xl font-semibold text-slate-900 mt-1">{money(founderTotal)} {founder.member && <span className="text-base text-slate-400 line-through ml-2">{money(total)}</span>}</div>{founder.member && <div className="text-sm text-[#0A3D34] font-semibold">You save {money(total - founderTotal)} with Founder Club</div>}</div><Button onClick={() => buy()} disabled={busy} data-testid="service-bundle-buy" className="rounded-full bg-[#0A3D34] hover:bg-[#062A24] text-white px-7">{busy ? 'Starting…' : <>Checkout annual services <ArrowRight className="h-4 w-4 ml-2" /></>}</Button></div><div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center"><label className="text-xs font-semibold text-slate-600" htmlFor="coupon-code">Coupon</label><input id="coupon-code" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="Optional private code" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /><span className="text-xs text-slate-500">Eligible service coupons are applied at checkout.</span></div></div>}
        </div>
      </section>
      <Footer />
    </div>
  );
}
