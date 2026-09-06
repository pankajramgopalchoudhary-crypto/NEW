import React, { useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { CheckCircle2, MessageSquareText } from 'lucide-react';
import { COUNTRY_CODES, BUDGETS, VISA_OPTIONS, OFFICE_TYPES } from '../mock';
import { useToast } from '../hooks/use-toast';
import { captureLead } from '../lib/supabaseRest';

export default function LeadBox({ sourcePage = 'home', freezoneName = '', compact = false }) {
  const [data, setData] = useState({
    name: '', code: '+971', phone: '', activity: '',
    visas: '1 Visa', budget: 'Any Budget', office: 'Virtual Desk',
  });
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const upd = (k, v) => setData((d) => ({ ...d, [k]: v }));

  const submit = async (e) => {
    e?.preventDefault();
    if (!data.name || !data.phone) {
      toast({ title: 'Add your name & WhatsApp', description: 'Required to send your free shortlist.' });
      return;
    }
    const payload = {
      source_page: sourcePage,
      freezone_name: freezoneName || undefined,
      name: data.name,
      phone_country_code: data.code,
      phone_number: data.phone,
      business_activity: data.activity || undefined,
      visa_required: data.visas,
      budget: data.budget,
      office_requirement: data.office,
    };
    setBusy(true);
    try {
      await captureLead(payload);
    } catch {
      // Fallback: cache locally so we don't lose the lead
      const leads = JSON.parse(localStorage.getItem('ssu_leads') || '[]');
      leads.push({ ...payload, created_at: new Date().toISOString(), status: 'pending_sync' });
      localStorage.setItem('ssu_leads', JSON.stringify(leads));
    }
    setBusy(false);
    setDone(true);
    toast({ title: 'Enquiry received', description: 'Our WhatsApp Agent will reach out within minutes.' });
  };

  if (done) {
    return (
      <div className="card-elevated rounded-2xl p-7">
        <div className="h-12 w-12 rounded-full bg-emerald-50 grid place-items-center"><CheckCircle2 className="h-6 w-6 brand-emerald" /></div>
        <h3 className="font-display text-2xl font-semibold text-slate-900 mt-4">Thanks, {data.name.split(' ')[0]}!</h3>
        <p className="text-slate-600 mt-1 text-sm">Our <span className="font-semibold">WhatsApp Agent</span> will reach out on {data.code} {data.phone} within minutes.</p>
        <Button onClick={() => setDone(false)} variant="outline" size="sm" className="rounded-full mt-5 border-slate-300">Submit another</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card-elevated rounded-2xl p-4 sm:p-5" data-testid="lead-box-form">
      <div className="flex items-center gap-1.5">
        <MessageSquareText className="h-3.5 w-3.5 brand-emerald" />
        <div className="text-[9px] uppercase tracking-[0.22em] font-semibold text-slate-500">Universal Lead Enquiry</div>
      </div>
      <h3 className="font-display text-base sm:text-lg font-semibold text-slate-900 mt-0.5">Free shortlist in minutes</h3>
      <div className="mt-3 space-y-2.5">
        <div>
          <label className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Full Name *</label>
          <Input data-testid="lead-name-input" value={data.name} onChange={(e) => upd('name', e.target.value)} placeholder="Your full name" className="mt-0.5 h-9 text-sm rounded-lg" />
        </div>
        <div>
          <label className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Phone / WhatsApp *</label>
          <div className="mt-0.5 flex gap-1.5">
            <Select value={data.code} onValueChange={(v) => upd('code', v)}>
              <SelectTrigger className="w-[88px] h-9 rounded-lg text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="z-[120]">
                {COUNTRY_CODES.map((c) => (<SelectItem key={c.label} value={c.code}>{c.label}</SelectItem>))}
              </SelectContent>
            </Select>
            <Input data-testid="lead-phone-input" value={data.phone} onChange={(e) => upd('phone', e.target.value.replace(/[^0-9]/g, '').slice(0, 12))} placeholder="Mobile number" className="h-9 text-sm rounded-lg" />
          </div>
        </div>
        {!compact && (
          <div>
            <label className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Business Activity</label>
            <Input value={data.activity} onChange={(e) => upd('activity', e.target.value)} placeholder="e.g., E-Commerce" className="mt-0.5 h-9 text-sm rounded-lg" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Visa Required</label>
            <Select value={data.visas} onValueChange={(v) => upd('visas', v)}>
              <SelectTrigger className="mt-0.5 h-9 rounded-lg text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="z-[120]">{VISA_OPTIONS.map((v) => (<SelectItem key={v} value={v}>{v}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Setup Budget</label>
            <Select value={data.budget} onValueChange={(v) => upd('budget', v)}>
              <SelectTrigger className="mt-0.5 h-9 rounded-lg text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="z-[120]">{BUDGETS.map((b) => (<SelectItem key={b} value={b}>{b}</SelectItem>))}</SelectContent>
            </Select>
          </div>
        </div>
        {!compact && (
          <div>
            <label className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Office Requirement</label>
            <Select value={data.office} onValueChange={(v) => upd('office', v)}>
              <SelectTrigger className="mt-0.5 h-9 rounded-lg text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="z-[120]">{OFFICE_TYPES.map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}</SelectContent>
            </Select>
          </div>
        )}
        <Button type="submit" disabled={busy} data-testid="lead-submit-btn" className="btn-primary rounded-full w-full h-10 text-sm">{busy ? 'Sending…' : 'Send to WhatsApp Agent'}</Button>
        <div className="text-[9px] text-slate-500 text-center">Replies within minutes · No spam · Zero sales pressure</div>
      </div>
    </form>
  );
}
