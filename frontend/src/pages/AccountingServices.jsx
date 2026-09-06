import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';
import { servicesApi, paymentsApi, ordersApi } from '../lib/backendApi';
import { createServiceOrder } from '../lib/checkoutSupabase';
import { CheckCircle2, Loader2, Calculator, FileCheck2, BookOpenCheck, ShieldCheck, ArrowRight } from 'lucide-react';

const ICONS = {
  'corporate-tax-registration': Calculator,
  'corporate-tax-filing': FileCheck2,
  auditing: ShieldCheck,
  bookkeeping: BookOpenCheck,
};

export default function AccountingServices() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [founder, setFounder] = useState({ member: false, service_pct: 0 });

  useEffect(() => {
    if (!user?.email) return;
    ordersApi.founderStatus(user.email).then(setFounder).catch(() => {});
  }, [user?.email]);

  const memberPrice = (price) =>
    founder.member ? Math.round(Number(price) * (1 - founder.service_pct / 100)) : Number(price);

  useEffect(() => {
    let alive = true;
    servicesApi.list()
      .then((d) => {
        if (!alive) return;
        setServices((d.services || []).filter((s) => s.category !== 'membership'));
      })
      .catch((e) => alive && setError(e.message || 'Could not load services'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const toggle = (slug) =>
    setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));

  const total = useMemo(
    () => services.filter((s) => selected.includes(s.slug)).reduce((sum, s) => sum + memberPrice(s.price_aed), 0),
    [services, selected, founder],
  );

  const buy = async (slugs) => {
    if (!slugs.length) return toast({ title: 'Pick at least one service' });
    if (!user) { navigate('/login?next=/accounting'); return; }
    setBusy(true);
    try {
      const order = await createServiceOrder({
        slugs,
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
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[#A9C0BB] font-semibold">
            Accounting · Tax · Audit
          </div>
          <h1 className="mt-5 font-display text-4xl sm:text-5xl lg:text-6xl font-semibold text-white leading-[1.05] max-w-3xl">
            Stay compliant<br /><span className="shine-text">without a finance team.</span>
          </h1>
          <p className="mt-6 text-base md:text-lg text-[#A9C0BB] max-w-2xl">
            Buy any service on its own — no company setup package required. Fixed, published UAE pricing.
            Your dedicated advisor is assigned the moment payment clears.
          </p>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-5">
          {founder.member && (
            <div className="mb-8 rounded-2xl border border-[#0A3D34]/20 bg-[#0A3D34]/[0.04] px-5 py-4 flex items-center gap-3" data-testid="founder-member-banner">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#0A3D34]">Founder Club</span>
              <span className="text-sm text-slate-700">
                Your membership is active — every price below already has your {founder.service_pct}% member discount applied.
              </span>
            </div>
          )}
          {!founder.member && user && (
            <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" data-testid="founder-upsell-banner">
              <span className="text-sm text-slate-700">
                Founder Club members get 15% off every service below and 10% off company setup packages.
              </span>
              <button onClick={() => navigate('/founder-club')} data-testid="founder-upsell-cta" className="text-sm font-semibold text-[#0A3D34] underline whitespace-nowrap">
                Join for AED 999 →
              </button>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-slate-500" data-testid="services-loading">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading live pricing…
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" data-testid="services-error">
              {error}
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            {services.map((svc) => {
              const Icon = ICONS[svc.slug] || Calculator;
              const isSelected = selected.includes(svc.slug);
              return (
                <div
                  key={svc.slug}
                  data-testid={`service-card-${svc.slug}`}
                  className={`rounded-3xl border p-7 transition-colors duration-200 ${isSelected ? 'border-[#0A3D34] bg-[#0A3D34]/[0.03]' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="h-11 w-11 rounded-2xl bg-[#0A3D34]/8 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-[#0A3D34]" />
                    </div>
                    <button
                      type="button"
                      onClick={() => toggle(svc.slug)}
                      data-testid={`service-select-${svc.slug}`}
                      className={`text-[10px] uppercase tracking-[0.18em] font-bold px-3 py-1.5 rounded-full transition-colors duration-200 ${isSelected ? 'bg-[#0A3D34] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {isSelected ? 'Selected' : 'Select'}
                    </button>
                  </div>

                  <h2 className="mt-5 font-display text-base md:text-lg font-semibold text-slate-900">{svc.name}</h2>
                  {founder.member ? (
                    <>
                      <div className="mt-2 flex items-baseline gap-3">
                        <div className="font-display text-3xl font-semibold text-slate-900" data-testid={`service-price-${svc.slug}`}>
                          AED {memberPrice(svc.price_aed).toLocaleString()}
                        </div>
                        <div className="text-base text-slate-400 line-through">AED {Number(svc.price_aed).toLocaleString()}</div>
                      </div>
                      <div className="text-sm text-[#0A3D34] font-semibold mt-1" data-testid={`service-label-${svc.slug}`}>
                        Founder Club price · {founder.service_pct}% off
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mt-2 font-display text-3xl font-semibold text-slate-900" data-testid={`service-price-${svc.slug}`}>
                        AED {Number(svc.price_aed).toLocaleString()}
                      </div>
                      <div className="text-sm text-slate-500 mt-1" data-testid={`service-label-${svc.slug}`}>{svc.price_label}</div>
                    </>
                  )}
                  <p className="mt-4 text-sm text-slate-600 leading-relaxed">{svc.description}</p>

                  <ul className="mt-5 space-y-2">
                    {(svc.features || []).map((f) => (
                      <li key={f} className="flex gap-2 text-sm text-slate-700">
                        <CheckCircle2 className="h-4 w-4 text-[#0A3D34] shrink-0 mt-0.5" /> {f}
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => buy([svc.slug])}
                    disabled={busy}
                    data-testid={`service-buy-${svc.slug}`}
                    className="mt-6 w-full rounded-full bg-[#0A3D34] hover:bg-[#062A24] text-white"
                  >
                    {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting…</> : <>Buy this service <ArrowRight className="h-4 w-4 ml-2" /></>}
                  </Button>
                </div>
              );
            })}
          </div>

          {selected.length > 1 && (
            <div className="mt-8 rounded-3xl border border-[#0A3D34]/15 bg-[#0A3D34]/[0.04] p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" data-testid="service-bundle-bar">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">{selected.length} services selected</div>
                <div className="font-display text-2xl font-semibold text-slate-900 mt-1" data-testid="service-bundle-total">
                  AED {total.toLocaleString()}
                </div>
              </div>
              <Button
                onClick={() => buy(selected)}
                disabled={busy}
                data-testid="service-bundle-buy"
                className="rounded-full bg-[#0A3D34] hover:bg-[#062A24] text-white px-7"
              >
                {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting…</> : <>Checkout selected <ArrowRight className="h-4 w-4 ml-2" /></>}
              </Button>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
