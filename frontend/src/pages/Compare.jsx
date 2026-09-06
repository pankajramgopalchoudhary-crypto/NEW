import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PageFAQ from '../components/PageFAQ';
import { faqCompare } from '../constants/pageFaqs';
import { Button } from '../components/ui/button';
import { ZONES } from '../data/zones';
import { loadFreezonePackages, mergeZonesWithLivePackages } from '../lib/pricingService';
import {
  Plus,
  X,
  ArrowRight,
  ShieldCheck,
  MapPin,
  Clock,
  Users,
  Briefcase,
  Building2,
  CheckCircle2,
  XCircle,
  Sparkles,
  Trophy,
  ShieldAlert,
  Download,
} from 'lucide-react';
import { generateComparePDF } from '../lib/pdfGenerator';

const money = (n) => (n || n === 0 ? `AED ${Number(n).toLocaleString()}` : '—');

const TAG_STYLES = {
  'MOST AFFORDABLE': 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  'QUICKEST ISSUANCE': 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  'MEDIA SPECIALIST': 'bg-purple-100 text-purple-800 ring-1 ring-purple-200',
  'INDUSTRIAL POWER': 'bg-orange-100 text-orange-800 ring-1 ring-orange-200',
  'DIGITAL FIRST': 'bg-sky-100 text-sky-800 ring-1 ring-sky-200',
  'TOP RATED': 'bg-rose-100 text-rose-800 ring-1 ring-rose-200',
  'GLOBAL LEADER': 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200',
};

function Chip({ icon: Icon, label, value, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
  };
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium border ${tones[tone]}`}>
      {Icon ? <Icon className="h-3 w-3" /> : null}
      <span className="text-slate-500">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function BenefitsModal({ zone, onClose }) {
  if (!zone) return null;
  return (
    <div
      className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm grid place-items-center p-4"
      onClick={onClose}
      data-testid="compare-benefits-modal"
    >
      <div
        className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-200 sticky top-0 bg-white rounded-t-3xl flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold">{zone.loc}</span>
              {zone.tag && (
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${TAG_STYLES[zone.tag] || 'bg-slate-100 text-slate-700'}`}>
                  {zone.tag}
                </span>
              )}
            </div>
            <h3 className="font-display text-2xl font-semibold text-slate-900 mt-1">{zone.fullName || zone.name}</h3>
            {zone.highlight && <p className="text-sm text-slate-600 mt-1">{zone.highlight}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 -m-1" data-testid="compare-benefits-close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {zone.pros?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Key Benefits
              </h4>
              <ul className="space-y-2">
                {zone.pros.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {zone.cons?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-rose-800 mb-3 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" /> Things to consider
              </h4>
              <ul className="space-y-2">
                {zone.cons.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <XCircle className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {zone.best?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <Briefcase className="h-4 w-4" /> Best For
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {zone.best.map((b) => (
                  <span key={b} className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-medium border border-emerald-200">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            {zone.banking && (
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">Banking</div>
                <p className="text-slate-700">{zone.banking}</p>
              </div>
            )}
            {zone.visa && (
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">Visas</div>
                <p className="text-slate-700">{zone.visa}</p>
              </div>
            )}
            {zone.renewal && (
              <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2">
                <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">Renewal</div>
                <p className="text-slate-700">{zone.renewal}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ZoneCard({ zone, onRemove, onViewBenefits, onStart, onDetails, activity }) {
  const isLive = zone.priceSource === 'supabase';
  return (
    <div className="relative bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg transition-shadow overflow-hidden flex flex-col" data-testid={`compare-card-${zone.slug}`}>
      {/* Header strip */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{zone.loc}</span>
            </div>
            <h3 className="font-display text-xl font-semibold text-slate-900 mt-1 truncate">{zone.name}</h3>
            <p className="text-[11px] text-slate-500 truncate">{zone.fullName}</p>
          </div>
          <button
            onClick={onRemove}
            className="text-slate-300 hover:text-rose-500 p-1 -m-1 shrink-0"
            aria-label="Remove"
            data-testid={`compare-remove-${zone.slug}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {zone.tag && (
          <span className={`mt-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${TAG_STYLES[zone.tag] || 'bg-slate-100 text-slate-700'}`}>
            <Trophy className="h-3 w-3" /> {zone.tag}
          </span>
        )}
      </div>

      {/* Price tier */}
      <div className="px-5 py-4 bg-gradient-to-br from-emerald-50/60 to-amber-50/40">
        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold">Starting from</div>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="font-display text-3xl font-semibold text-slate-900">{money(zone.gov)}</span>
          {isLive && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-600 text-white">
              Live
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5">Govt + setup · 0 visa package</p>
        {zone.govVisa ? (
          <p className="text-xs text-slate-700 mt-1.5">With 1 visa: <span className="font-semibold">{money(zone.govVisa)}</span></p>
        ) : null}
      </div>

      {/* Stat chips */}
      <div className="px-5 py-4 flex flex-wrap gap-1.5">
        <Chip icon={Briefcase} label="Activities" value={zone.acts || '—'} tone="emerald" />
        <Chip icon={Users} label="Visas" value={`Up to ${zone.maxVis}`} />
        <Chip icon={Clock} label="Processing" value={zone.proc || '—'} />
        <Chip icon={Building2} label="Office" value={zone.physical?.split(' / ')[0] || '—'} />
        <Chip icon={ShieldCheck} label="Ownership" value={`${zone.ownership}%`} tone="emerald" />
        <Chip icon={Sparkles} label="Tax" value={zone.corpTax ? `${zone.corpTax}%` : '0%'} />
      </div>

      {/* Best for chips */}
      {zone.best?.length > 0 && (
        <div className="px-5 pb-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold mb-1.5">Best For</div>
          <div className="flex flex-wrap gap-1">
            {zone.best.slice(0, 4).map((b) => (
              <span key={b} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] border border-slate-200">
                {b}
              </span>
            ))}
            {zone.best.length > 4 && (
              <span className="px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 text-[11px] border border-slate-200">
                +{zone.best.length - 4}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto px-5 pb-5 pt-2 space-y-2 border-t border-slate-100">
        <Button
          onClick={onStart}
          className="btn-primary w-full rounded-full h-10 text-sm"
          data-testid={`compare-start-${zone.slug}`}
        >
          Start Application <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={onViewBenefits}
            className="rounded-full h-9 text-xs border-slate-300"
            data-testid={`compare-benefits-${zone.slug}`}
          >
            View Benefits
          </Button>
          <Button
            variant="outline"
            onClick={onDetails}
            className="rounded-full h-9 text-xs border-slate-300"
            data-testid={`compare-details-${zone.slug}`}
          >
            Get Details
          </Button>
        </div>
        {activity && (
          <p className="text-[11px] text-center text-slate-500 pt-1">
            Quote for <span className="font-medium text-slate-700">{activity}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function AddSlot({ available, onPick }) {
  const [open, setOpen] = useState(false);
  if (available.length === 0) return null;
  return (
    <div className="relative rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50/50 hover:bg-emerald-50/40 hover:border-emerald-400 transition-colors min-h-[460px] flex items-center justify-center" data-testid="compare-add-slot">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex flex-col items-center gap-2 text-slate-500 hover:text-emerald-700 px-6 py-10"
        >
          <div className="h-12 w-12 rounded-full bg-white border border-slate-300 grid place-items-center">
            <Plus className="h-5 w-5" />
          </div>
          <span className="text-sm font-semibold">Add a free zone</span>
          <span className="text-[11px] text-slate-400">Compare up to 4 jurisdictions</span>
        </button>
      ) : (
        <div className="p-5 w-full">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-800">Pick a free zone</span>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-[340px] overflow-y-auto pr-1">
            {available.map((z) => (
              <button
                key={z.slug}
                onClick={() => { onPick(z.slug); setOpen(false); }}
                className="text-left text-xs font-medium px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-colors inline-flex items-center gap-1.5 w-full"
                data-testid={`compare-add-${z.slug}`}
              >
                <Plus className="h-3 w-3 text-emerald-600 shrink-0" />
                <span className="truncate">{z.name}</span>
                <span className="ml-auto text-[10px] text-slate-400 shrink-0">{z.loc}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Compare() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [livePackages, setLivePackages] = useState([]);
  const [benefitsZone, setBenefitsZone] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadFreezonePackages()
      .then((pkgs) => { if (!cancelled) setLivePackages(pkgs); })
      .catch(() => { if (!cancelled) setLivePackages([]); });
    return () => { cancelled = true; };
  }, []);

  const zones = useMemo(() => mergeZonesWithLivePackages(ZONES, livePackages), [livePackages]);

  const initialSlugs = useMemo(() => {
    const fromQuery = (params.get('zones') || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const matched = zones
      .filter((z) => fromQuery.includes(z.slug) || fromQuery.includes(z.name.toLowerCase()))
      .map((z) => z.slug);
    if (matched.length) return matched.slice(0, 4);
    return zones.slice(0, 3).map((z) => z.slug);
  }, [params, zones]);

  const [selected, setSelected] = useState([]);
  const userInteracted = useRef(false);
  useEffect(() => {
    // Auto-populate ONCE on first load (or when zones first resolve). After
    // the user explicitly removes a zone, keep their choice — never refill.
    if (!userInteracted.current && zones.length && selected.length === 0 && initialSlugs.length) {
      setSelected(initialSlugs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones, initialSlugs]);

  const selectedZones = selected
    .map((slug) => zones.find((z) => z.slug === slug))
    .filter(Boolean);
  const activity = params.get('activity');

  const addZone = (slug) => {
    userInteracted.current = true;
    setSelected((s) => (s.includes(slug) || s.length >= 4 ? s : [...s, slug]));
  };
  const removeZone = (slug) => {
    userInteracted.current = true;
    setSelected((s) => s.filter((x) => x !== slug));
  };

  const available = zones.filter((z) => !selected.includes(z.slug));

  const startApplication = (z) => navigate('/checkout', {
    state: {
      order: {
        zone_slug: z.slug,
        zone_name: z.name,
        package_id: z.livePackage?.package_id || null,
        package_name: z.livePackage?.package_name || z.name,
        total_aed: z.gov,
        visa_count: 0,
        addons: [],
        contact: { name: '', email: '', phone: '' },
        business: { activity: activity || '', company_names: ['', '', ''], shareholders: 1 },
      },
    },
  });

  const ROWS = [
    { label: 'Government Fee', get: (z) => money(z.gov), category: 'Cost' },
    { label: 'Service Fee', get: (z) => money(z.svc), category: 'Cost' },
    { label: 'License + 1 Visa (Total)', get: (z) => money(z.govVisa), bold: true, category: 'Cost' },
    { label: 'Annual Renewal', get: (z) => z.renewal || `~90% of original`, category: 'Cost' },
    { label: 'Visa Allotment (Max)', get: (z) => `Up to ${z.maxVis} visa${z.maxVis === 1 ? '' : 's'}`, category: 'Visas' },
    { label: 'Visa Quota Source', get: (z) => z.visaQuotaSource || (z.maxVis >= 10 ? 'Office sqft (1 per 9 m²)' : 'Per-package quota'), category: 'Visas' },
    { label: 'Investor / Partner Visa', get: () => '2-year renewable', category: 'Visas' },
    { label: 'Family Sponsorship', get: () => 'Supported (post-EID)', category: 'Visas' },
    { label: 'Total Activities Allowed', get: (z) => z.acts || '—', category: 'Activities' },
    { label: 'Qualifying for 0% Tax (QFZP)', get: (z) => z.qfzpEligible !== false ? 'Yes (with substance)' : 'Limited', category: 'Activities' },
    { label: 'Mainland Trading', get: (z) => z.mainlandTrade || 'Requires distributor / branch', category: 'Activities' },
    { label: 'Office Requirement', get: (z) => z.physical || 'Flexi-desk / virtual', category: 'Office' },
    { label: 'Coworking / Hot Desk', get: (z) => z.coworking || 'Available', category: 'Office' },
    { label: 'Warehouse / Industrial', get: (z) => z.warehouse || (z.industrial ? 'Available' : 'Not offered'), category: 'Office' },
    { label: 'Banking Partners', get: (z) => z.bankingPartners || z.banking || 'WIO · Mashreq · ENBD · RAKBank', category: 'Banking' },
    { label: 'Avg. Account Opening', get: (z) => z.bankingTime || '7–15 working days', category: 'Banking' },
    { label: 'Setup Speed', get: (z) => z.proc || '—', category: 'Operations' },
    { label: 'Ownership', get: (z) => `${z.ownership}% foreign`, category: 'Operations' },
    { label: 'Corporate Tax (Headline)', get: (z) => (z.corpTax ? `${z.corpTax}%` : '0% (qualifying)'), category: 'Tax' },
    { label: 'VAT Registration', get: () => 'Mandatory above AED 375K turnover', category: 'Tax' },
  ];

  return (
    <div data-testid="compare-page">
      <Navbar />

      {/* Hero */}
      <section className="hero-gradient grain">
        <div className="max-w-[1480px] mx-auto px-5 lg:px-8 pt-3 lg:pt-6 pb-7 text-center">
          <div className="inline-flex items-center gap-2 justify-center">
            <ShieldCheck className="h-4 w-4 brand-emerald" />
            <span className="text-xs uppercase tracking-[0.22em] text-slate-600 font-semibold">Jurisdiction Comparison</span>
          </div>
          <h1 className="mt-4 font-display font-semibold text-slate-900 mx-auto" style={{ fontSize: 'clamp(2rem, 4.4vw, 4rem)', lineHeight: 1.04 }}>
            Compare UAE free zones side&nbsp;by&nbsp;side
          </h1>
          <p className="mt-3 text-base text-slate-600 max-w-3xl mx-auto text-center">
            Live pricing from our database. Compare up to 4 jurisdictions{activity ? <> for <span className="font-semibold text-slate-900">{activity}</span></> : ''}.
          </p>
          {selectedZones.length > 0 && (
            <div className="mt-5 flex justify-center">
              <Button
                onClick={() => {
                  try {
                    generateComparePDF({ selectedZones, rows: ROWS, activity });
                  } catch (e) {
                    console.error('[compare] PDF export failed', e);
                  }
                }}
                variant="outline"
                className="rounded-full border-slate-300 hover:border-emerald-600 hover:text-emerald-700 inline-flex items-center gap-2"
                data-testid="compare-download-pdf"
              >
                <Download className="h-4 w-4" />
                Download comparison as PDF
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Cards grid */}
      <section className="py-10 bg-[#FFFCF5]">
        <div className="max-w-[1480px] mx-auto px-5 lg:px-8">
          {selectedZones.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-slate-500 mb-4">No free zones selected yet.</p>
              <Button
                onClick={() => setSelected(zones.slice(0, 3).map((z) => z.slug))}
                className="btn-primary rounded-full"
                data-testid="compare-reset"
              >
                Show me top 3
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" data-testid="compare-cards-grid">
              {selectedZones.map((z) => (
                <ZoneCard
                  key={z.slug}
                  zone={z}
                  activity={activity}
                  onRemove={() => removeZone(z.slug)}
                  onViewBenefits={() => setBenefitsZone(z)}
                  onStart={() => startApplication(z)}
                  onDetails={() => navigate(`/free-zones/${z.slug}`)}
                />
              ))}
              {selectedZones.length < 4 && (
                <AddSlot available={available} onPick={addZone} />
              )}
            </div>
          )}

          {/* Feature comparison table */}
          {selectedZones.length > 1 && (
            <div className="mt-12">
              <h2 className="font-display text-2xl font-semibold text-slate-900 mb-4">Detailed feature comparison</h2>
              <div className="overflow-x-auto card-elevated rounded-3xl bg-white">
                <table className="w-full text-sm border-collapse" data-testid="compare-feature-table" style={{ tableLayout: 'fixed', minWidth: 720 + selectedZones.length * 180 + 'px' }}>
                  <colgroup>
                    <col style={{ width: '220px' }} />
                    {selectedZones.map((z) => (
                      <col key={z.slug} style={{ width: `${Math.max(180, 800 / selectedZones.length)}px` }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr className="bg-[#0F2A2A] text-white">
                      <th className="text-left px-5 py-4 font-semibold sticky left-0 bg-[#0F2A2A] align-middle whitespace-nowrap">Feature</th>
                      {selectedZones.map((z) => (
                        <th key={z.slug} className="px-5 py-4 text-left align-middle whitespace-normal">
                          <div className="font-display text-base font-semibold leading-tight">{z.name}</div>
                          <div className="text-[11px] text-[#9DB5B0] font-normal mt-0.5 leading-tight">{z.loc}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map((row, i) => (
                      <tr key={row.label} className={i % 2 ? 'bg-[#F8F3E8]/40' : 'bg-white'}>
                        <td className="px-5 py-3.5 font-medium text-slate-700 sticky left-0 bg-inherit align-middle whitespace-nowrap">{row.label}</td>
                        {selectedZones.map((z) => (
                          <td key={z.slug} className="px-5 py-3.5 text-slate-800 align-middle whitespace-nowrap">{row.get(z)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-8 rounded-2xl bg-emerald-50 border border-emerald-200 px-5 py-4 text-sm text-emerald-900 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            Prices marked “Live” are read directly from our pricing database. Some jurisdictions are still under pricing verification — request a quotation for those.
          </div>
        </div>
      </section>

      <BenefitsModal zone={benefitsZone} onClose={() => setBenefitsZone(null)} />
      <PageFAQ title="Compare Free Zones — Common questions" intro="What 'Live pricing' means, comparing more than 4 free zones, VAT-inclusive prices and refresh frequency." items={faqCompare} testId="faq-compare" />
      <Footer />
    </div>
  );
}
