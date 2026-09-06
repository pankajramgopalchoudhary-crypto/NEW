import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Briefcase, MapPin, Clock, Sparkles, Users, ArrowRight, X, CheckCircle2, Send } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function Careers() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState(null);
  const [apply, setApply] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch(`${API}/api/careers/jobs`)
      .then((r) => r.json())
      .then((d) => { if (alive) setJobs(d.jobs || []); })
      .catch((e) => { if (alive) setError(String(e.message || e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return (
    <div data-testid="careers-page">
      <Navbar />

      <section className="hero-gradient grain">
        <div className="max-w-[1280px] mx-auto px-5 lg:px-8 pt-10 lg:pt-14 pb-12 lg:pb-16 text-center">
          <div className="inline-flex items-center gap-2 fade-up justify-center">
            <Sparkles className="h-3.5 w-3.5 brand-bronze" />
            <span className="text-[10px] uppercase tracking-[0.22em] text-slate-600 font-semibold">Careers · Hiring 2026</span>
          </div>
          <h1 className="mt-3 font-display font-semibold text-slate-900 fade-up delay-100" style={{ fontSize: 'clamp(1.7rem, 3.6vw, 3.2rem)', lineHeight: 1.06 }}>
            Help us build a <span className="shine-text">founder-first</span> UAE setup platform.
          </h1>
          <p className="mt-3 text-slate-600 max-w-2xl mx-auto text-sm lg:text-[15px] fade-up delay-200">
            We are growing the team behind SmartSetupUAE.ae — Axiscrest-Global FZE LLC. Honest pricing,
            zero freezone commissions and a culture of building tools, not chasing numbers.
          </p>
        </div>
      </section>

      <section className="py-12 lg:py-16 bg-[#FFFCF5] rounded-t-[36px] mx-3 lg:mx-6 -mt-4 shadow-[0_-20px_40px_-30px_rgba(15,42,42,0.15)]">
        <div className="max-w-[1280px] mx-auto px-5 lg:px-8">
          <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] font-bold brand-bronze">Open Roles</div>
              <h2 className="font-display text-xl lg:text-3xl font-semibold text-slate-900 mt-1">Currently hiring</h2>
            </div>
            <div className="text-xs text-slate-500">{jobs.length} role{jobs.length === 1 ? '' : 's'} · Updated live</div>
          </div>

          {loading && (
            <div className="grid md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-2xl bg-white border border-slate-200 p-5 animate-pulse">
                  <div className="h-4 w-2/3 bg-slate-200 rounded mb-2" />
                  <div className="h-3 w-1/2 bg-slate-100 rounded mb-4" />
                  <div className="h-3 w-full bg-slate-100 rounded mb-1" />
                  <div className="h-3 w-3/4 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
              We can’t load roles right now. Email <a href="mailto:career@smartsetupuae.ae" className="font-semibold underline">career@smartsetupuae.ae</a> directly.
            </div>
          )}
          {!loading && !error && jobs.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
              No active roles right now — but we always read CVs. Drop yours at{' '}
              <a href="mailto:career@smartsetupuae.ae" className="font-semibold brand-emerald underline">career@smartsetupuae.ae</a>.
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            {jobs.map((j) => (
              <div key={j.id} className="rounded-2xl bg-white border border-slate-200 p-5 hover:border-emerald-700/30 hover:shadow-lg transition-all" data-testid={`career-card-${j.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-bold brand-emerald">{j.department}</div>
                    <div className="font-display text-lg font-bold text-slate-900 mt-1">{j.title}</div>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-100 text-emerald-800">{j.employment_type}</span>
                </div>
                <div className="mt-2.5 flex items-center gap-3 text-[12px] text-slate-600 flex-wrap">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {j.location}</span>
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {j.experience}</span>
                  {j.salary_range && <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> {j.salary_range}</span>}
                </div>
                <p className="mt-3 text-[13px] text-slate-600 leading-relaxed line-clamp-3">{j.description}</p>
                <div className="mt-4 flex items-center gap-2">
                  <Button onClick={() => setActive(j)} className="rounded-full h-9 px-4 text-[12.5px]" variant="outline" data-testid={`career-view-${j.id}`}>
                    View details
                  </Button>
                  <Button onClick={() => setApply(j)} className="btn-primary rounded-full h-9 px-4 text-[12.5px]" data-testid={`career-apply-${j.id}`}>
                    Apply <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {active && <JobDetailModal job={active} onClose={() => setActive(null)} onApply={() => { setApply(active); setActive(null); }} />}
      {apply && <ApplyModal job={apply} onClose={() => setApply(null)} />}

      <Footer />
    </div>
  );
}

function JobDetailModal({ job, onClose, onApply }) {
  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="relative bg-white rounded-3xl max-w-2xl w-full max-h-[88vh] overflow-y-auto shadow-2xl" data-testid="career-detail-modal">
        <button onClick={onClose} className="absolute top-4 right-4 h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 grid place-items-center" data-testid="career-close-detail">
          <X className="h-4 w-4" />
        </button>
        <div className="p-6 lg:p-8">
          <div className="text-[10px] uppercase tracking-wider font-bold brand-emerald">{job.department}</div>
          <h2 className="font-display text-2xl font-bold text-slate-900 mt-1">{job.title}</h2>
          <div className="mt-2 flex items-center gap-3 text-xs text-slate-600 flex-wrap">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {job.location}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {job.experience}</span>
            {job.salary_range && <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> {job.salary_range}</span>}
          </div>
          <p className="mt-4 text-sm text-slate-700 leading-relaxed">{job.description}</p>

          {job.responsibilities?.length > 0 && (
            <div className="mt-5">
              <div className="font-semibold text-slate-900 mb-1.5">Responsibilities</div>
              <ul className="space-y-1.5 text-sm text-slate-700">
                {job.responsibilities.map((r, i) => <li key={i} className="flex gap-2"><CheckCircle2 className="h-4 w-4 brand-emerald shrink-0 mt-0.5" /> {r}</li>)}
              </ul>
            </div>
          )}
          {job.requirements?.length > 0 && (
            <div className="mt-5">
              <div className="font-semibold text-slate-900 mb-1.5">Requirements</div>
              <ul className="space-y-1.5 text-sm text-slate-700">
                {job.requirements.map((r, i) => <li key={i} className="flex gap-2"><CheckCircle2 className="h-4 w-4 brand-emerald shrink-0 mt-0.5" /> {r}</li>)}
              </ul>
            </div>
          )}
          {job.perks?.length > 0 && (
            <div className="mt-5">
              <div className="font-semibold text-slate-900 mb-1.5">Perks</div>
              <ul className="space-y-1.5 text-sm text-slate-700">
                {job.perks.map((r, i) => <li key={i} className="flex gap-2"><Sparkles className="h-4 w-4 brand-bronze shrink-0 mt-0.5" /> {r}</li>)}
              </ul>
            </div>
          )}

          <div className="mt-6">
            <Button onClick={onApply} className="btn-primary rounded-full h-11 px-5" data-testid="career-detail-apply">
              Apply for this role <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApplyModal({ job, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', nationality: '', years_experience: '', cover_letter: '', resume_url: '' });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!form.name || !form.email) { setErr('Name and email are required.'); return; }
    setSubmitting(true);
    try {
      const r = await fetch(`${API}/api/careers/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, job_id: job.id }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.detail || 'Submission failed');
      }
      setDone(true);
    } catch (e) {
      setErr(e.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="relative bg-white rounded-3xl max-w-lg w-full max-h-[88vh] overflow-y-auto shadow-2xl" data-testid="career-apply-modal">
        <button onClick={onClose} className="absolute top-4 right-4 h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 grid place-items-center" data-testid="career-close-apply">
          <X className="h-4 w-4" />
        </button>
        <div className="p-6 lg:p-8">
          {!done ? (
            <>
              <div className="text-[10px] uppercase tracking-wider font-bold brand-emerald">Apply</div>
              <h3 className="font-display text-xl font-bold text-slate-900 mt-1">{job.title}</h3>
              <p className="text-xs text-slate-500 mt-1">Goes directly to career@smartsetupuae.ae · Reply within 7 working days.</p>
              {err && <div className="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{err}</div>}
              <form onSubmit={submit} className="space-y-3 mt-4">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Full name *</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 h-10 rounded-lg text-sm" data-testid="apply-name" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Email *</label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 h-10 rounded-lg text-sm" data-testid="apply-email" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Phone</label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 h-10 rounded-lg text-sm" data-testid="apply-phone" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Nationality</label>
                    <Input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} className="mt-1 h-10 rounded-lg text-sm" data-testid="apply-nationality" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Years experience</label>
                    <Input value={form.years_experience} onChange={(e) => setForm({ ...form, years_experience: e.target.value })} className="mt-1 h-10 rounded-lg text-sm" data-testid="apply-exp" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">CV / Resume link (Google Drive, Dropbox, LinkedIn)</label>
                  <Input value={form.resume_url} onChange={(e) => setForm({ ...form, resume_url: e.target.value })} className="mt-1 h-10 rounded-lg text-sm" placeholder="https://..." data-testid="apply-resume" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Why are you the right fit?</label>
                  <textarea value={form.cover_letter} onChange={(e) => setForm({ ...form, cover_letter: e.target.value })} rows={5} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-700" data-testid="apply-cover" />
                </div>
                <Button type="submit" disabled={submitting} className="btn-primary rounded-full w-full h-11" data-testid="apply-submit">
                  {submitting ? 'Submitting…' : <><Send className="h-4 w-4 mr-1.5" /> Submit application</>}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center py-6">
              <div className="mx-auto h-14 w-14 rounded-full bg-emerald-100 grid place-items-center brand-emerald">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h3 className="font-display text-2xl font-bold text-slate-900 mt-3">Application received</h3>
              <p className="text-sm text-slate-600 mt-1.5 max-w-sm mx-auto">
                Thanks {form.name?.split(' ')[0]}! Our team will reply to <span className="font-semibold">{form.email}</span> within 7 working days.
              </p>
              <Button onClick={onClose} className="mt-5 btn-primary rounded-full h-10 px-5" data-testid="apply-close-done">
                Close
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
