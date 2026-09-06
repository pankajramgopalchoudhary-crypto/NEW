import React, { useEffect, useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText, MessageCircle, ClipboardCheck, ShieldCheck, Building2,
  CheckCircle2, Clock, Upload, Crown, Sparkles, AlertCircle, UserCircle2,
  CreditCard, ChevronRight, Trash2, Calendar, Star, LifeBuoy,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import FounderPortal from '../components/FounderPortal';
import DocumentOCRUploader from '../components/DocumentOCRUploader';
import ReferralPanel from '../components/ReferralPanel';
import { listUserOrders } from '../lib/checkoutSupabase';
import { listKycDocs, upsertKycDoc, deleteKycDoc, getMembership, activateMembership } from '../lib/dashboardSupabase';
import { useToast } from '../hooks/use-toast';

const KYC_DOCS = [
  { key: 'passport',    label: 'Passport copy',           required: true },
  { key: 'photo',       label: 'Personal photograph',     required: true },
  { key: 'visa_stamp',  label: 'Visa / entry stamp',      required: true },
  { key: 'emirates_id', label: 'Emirates ID (if any)',    required: false },
];

const ORDER_TIMELINE = [
  { key: 'reserved',    title: 'Slot Reserved',                    desc: 'Advisor will contact via WhatsApp within 2 hours.' },
  { key: 'name_check',  title: 'Name Availability Check',          desc: 'Authority verifies all 3 trade-name preferences (24 hours).' },
  { key: 'name_confirmed', title: 'Name Confirmed & Reserved',     desc: 'Setup fees due. Reservation fee becomes non-refundable.' },
  { key: 'docs',        title: 'Documents Uploaded',               desc: 'Passport, photo, visa stamp & Emirates ID.' },
  { key: 'submitted',   title: 'Submitted to Authority',           desc: 'Licence application under review.' },
  { key: 'issued',      title: 'Licence Issued 🎉',                desc: 'Trade licence + incorporation docs delivered.' },
];

const FOUNDER_PERKS = [
  { icon: Crown,        title: 'Free trade-name reservation',         desc: 'First-name reservation included for life.' },
  { icon: Star,         title: 'Priority advisor (24/7)',             desc: 'Skip the queue — direct WhatsApp to a senior advisor.' },
  { icon: Sparkles,     title: '15% off all service fees',            desc: 'Auto-applied at checkout on every future order.' },
  { icon: CreditCard,   title: '10% off annual renewals',             desc: 'Lifetime perk on your licence renewal.' },
  { icon: ShieldCheck,  title: 'Free invoice / VAT review',           desc: 'One free invoice & VAT consultation per year.' },
  { icon: Calendar,     title: 'Exclusive founder events',            desc: 'Monthly networking dinners and webinars in Dubai.' },
];

function statusMeta(s) {
  const v = String(s || '').toLowerCase();
  if (v === 'paid' || v === 'completed') return { label: 'Paid', tone: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  if (v === 'payment_review' || v === 'pending') return { label: 'Pending bank credit', tone: 'bg-amber-100 text-amber-800 border-amber-200' };
  if (v === 'reserved' || v === 'pre_booked') return { label: 'Reserved', tone: 'bg-sky-100 text-sky-800 border-sky-200' };
  if (v === 'cancelled' || v === 'refunded') return { label: 'Cancelled', tone: 'bg-rose-100 text-rose-800 border-rose-200' };
  return { label: 'In progress', tone: 'bg-slate-100 text-slate-700 border-slate-200' };
}

// Compute current timeline stage from order.status
function stageFromStatus(s) {
  const v = String(s || '').toLowerCase();
  if (v === 'issued') return 5;
  if (v === 'submitted') return 4;
  if (v === 'docs_uploaded') return 3;
  if (v === 'name_confirmed' || v === 'paid') return 2;
  if (v === 'name_check' || v === 'payment_review') return 1;
  return 0;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();

  const [orders, setOrders] = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [kyc, setKyc] = useState({});      // { [key]: { name, size, uploaded_at } }
  const [founder, setFounder] = useState(false);
  const [openUpload, setOpenUpload] = useState(params.get('upload') === '1');

  const isAdmin = ['founder', 'manager', 'staff', 'reviewer'].includes(user?.role);

  // Bootstrap from Supabase (with localStorage fallback if tables not migrated yet)
  useEffect(() => {
    if (!user) {
      navigate('/login?redirect=/dashboard');
      return;
    }
    let cancelled = false;

    (async () => {
      // KYC
      let kycRows = [];
      try {
        kycRows = await listKycDocs(user.email);
      } catch { kycRows = []; }
      const kycMap = {};
      kycRows.forEach((row) => {
        kycMap[row.doc_key] = {
          name: row.file_name,
          size: row.file_size_bytes,
          uploaded_at: row.uploaded_at,
        };
      });
      // Fallback to localStorage if Supabase returned empty AND a local cache exists
      if (Object.keys(kycMap).length === 0) {
        try {
          const local = JSON.parse(localStorage.getItem(`ssu_kyc_${user.email}`) || '{}');
          Object.assign(kycMap, local);
        } catch (err) {
          console.warn('[dashboard] could not parse cached KYC data', err);
        }
      }
      if (!cancelled) setKyc(kycMap);

      // Membership
      let m = null;
      try { m = await getMembership(user.email, 'founder_club'); } catch (err) { console.warn('[dashboard] getMembership failed', err); m = null; }
      let localFounder = false;
      try { localFounder = localStorage.getItem(`ssu_founder_${user.email}`) === '1'; } catch (err) { console.warn('[dashboard] read founder flag failed', err); }
      if (!cancelled) setFounder(!!m || localFounder);

      // Orders
      setLoadingOrders(true);
      const list = await listUserOrders(user.email);
      if (cancelled) return;
      setOrders(list);
      if (list.length) setActiveOrderId(list[0].id);
      setLoadingOrders(false);
    })();
    return () => { cancelled = true; };
  }, [user, navigate]);

  const activeOrder = useMemo(
    () => orders.find((o) => o.id === activeOrderId) || orders[0],
    [orders, activeOrderId]
  );
  const stage = stageFromStatus(activeOrder?.status);
  const meta = statusMeta(activeOrder?.status);

  const kycDoneCount = KYC_DOCS.filter((d) => kyc[d.key]).length;
  const requiredDone = KYC_DOCS.filter((d) => d.required && kyc[d.key]).length;
  const requiredTotal = KYC_DOCS.filter((d) => d.required).length;
  const kycComplete = requiredDone === requiredTotal;

  const onUpload = (key) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 5 MB per document.' });
      return;
    }
    // Read as base64 so we can persist into Supabase (file_b64 column)
    const b64 = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result || '').split(',')[1] || '');
      r.onerror = () => rej(new Error('Could not read file'));
      r.readAsDataURL(file);
    }).catch(() => '');

    const docRow = { name: file.name, size: file.size, uploaded_at: new Date().toISOString() };
    const nextLocal = { ...kyc, [key]: docRow };
    setKyc(nextLocal);
    try { localStorage.setItem(`ssu_kyc_${user.email}`, JSON.stringify(nextLocal)); } catch (err) { console.warn('[dashboard] could not persist KYC cache', err); }

    try {
      await upsertKycDoc(user.email, {
        doc_key: key,
        file_name: file.name,
        file_size_bytes: file.size,
        file_b64: b64,
      });
      toast({ title: 'Document saved', description: `${file.name} uploaded to your vault.` });
    } catch (err) {
      toast({
        title: 'Saved locally only',
        description: 'Supabase tables not migrated yet — run /app/supabase/migrations/0001_dashboard_tables.sql.',
      });
    }
  };

  const removeDoc = async (key) => {
    const next = { ...kyc };
    delete next[key];
    setKyc(next);
    try { localStorage.setItem(`ssu_kyc_${user.email}`, JSON.stringify(next)); } catch (err) { console.warn('[dashboard] could not persist KYC cache delete', err); }
    try { await deleteKycDoc(user.email, key); } catch (err) { console.warn('[dashboard] deleteKycDoc failed', err); }
  };

  const addFounderClub = () => {
    // Direct purchase flow — bypasses freezone-selection checkout. The FounderClub
    // page has its own 1-click checkout for AED 999 lifetime membership.
    navigate('/founder-club?buy=1');
  };

  // If user has paid for Founder Club in their cart history but Supabase isn't flagged yet, persist it.
  useEffect(() => {
    if (!user || !founder) return;
    let cancelled = false;
    (async () => {
      try {
        await activateMembership(user.email, 'founder_club');
      } catch (err) {
        if (!cancelled) console.warn('[dashboard] activateMembership failed', err);
      }
    })();
    return () => { cancelled = true; };
  }, [founder, user]); // activateMembership is a stable import — excluded intentionally

  const stats = [
    { l: 'Orders', n: orders.length, i: ClipboardCheck },
    { l: 'KYC Docs', n: `${kycDoneCount}/${KYC_DOCS.length}`, i: FileText },
    { l: 'KYC Status', n: kycComplete ? 'Complete' : 'Pending', i: ShieldCheck, color: kycComplete ? 'emerald' : 'amber' },
    { l: 'Founder Club', n: founder ? 'Active' : 'Not member', i: Crown, color: founder ? 'amber' : 'slate' },
  ];

  if (!user) return null;

  return (
    <div data-testid="client-dashboard">
      <Navbar />
      <section className="hero-gradient grain">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 pt-14 lg:pt-20 pb-12">
          <div className="text-[12px] uppercase tracking-[0.22em] text-slate-500 font-semibold">Client Dashboard</div>
          <h1 className="mt-3 font-display font-semibold text-slate-900" style={{ fontSize: 'clamp(2.4rem, 4.4vw, 4rem)', lineHeight: 1.05 }}>Welcome back, {user.name?.split(' ')[0] || 'there'}.</h1>
          <p className="mt-3 text-slate-600 max-w-2xl" style={{ fontSize: 'clamp(1rem, 1.15vw, 1.125rem)' }}>Track your UAE setup orders, upload KYC, manage Founder Club perks, view compliance deadlines &amp; renewals — all in one place.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={() => navigate('/checkout')} className="btn-primary rounded-full h-11 px-6" data-testid="dash-new-order">+ Start new application</Button>
            <Button onClick={() => navigate('/compare')} variant="outline" className="rounded-full h-11 px-6 border-slate-300">Compare zones</Button>
            <Button onClick={() => navigate('/consultation')} variant="outline" className="rounded-full h-11 px-6 border-slate-300">Book free call</Button>
            {isAdmin && (
              <Button onClick={() => navigate('/admin')} variant="outline" className="rounded-full px-6 h-11 border-amber-400 text-amber-800 bg-amber-50 hover:bg-amber-100" data-testid="dash-admin-btn">Admin Panel</Button>
            )}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="pt-8 bg-[#FFFCF5]">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="dash-stats">
          {stats.map((s) => (
            <div key={s.l} className="card-elevated rounded-2xl p-5">
              <div className={`h-9 w-9 rounded-xl grid place-items-center ${
                s.color === 'amber' ? 'bg-amber-50' : s.color === 'emerald' ? 'bg-emerald-50' : 'bg-slate-50'
              }`}>
                <s.i className={`h-4 w-4 ${
                  s.color === 'amber' ? 'text-amber-700' : s.color === 'emerald' ? 'brand-emerald' : 'text-slate-700'
                }`} />
              </div>
              <div className="font-display text-2xl font-bold text-slate-900 mt-3">{s.n}</div>
              <div className="text-xs text-slate-600">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-10 bg-[#FFFCF5]">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 grid lg:grid-cols-3 gap-6">
          {/* LEFT — Founder Portal (full lifecycle: tracker / appts / vault / compliance / renewals / invoices) */}
          <div className="lg:col-span-2 space-y-6">
            <FounderPortal orderRef={activeOrder?.order_ref || activeOrder?.reference || activeOrder?.id} />

            {/* My Orders */}
            <div className="card-elevated rounded-2xl p-6" data-testid="dash-orders">
              <div className="flex items-center justify-between mb-3">
                <div className="font-display text-lg font-semibold text-slate-900">My Orders</div>
                {loadingOrders && <span className="text-[11px] text-slate-500">Loading…</span>}
              </div>
              {!loadingOrders && orders.length === 0 && (
                <div className="rounded-xl bg-slate-50 border border-dashed border-slate-300 p-6 text-center">
                  <p className="text-sm text-slate-600">No orders yet.</p>
                  <Button onClick={() => navigate('/checkout')} className="btn-primary rounded-full mt-3 h-10 px-5">Start your first application</Button>
                </div>
              )}
              {orders.length > 0 && (
                <div className="space-y-2">
                  {orders.map((o) => {
                    const m = statusMeta(o.status);
                    const isActive = o.id === activeOrderId;
                    return (
                      <button
                        type="button"
                        key={o.id}
                        onClick={() => setActiveOrderId(o.id)}
                        data-testid={`order-row-${o.id}`}
                        className={`w-full text-left p-3 rounded-xl border transition ${
                          isActive ? 'border-emerald-700 bg-emerald-50 ring-2 ring-emerald-700/15' : 'border-slate-200 bg-white hover:border-emerald-400'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="min-w-0">
                            <div className="font-display text-sm font-semibold text-slate-900 truncate">{o.freezone || o.zone_name || 'UAE Setup Order'}{o.package_name ? ` — ${o.package_name}` : ''}</div>
                            <div className="text-[11px] text-slate-500 truncate">Ref: <span className="font-mono">{o.order_ref || o.reference || o.id?.slice(0, 8)}</span> · {new Date(o.created_at || Date.now()).toLocaleDateString()}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-mono font-bold text-slate-900">AED {Number(o.final_total ?? o.total_aed ?? 0).toLocaleString()}</div>
                            <span className={`mt-0.5 inline-block text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${m.tone}`}>{m.label}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Order timeline */}
            {activeOrder && (
              <div className="card-elevated rounded-2xl p-6" data-testid="dash-timeline">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                  <div>
                    <div className="font-display text-lg font-semibold text-slate-900">{activeOrder.freezone || activeOrder.zone_name || 'Application'}</div>
                    <div className="text-[11px] text-slate-500">
                      Ref: <span className="font-mono">{activeOrder.order_ref || activeOrder.reference || activeOrder.id?.slice(0, 8)}</span>
                      {activeOrder.package_name ? <> · {activeOrder.package_name}</> : null}
                      {' · '}<span className="font-semibold text-slate-700">AED {Number(activeOrder.final_total ?? activeOrder.total_aed ?? 0).toLocaleString()}</span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${meta.tone}`}>{meta.label}</span>
                </div>

                {/* PROGRESS BAR — Phase 12b */}
                <div className="mt-4" data-testid="dash-progress-bar">
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="uppercase tracking-wider text-slate-500 font-semibold">Setup Progress</span>
                    <span className="font-display font-bold brand-emerald">{Math.round((stage / (ORDER_TIMELINE.length - 1)) * 100)}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-700 to-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(6, Math.round((stage / (ORDER_TIMELINE.length - 1)) * 100))}%` }}
                    />
                  </div>
                  <div className="mt-1.5 text-[11px] text-slate-500">
                    Step <b className="text-slate-800">{Math.min(stage + 1, ORDER_TIMELINE.length)}</b> of {ORDER_TIMELINE.length} · {ORDER_TIMELINE[Math.min(stage, ORDER_TIMELINE.length - 1)]?.title}
                  </div>
                </div>

                {activeOrder.status === 'payment_review' && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[12px] text-amber-900" data-testid="dash-bank-pending">
                    ⏳ <span className="font-semibold">Pending bank credit</span> — your order will move forward once funds are confirmed (usually within 24 hours).
                  </div>
                )}

                <ol className="mt-5 relative space-y-4">
                  <span aria-hidden className="absolute left-[11px] top-2 bottom-2 w-px bg-slate-200" />
                  {ORDER_TIMELINE.map((step, idx) => {
                    const done = idx < stage;
                    const current = idx === stage;
                    return (
                      <li key={step.key} className="relative pl-9">
                        <div className={`absolute left-0 top-0 h-6 w-6 rounded-full grid place-items-center text-[10px] font-bold ring-4 ring-white ${
                          done ? 'bg-emerald-700 text-white' : current ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'
                        }`}>
                          {done ? <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={3} /> : current ? <Clock className="h-3 w-3" /> : idx + 1}
                        </div>
                        <div className="font-display text-sm font-semibold text-slate-900">{step.title}</div>
                        <div className="text-[12px] text-slate-600 leading-snug">{step.desc}</div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {/* KYC Documents */}
            <div className="card-elevated rounded-2xl p-6" data-testid="dash-kyc" id="kyc">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <div className="font-display text-lg font-semibold text-slate-900">KYC Documents — AI Scanner</div>
                  <div className="text-[11px] text-slate-500">{requiredDone}/{requiredTotal} required · {kycDoneCount}/{KYC_DOCS.length} total · Auto-fills your profile from passport / Emirates ID.</div>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${kycComplete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {kycComplete ? 'Complete' : 'Action needed'}
                </span>
              </div>
              <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200" data-testid="kyc-ai-scan">
                <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">AI Auto-fill</div>
                <div className="flex flex-wrap gap-2">
                  <DocumentOCRUploader docType="passport"    label="Scan Passport" compact />
                  <DocumentOCRUploader docType="emirates_id" label="Scan Emirates ID" compact />
                </div>
              </div>
              {!kycComplete && (
                <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[12px] text-amber-900 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Submit clear, full-page scans. Authority typically rejects cropped or screenshot images.</span>
                </div>
              )}
              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                {KYC_DOCS.map((doc) => {
                  const uploaded = kyc[doc.key];
                  return (
                    <div key={doc.key} className={`p-3 rounded-xl border ${uploaded ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-200 bg-white'}`} data-testid={`kyc-${doc.key}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                            {doc.label}
                            {doc.required && <span className="text-[9px] font-bold text-rose-600">REQUIRED</span>}
                          </div>
                          {uploaded ? (
                            <div className="text-[11px] text-slate-600 truncate mt-0.5">
                              <CheckCircle2 className="inline h-3 w-3 brand-emerald mr-1" />
                              {uploaded.name}
                              <span className="text-slate-400 ml-1">· {(uploaded.size / 1024).toFixed(0)} KB</span>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500 mt-0.5">PDF / JPG / PNG · max 5 MB</div>
                          )}
                        </div>
                        {uploaded ? (
                          <button type="button" onClick={() => removeDoc(doc.key)} className="text-rose-500 hover:text-rose-700 shrink-0" data-testid={`kyc-remove-${doc.key}`}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                      {!uploaded && (
                        <label className="mt-2 flex items-center gap-2 h-9 rounded-lg border-2 border-dashed border-slate-300 px-3 cursor-pointer hover:border-emerald-500 text-xs">
                          <Upload className="h-3.5 w-3.5 brand-emerald" />
                          <span className="text-slate-700">Click to upload</span>
                          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={onUpload(doc.key)} data-testid={`kyc-input-${doc.key}`} />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT — Profile + Founder Club + Advisor */}
          <div className="space-y-6">
            {/* Profile */}
            <div className="card-elevated rounded-2xl p-6" data-testid="dash-profile">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-emerald-100 grid place-items-center brand-emerald"><UserCircle2 className="h-7 w-7" /></div>
                <div className="min-w-0">
                  <div className="font-display text-base font-semibold text-slate-900 truncate">{user.name || user.email}</div>
                  <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
                </div>
              </div>
              <Button onClick={() => navigate('/profile')} variant="outline" className="rounded-full w-full mt-4 h-9 text-xs border-slate-300" data-testid="dash-edit-profile">Edit profile</Button>
            </div>

            {/* Referral Engine — refer a friend, earn AED 50 + 5% off */}
            <ReferralPanel />

            {/* Founder Club Perks */}
            <div className={`card-elevated rounded-2xl p-6 ${founder ? 'bg-gradient-to-br from-amber-50 to-emerald-50/40 border-amber-200' : ''}`} data-testid="dash-founder-club">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <Crown className={`h-5 w-5 ${founder ? 'text-amber-700' : 'text-slate-400'}`} />
                  <div className="font-display text-base font-semibold text-slate-900">Founder Club</div>
                </div>
                {founder ? (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-700 text-white">Active</span>
                ) : (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">Not member</span>
                )}
              </div>
              {!founder && (
                <p className="text-xs text-slate-600 mt-1">Lifetime perks for AED 999. Pays for itself on your very first renewal.</p>
              )}

              <ul className="mt-3 space-y-2">
                {FOUNDER_PERKS.map((p) => (
                  <li key={p.title} className={`flex items-start gap-2 text-[12px] ${founder ? 'text-slate-800' : 'text-slate-500'}`}>
                    <p.icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${founder ? 'text-amber-700' : 'text-slate-400'}`} />
                    <div>
                      <div className={founder ? 'font-semibold' : ''}>{p.title}</div>
                      <div className="text-[11px] text-slate-500">{p.desc}</div>
                    </div>
                  </li>
                ))}
              </ul>

              {founder ? (
                <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  You&apos;re a Founder Club member — all perks auto-apply at checkout.
                </div>
              ) : (
                <Button onClick={addFounderClub} className="btn-primary rounded-full w-full mt-4 h-10 text-sm" data-testid="dash-buy-founder">
                  Join Founder Club — AED 999 <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              )}
            </div>

            {/* Advisor */}
            <div className="card-elevated rounded-2xl p-6" data-testid="dash-advisor">
              <div className="font-display text-base font-semibold text-slate-900">Your Advisor</div>
              <div className="flex items-center gap-3 mt-3">
                <div className="h-10 w-10 rounded-full bg-emerald-700 text-white grid place-items-center font-semibold">PC</div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">Pankaj Choudhary</div>
                  <div className="text-[11px] text-emerald-600 flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Online now</div>
                </div>
              </div>
              <a href="https://wa.me/971585903155" target="_blank" rel="noreferrer">
                <Button className="btn-primary rounded-full w-full mt-3 h-10 text-sm" data-testid="dash-message-advisor">
                  <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp Advisor
                </Button>
              </a>
              <Button
                onClick={() => navigate('/dashboard/support')}
                variant="outline"
                className="rounded-full w-full mt-2 h-10 text-sm border-slate-300 hover:border-emerald-600 hover:text-emerald-700 inline-flex items-center justify-center gap-2"
                data-testid="dash-support-portal"
              >
                <LifeBuoy className="h-4 w-4" /> Open a support ticket
              </Button>
            </div>

            {/* Free AI Website */}
            <div className="rounded-2xl p-5 bg-emerald-50 border border-emerald-200" data-testid="dash-ai-website">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 brand-emerald mt-0.5 shrink-0" />
                <div>
                  <div className="font-display text-sm font-semibold text-slate-900">Free AI Website Bundle</div>
                  <p className="text-[12px] text-slate-700 mt-0.5">Included free on orders above AED 10,000. Talk to your advisor to claim.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {openUpload && (
        <div className="fixed bottom-5 right-5 z-50 p-3 bg-slate-900 text-white rounded-xl shadow-2xl text-xs">
          Scroll to <a href="#kyc" onClick={() => setOpenUpload(false)} className="underline">KYC Documents</a> to upload.
        </div>
      )}

      <Footer />
    </div>
  );
}
