import React, { useEffect, useMemo, useState } from 'react';
import { Search, Sparkles, ArrowRight, Loader2, CheckCircle2, Clock, Users, Trophy, Download, BarChart3, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ACTIVITY_SAMPLES } from '../mock';
import { buildLiveRecommendation, captureAILead, searchActivities } from '../lib/activitySearchService';
import { loadFreezonePackages } from '../lib/pricingService';
import { generateAISearchPDF } from '../lib/pdfGenerator';
import InteractiveLoader from './InteractiveLoader';

const COUNTRY_CODES = ['+971', '+91', '+92', '+966', '+974', '+965', '+968', '+973', '+44', '+1', '+65'];
const COUNTRIES = ['United Arab Emirates', 'India', 'Pakistan', 'Bangladesh', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Oman', 'Bahrain', 'United Kingdom', 'United States', 'Singapore'];

// Countries that face restrictions or extra scrutiny for UAE company formation / visas.
// We show a friendly warning but don't block — most cases can still proceed with extra docs.
const RESTRICTED_COUNTRIES = new Set(['Israel', 'Iran', 'Syria', 'North Korea', 'Yemen', 'Sudan', 'Somalia', 'Libya', 'Afghanistan']);

const emptyLead = { name: '', email: '', countryCode: '+971', phone: '', whatsapp: '', nationality: '', residenceCountry: '' };

export default function AISearch({ autoQuery = '', hideSearchBar = false }) {
  const navigate = useNavigate();
  const [q, setQ] = useState(autoQuery || '');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const [lead, setLead] = useState(emptyLead);
  const [savingLead, setSavingLead] = useState(false);
  const [leadError, setLeadError] = useState('');
  const [allPackages, setAllPackages] = useState([]);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    loadFreezonePackages().then(setAllPackages).catch(() => setAllPackages([]));
  }, []);

  // Listen for the AISearchPage hero to dispatch a search trigger so we can run
  // the recommendation pipeline from the URL query param (deep-link from Home).
  useEffect(() => {
    const handler = (ev) => {
      const term = ev?.detail?.q;
      if (term) runSearch(term);
    };
    window.addEventListener('ssu:ai-search:run', handler);
    return () => window.removeEventListener('ssu:ai-search:run', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-run on mount if the page was opened with ?q=… in the URL.
  useEffect(() => {
    if (autoQuery && !result && !loading) {
      runSearch(autoQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoQuery]);

  const restrictedWarning = useMemo(() => {
    const nat = (lead.nationality || '').trim();
    const res = (lead.residenceCountry || '').trim();
    const hit = [nat, res].find((c) => RESTRICTED_COUNTRIES.has(c));
    return hit ? `Heads up — applicants from ${hit} may need additional documentation. Our advisor will guide you through it (no rejection at our end).` : '';
  }, [lead.nationality, lead.residenceCountry]);

  const downloadPdf = async () => {
    if (!result) return;
    setDownloadingPdf(true);
    setLeadError('');
    try {
      // Run on next tick so the spinner paints before the heavy jsPDF work
      await new Promise((r) => setTimeout(r, 30));
      const filename = generateAISearchPDF({ recommendation: result, lead, allPackages });
      // eslint-disable-next-line no-console
      console.info('AI Search PDF generated:', filename);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('PDF generation failed', err);
      setLeadError(`PDF generation failed: ${err.message || err}`);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const countrySuggestions = useMemo(() => {
    const term = (lead.residenceCountry || '').toLowerCase().trim();
    if (!term) return [];
    return COUNTRIES.filter((c) => c.toLowerCase().includes(term) && c.toLowerCase() !== term).slice(0, 6);
  }, [lead.residenceCountry]);

  const nationalitySuggestions = useMemo(() => {
    const term = (lead.nationality || '').toLowerCase().trim();
    if (!term) return [];
    return COUNTRIES.filter((c) => c.toLowerCase().includes(term) && c.toLowerCase() !== term).slice(0, 6);
  }, [lead.nationality]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setSuggestions([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        const rows = await searchActivities(term, { limit: 30 });
        setSuggestions(rows);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const runSearch = async (activityText) => {
    const term = activityText || q;
    if (!term) return;
    setQ(term);
    setLoading(true);
    setResult(null);
    setLeadOpen(false);
    try {
      const matches = await Promise.race([
        searchActivities(term, { limit: 1 }),
        new Promise((r) => setTimeout(() => r([]), 3500)),
      ]);
      const activity = matches[0] || { activity_name: term, activity_code: '', freezone: '', industry_group: '' };
      setSelectedActivity(activity);
      const recommendation = await buildLiveRecommendation(activity);
      setResult(recommendation);
      setSuggestions([]);
    } catch {
      const activity = { activity_name: term, activity_code: '', freezone: 'Meydan FZ', industry_group: '' };
      setSelectedActivity(activity);
      const recommendation = await buildLiveRecommendation(activity);
      setResult(recommendation);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const chooseActivity = async (activity) => {
    setSelectedActivity(activity);
    setQ(activity.activity_name);
    setLoading(true);
    try {
      const recommendation = await buildLiveRecommendation(activity);
      setResult(recommendation);
    } finally {
      setLoading(false);
      setSuggestions([]);
    }
  };

  const goToCheckout = (leadId) => {
    // Checkout matches on package_id first, then zone slug — send both so the
    // AI-recommended zone/package is actually pre-selected (a zone *name* alone
    // never matched, which made "Start Application" look broken).
    const best = result?.options?.[0] || null;
    const params = new URLSearchParams({
      source: 'ai-search',
      activity: result?.activity || selectedActivity?.activity_name || q,
      activity_code: result?.activityCode || '',
      freezone: best?.zone_slug || result?.bestZone || '',
      name: lead.name || '',
      email: lead.email || '',
      phone_code: lead.countryCode || '+971',
      phone: lead.phone || lead.whatsapp || '',
      nationality: lead.nationality || '',
      residence_country: lead.residenceCountry || '',
    });
    if (best?.package_id) params.set('package', best.package_id);
    if (leadId) params.set('lead_id', leadId);
    navigate(`/checkout?${params.toString()}`);
  };

  const submitLead = async (e) => {
    e.preventDefault();
    setLeadError('');
    if (!lead.name || !lead.email || !lead.phone || !lead.nationality || !lead.residenceCountry) {
      setLeadError('Please fill name, email, mobile/WhatsApp, nationality and country of residence.');
      return;
    }
    setSavingLead(true);
    // Lead capture must never block the application — if Supabase rejects the
    // insert we still take the customer to checkout with their details.
    let savedId;
    try {
      const saved = await captureAILead(lead, result, 'ai_search_start_application');
      savedId = saved?.id;
    } catch (err) {
      console.warn('[ai-search] lead capture failed, continuing to checkout', err);
    }
    setSavingLead(false);
    goToCheckout(savedId);
  };

  return (
    <section id="ai-search" className="py-10 lg:py-14 bg-white border-t border-slate-200/70">
      <div className="max-w-6xl mx-auto px-5 lg:px-8">
        {/* Page already has the premium hero — keep this section result-focused */}
        <div className="text-center reveal" hidden={hideSearchBar || Boolean(autoQuery)}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/5 border border-emerald-900/10">
            <Sparkles className="h-3.5 w-3.5 brand-emerald" />
            <span className="text-[11px] uppercase tracking-[0.22em] font-semibold brand-emerald">AI-Powered Activity Search</span>
          </div>
          <h2 className="mt-5 font-display text-3xl lg:text-5xl font-semibold text-slate-900 leading-[1.05]">Which free zone supports your activity?</h2>
          <p className="mt-4 text-base text-slate-600 max-w-2xl mx-auto">Type any business activity below — live Supabase activity search checks supported UAE free zone and mainland activity lists, then recommends the best setup option.</p>
        </div>

        <div className={`${(hideSearchBar || autoQuery) ? '' : 'mt-10'} max-w-3xl mx-auto reveal`}>
          {/* When a hero search above already drives results, hide the duplicate input */}
          <div className="relative" hidden={hideSearchBar || Boolean(autoQuery)}>
            <Search className="h-5 w-5 absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && q && runSearch(q)} placeholder="e.g., Software Development, E-Commerce, Gold Trading…" className="h-16 pl-14 pr-36 text-base rounded-2xl border-slate-200 shadow-sm bg-white" />
            <Button onClick={() => q && runSearch(q)} className="btn-primary absolute right-2 top-1/2 -translate-y-1/2 rounded-xl h-12 px-5" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}</Button>
            {suggestions.length > 0 && (
              <div className="absolute z-30 mt-2 w-full rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden text-left">
                {suggestions.map((s) => (
                  <button key={s.id} type="button" onClick={() => chooseActivity(s)} className="w-full px-5 py-3 text-left hover:bg-emerald-50 border-b border-slate-100 last:border-0">
                    <div className="font-semibold text-slate-900">{s.activity_name}</div>
                    <div className="text-xs text-slate-500">{s.activity_code || 'No code'} · {s.industry_group || 'General'} · {s.freezone}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 justify-center" hidden={hideSearchBar || Boolean(autoQuery)}>
            {ACTIVITY_SAMPLES.slice(0, 7).map((a) => (<button key={a} onClick={() => runSearch(a)} className="text-xs font-medium px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-brand-emerald hover:brand-emerald transition-colors">{a}</button>))}
          </div>

          {loading && (
            <div className="mt-8" data-testid="ai-loader">
              <InteractiveLoader allPackages={allPackages} />
            </div>
          )}

          {result && !loading && (
            <div className="mt-8 card-elevated rounded-2xl p-7 fade-up" data-testid="ai-search-result">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-slate-500">Match Result</div>
                  <div className="font-display text-2xl font-semibold text-slate-900 mt-1">{result.activity}</div>
                  <div className="text-sm text-slate-500">
                    Activity Code: <span className="font-mono">{result.activityCode || 'To be confirmed'}</span>
                    {result.industryGroup ? <> · <span className="capitalize">{result.industryGroup}</span></> : null}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-slate-500">AI Match Score</div>
                  <div className="font-display text-3xl font-bold brand-emerald" data-testid="ai-match-score">{result.matchScore}%</div>
                </div>
              </div>

              {result.aiSummary && (
                <div className="mt-4 rounded-xl bg-emerald-50/70 border border-emerald-900/10 p-3.5 text-[13px] leading-relaxed text-slate-700 flex items-start gap-2.5" data-testid="ai-summary">
                  <Sparkles className="h-4 w-4 mt-0.5 shrink-0 brand-emerald" />
                  <span><span className="font-semibold brand-emerald">Aria&apos;s take:</span> {result.aiSummary}</span>
                </div>
              )}

              {result.regulated && (
                <div
                  className="mt-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 p-3.5 flex items-start gap-2.5"
                  data-testid="ai-regulated-notice"
                >
                  <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="text-[13px] leading-relaxed">
                    <div className="font-bold">{result.regulated.label}</div>
                    <div className="mt-0.5 text-[12px]">{result.regulated.note}</div>
                  </div>
                </div>
              )}

              {/* Ranked zone options (Phase 7 polish) */}
              {result.options?.length > 0 ? (
                <div className="mt-6 grid md:grid-cols-3 gap-3" data-testid="ai-ranked-zones">
                  {result.options.map((opt, idx) => (
                    <button
                      key={opt.zone_slug || opt.zone_name}
                      type="button"
                      onClick={() => {
                        const sp = new URLSearchParams({ activity: result.activity, source: 'ai-search' });
                        if (opt.zone_slug) sp.set('freezone', opt.zone_slug);
                        if (opt.package_id) sp.set('package', opt.package_id);
                        navigate(`/checkout?${sp.toString()}`);
                      }}
                      data-testid={`ai-zone-rank-${idx}`}
                      className={`relative text-left p-5 rounded-2xl border transition-all hover:shadow-lg hover:-translate-y-0.5 ${
                        idx === 0
                          ? 'border-emerald-700 bg-gradient-to-br from-emerald-50 to-amber-50/60 ring-2 ring-emerald-700/15'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      {idx === 0 && (
                        <span className="absolute -top-2.5 left-5 bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Trophy className="h-3 w-3" /> BEST MATCH
                        </span>
                      )}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-display text-lg font-semibold text-slate-900 truncate">{opt.zone_name}</div>
                          {opt.package_name && <div className="text-[11px] text-slate-500 truncate">{opt.package_name}</div>}
                        </div>
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-emerald-700 text-white shrink-0">{opt.score}%</span>
                      </div>
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="font-display text-2xl font-semibold text-slate-900">AED {Number(opt.gov || 0).toLocaleString()}</span>
                        <span className="text-[10px] text-slate-500">/yr</span>
                      </div>
                      <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5"><Clock className="h-3 w-3 text-emerald-700" /> {opt.processing_time}</div>
                        {opt.visa_quota ? <div className="flex items-center gap-1.5"><Users className="h-3 w-3 text-emerald-700" /> Up to {opt.visa_quota} visas</div> : null}
                      </div>
                      {opt.reasons?.length > 0 && (
                        <ul className="mt-3 space-y-1">
                          {opt.reasons.slice(0, 2).map((r) => (
                            <li key={r} className="text-[11px] text-slate-500 flex items-start gap-1.5">
                              <CheckCircle2 className="h-3 w-3 text-emerald-700 mt-0.5 shrink-0" /> {r}
                            </li>
                          ))}
                        </ul>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-6 grid md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-900/10"><div className="text-[11px] uppercase tracking-[0.2em] brand-emerald font-semibold">Best Recommendation</div><div className="font-display text-xl font-semibold text-slate-900 mt-1">{result.bestZone}</div><div className="text-sm text-slate-600 mt-1">Starting at <span className="font-semibold">{result.cost}</span> · {result.processingTime}</div></div>
                  <div className="p-5 rounded-xl bg-amber-50 border border-amber-200/60"><div className="text-[11px] uppercase tracking-[0.2em] brand-bronze font-semibold">Alternatives</div><div className="mt-2 space-y-1">{result.alternatives.map((a) => (<div key={a} className="text-sm text-slate-700 flex items-center gap-2">• {a}</div>))}</div></div>
                </div>
              )}

              <div className="mt-6 rounded-2xl bg-white border border-slate-200 p-4 lg:p-5" data-testid="ai-actions-bar">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-500">Next step</div>
                    <div className="text-sm text-slate-700 mt-0.5">Lock your AI-matched price, or explore alternatives.</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setLeadOpen(true)}
                      className="btn-primary rounded-full px-5 h-10 text-[13px]"
                      data-testid="ai-start-application"
                    >
                      Start Application <ArrowRight className="h-4 w-4 ml-1.5" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={downloadPdf}
                      disabled={downloadingPdf}
                      className="rounded-full px-4 h-10 text-[13px] border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                      data-testid="ai-download-pdf"
                    >
                      {downloadingPdf ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
                      PDF Report
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate(`/compare?activity=${encodeURIComponent(result.activity)}&zones=${encodeURIComponent((result.options || []).map((o) => o.zone_slug).filter(Boolean).join(',') || result.bestZone || '')}`)}
                      className="rounded-full px-4 h-10 text-[13px] border-slate-300"
                    >
                      Compare All
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => navigate('/consultation')}
                      className="rounded-full px-4 h-10 text-[13px] text-slate-600 hover:bg-slate-100"
                    >
                      Book Free Call
                    </Button>
                  </div>
                </div>
              </div>

              {/* Detailed comparison table — every freezone match */}
              {result.options?.length > 1 && (
                <div className="mt-7 rounded-2xl border border-slate-200 overflow-hidden" data-testid="ai-comparison-table">
                  <div className="flex items-center gap-2 px-5 py-3 bg-emerald-50 border-b border-emerald-100">
                    <BarChart3 className="h-4 w-4 text-emerald-700" />
                    <div className="text-[11px] uppercase tracking-[0.22em] font-bold text-emerald-800">Detailed comparison</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr className="text-[11px] uppercase tracking-wider text-slate-500">
                          <th className="px-4 py-3 text-left font-semibold">Free Zone</th>
                          <th className="px-4 py-3 text-left font-semibold">Package</th>
                          <th className="px-3 py-3 text-center font-semibold">Visas</th>
                          <th className="px-3 py-3 text-center font-semibold">Validity</th>
                          <th className="px-3 py-3 text-center font-semibold">Activities</th>
                          <th className="px-3 py-3 text-center font-semibold">Processing</th>
                          <th className="px-3 py-3 text-center font-semibold">Match</th>
                          <th className="px-4 py-3 text-right font-semibold">From</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.options.map((o, i) => (
                          <tr key={o.zone_slug + i} className={i === 0 ? 'bg-emerald-50/50' : (i % 2 ? 'bg-white' : 'bg-amber-50/20')}>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                {o.zone_name}
                                {i === 0 && <Trophy className="h-3.5 w-3.5 text-emerald-700" />}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{o.package_name || '—'}</td>
                            <td className="px-3 py-3 text-center font-semibold">{o.visa_quota ?? '—'}</td>
                            <td className="px-3 py-3 text-center text-slate-600">{o.raw?.duration_years ? `${o.raw.duration_years} yr${o.raw.duration_years > 1 ? 's' : ''}` : '1 yr'}</td>
                            <td className="px-3 py-3 text-center text-slate-600">{o.activities_allowed || 3}</td>
                            <td className="px-3 py-3 text-center text-slate-600">{o.processing_time}</td>
                            <td className="px-3 py-3 text-center">
                              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${i === 0 ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'}`}>{o.score}%</span>
                            </td>
                            <td className="px-4 py-3 text-right font-display font-bold text-slate-900">AED {Number(o.gov || 0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500">
                    Pricing is live from authority data. Service fee, visas and add-ons are calculated separately on the next step.
                  </div>
                </div>
              )}

              {leadOpen && (
                <form onSubmit={submitLead} className="mt-6 rounded-2xl border border-emerald-900/10 bg-white p-5 text-left">
                  <div className="text-[11px] uppercase tracking-[0.2em] brand-emerald font-semibold">Start Application</div>
                  <div className="mt-3 grid md:grid-cols-2 gap-3">
                    <Input value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} placeholder="Full name" className="h-11 rounded-xl" />
                    <Input type="email" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} placeholder="Email address" className="h-11 rounded-xl" />
                    <div className="flex gap-2"><select value={lead.countryCode} onChange={(e) => setLead({ ...lead, countryCode: e.target.value })} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">{COUNTRY_CODES.map((c) => <option key={c} value={c}>{c}</option>)}</select><Input value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value, whatsapp: e.target.value })} placeholder="Mobile / WhatsApp" className="h-11 rounded-xl" /></div>
                    <div className="relative">
                      <Input value={lead.nationality} onChange={(e) => setLead({ ...lead, nationality: e.target.value })} placeholder="Nationality" className="h-11 rounded-xl" />
                      {nationalitySuggestions.length > 0 && (
                        <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                          {nationalitySuggestions.map((c) => (
                            <button type="button" key={c} onClick={() => setLead((prev) => ({ ...prev, nationality: c }))} className="block w-full text-left px-4 py-2 text-sm hover:bg-emerald-50">{c}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="relative md:col-span-2">
                      <Input value={lead.residenceCountry} onChange={(e) => setLead({ ...lead, residenceCountry: e.target.value })} placeholder="Country of residence e.g. India, UAE, Pakistan" className="h-11 rounded-xl" />
                      {countrySuggestions.length > 0 && (
                        <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                          {countrySuggestions.map((c) => (
                            <button type="button" key={c} onClick={() => setLead((prev) => ({ ...prev, residenceCountry: c }))} className="block w-full text-left px-4 py-2 text-sm hover:bg-emerald-50">{c}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {leadError && <div className="mt-3 text-sm text-red-600">{leadError}</div>}
                  {restrictedWarning && <div className="mt-3 text-sm rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-amber-900" data-testid="ai-restricted-warning">{restrictedWarning}</div>}
                  <div className="mt-4 flex justify-end"><Button type="submit" disabled={savingLead} className="btn-primary rounded-full px-6 h-11">{savingLead ? 'Saving…' : 'Continue to Application'}</Button></div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
