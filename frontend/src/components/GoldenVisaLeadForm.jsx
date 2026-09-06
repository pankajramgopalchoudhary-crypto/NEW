/**
 * Golden Visa lead form — embedded on /golden-visa page.
 * Submits to /api/lifecycle/golden-visa/lead (also pushes to Supabase `leads` server-side).
 */
import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Crown, Send, CheckCircle2 } from 'lucide-react';
import { lifecycleApi } from '../lib/backendApi';

const CATEGORIES = [
  { key: 'investor',     label: 'Investor (AED 2M+ real estate / business)' },
  { key: 'entrepreneur', label: 'Entrepreneur (UAE incubator / start-up AED 500K+)' },
  { key: 'talent',       label: 'Specialised Talent (doctor, scientist, engineer, exec)' },
  { key: 'student',      label: 'Outstanding Student' },
  { key: 'professional', label: 'Senior Professional (salary AED 30K+)' },
  { key: 'other',        label: 'Other / not sure' },
];

export default function GoldenVisaLeadForm() {
  const [form, setForm] = useState({
    name: '', phone: '', whatsapp: '', email: '',
    nationality: '', current_country: '', category: 'investor', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setSubmitting(true);
    try {
      await lifecycleApi.golden({ ...form, whatsapp: form.whatsapp || form.phone });
      setDone(true);
    } catch (ex) {
      setErr(ex.message || 'Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-3xl p-8 bg-emerald-50 border border-emerald-200 text-center" data-testid="golden-visa-success">
        <CheckCircle2 className="h-10 w-10 brand-emerald mx-auto" />
        <div className="font-display text-2xl font-semibold text-slate-900 mt-3">Eligibility request received.</div>
        <p className="text-slate-700 mt-1 text-sm">A senior advisor will WhatsApp you within 2 hours with a personalised eligibility report.</p>
        <a href="https://wa.me/971585903155" target="_blank" rel="noreferrer"
           className="inline-flex items-center gap-2 mt-4 px-5 h-11 rounded-full bg-emerald-700 text-white font-semibold"
           data-testid="golden-visa-whatsapp">Chat with advisor on WhatsApp →</a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-3xl p-7 bg-white border border-amber-200 shadow-lg" data-testid="golden-visa-form">
      <div className="flex items-center gap-2"><Crown className="h-5 w-5 brand-bronze" /><div className="text-[11px] uppercase tracking-[0.22em] font-semibold brand-bronze">Free Eligibility Check</div></div>
      <h3 className="mt-2 font-display text-2xl font-semibold text-slate-900">Check Golden Visa eligibility in 30 seconds.</h3>
      <p className="text-sm text-slate-600 mt-1">Free assessment by a UAE-licensed advisor.</p>

      <div className="grid sm:grid-cols-2 gap-3 mt-5">
        <div>
          <label className="text-xs text-slate-500 font-semibold">Full name *</label>
          <Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required className="h-11 mt-1" placeholder="As per passport" data-testid="gv-name" />
        </div>
        <div>
          <label className="text-xs text-slate-500 font-semibold">Mobile / WhatsApp *</label>
          <Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} required className="h-11 mt-1" placeholder="+971 5XX XXX XXX" data-testid="gv-phone" />
        </div>
        <div>
          <label className="text-xs text-slate-500 font-semibold">Email</label>
          <Input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="h-11 mt-1" placeholder="you@example.com" data-testid="gv-email" />
        </div>
        <div>
          <label className="text-xs text-slate-500 font-semibold">Nationality *</label>
          <Input value={form.nationality} onChange={(e) => setForm({...form, nationality: e.target.value})} required className="h-11 mt-1" placeholder="e.g. Indian, British" data-testid="gv-nat" />
        </div>
        <div>
          <label className="text-xs text-slate-500 font-semibold">Currently living in *</label>
          <Input value={form.current_country} onChange={(e) => setForm({...form, current_country: e.target.value})} required className="h-11 mt-1" placeholder="UAE / India / UK / …" data-testid="gv-country" />
        </div>
        <div>
          <label className="text-xs text-slate-500 font-semibold">Category *</label>
          <select
            value={form.category}
            onChange={(e) => setForm({...form, category: e.target.value})}
            className="w-full h-11 mt-1 rounded-md border border-slate-300 px-3 text-sm"
            data-testid="gv-category"
          >
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-slate-500 font-semibold">Anything else? (optional)</label>
          <Input value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} className="h-11 mt-1" placeholder="Investment size, profession, urgency …" data-testid="gv-notes" />
        </div>
      </div>

      {err && <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900" data-testid="gv-error">{err}</div>}

      <Button type="submit" disabled={submitting} className="btn-primary rounded-full w-full mt-5 h-12 text-base" data-testid="gv-submit">
        {submitting ? 'Submitting…' : <><Send className="h-4 w-4 mr-2" /> Send free eligibility request</>}
      </Button>
      <div className="text-[11px] text-slate-500 mt-3 text-center">By submitting you agree to our Privacy Policy. We will WhatsApp you within 2 hours.</div>
    </form>
  );
}
