import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { BUDGETS, COUNTRY_CODES, VISA_OPTIONS, OFFICE_TYPES } from '../mock';
import { useToast } from '../hooks/use-toast';
import { captureLead } from '../lib/supabaseRest';

export default function SmartFinder() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    name: '', code: '+971', phone: '', budget: 'Any Budget',
    activity: '', visas: '1 Visa', office: 'Virtual Desk',
  });
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const upd = (k, v) => setData((d) => ({ ...d, [k]: v }));

  const handleNext = () => {
    if (!data.name || !data.phone) {
      toast({ title: 'Please complete the form', description: 'Name and WhatsApp number are required.' });
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!data.activity) {
      toast({ title: 'Add your business activity', description: 'Tell us what you plan to do.' });
      return;
    }
    const payload = {
      source_page: 'smart_finder',
      name: data.name,
      phone_country_code: data.code,
      phone_number: data.phone,
      business_activity: data.activity,
      visa_required: data.visas,
      budget: data.budget,
      office_requirement: data.office,
    };
    try {
      await captureLead(payload);
    } catch {
      const leads = JSON.parse(localStorage.getItem('ssu_leads') || '[]');
      leads.push({ ...payload, at: new Date().toISOString(), status: 'pending_sync' });
      localStorage.setItem('ssu_leads', JSON.stringify(leads));
    }
    toast({ title: 'Match request received', description: 'We will contact you on WhatsApp within minutes.' });
    navigate(`/free-zones?compare=${encodeURIComponent(data.activity)}`);
  };

  if (submitted) {
    return (
      <div className="card-elevated rounded-2xl p-8">
        <div className="h-12 w-12 rounded-full bg-emerald-900/10 grid place-items-center mb-4">
          <CheckCircle2 className="h-6 w-6 brand-emerald" />
        </div>
        <h3 className="font-display text-2xl font-semibold text-slate-900">You're all set, {data.name.split(' ')[0]}!</h3>
        <p className="mt-2 text-slate-600">Our advisor will reach out on WhatsApp within minutes with your shortlist of 3–5 best-fit jurisdictions.</p>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {['Activity Verified', 'Cost Estimated', 'Visa Plan Drafted'].map((t) => (
            <div key={t} className="text-[11px] font-medium text-slate-700 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-900/10 text-center">✓ {t}</div>
          ))}
        </div>
        <Button onClick={() => { setStep(1); setSubmitted(false); }} variant="ghost" className="mt-6 brand-emerald hover:bg-emerald-50">Submit another</Button>
      </div>
    );
  }

  return (
    <div className="card-elevated rounded-2xl p-7">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-semibold">Smart Finder · Step {step} of 2</div>
        <div className="flex items-center gap-1">
          <div className={`h-1.5 w-8 rounded-full ${step >= 1 ? 'bg-brand-emerald' : 'bg-slate-200'}`} />
          <div className={`h-1.5 w-8 rounded-full ${step >= 2 ? 'bg-brand-emerald' : 'bg-slate-200'}`} />
        </div>
      </div>

      {step === 1 && (
        <div className="mt-5">
          <h3 className="font-display text-2xl font-semibold text-slate-900">Find Your Free Zone</h3>
          <p className="text-sm text-slate-600 mt-1">Tell us about yourself — we'll find the perfect jurisdiction in seconds.</p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Your Name</label>
              <Input value={data.name} onChange={(e) => upd('name', e.target.value)} placeholder="e.g., Aman Khan" className="mt-1.5 h-11 rounded-lg" />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">WhatsApp Number</label>
              <div className="mt-1.5 flex gap-2">
                <Select value={data.code} onValueChange={(v) => upd('code', v)}>
                  <SelectTrigger className="w-[110px] h-11 rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTRY_CODES.map((c) => (<SelectItem key={c.label} value={c.code}>{c.label}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Input value={data.phone} onChange={(e) => upd('phone', e.target.value.replace(/[^0-9]/g, ''))} placeholder="50 123 4567" className="h-11 rounded-lg" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Budget (AED)</label>
              <Select value={data.budget} onValueChange={(v) => upd('budget', v)}>
                <SelectTrigger className="mt-1.5 h-11 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUDGETS.map((b) => (<SelectItem key={b} value={b}>{b}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleNext} className="btn-primary rounded-full w-full h-12 mt-2">Continue <ArrowRight className="h-4 w-4 ml-2" /></Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-5">
          <h3 className="font-display text-2xl font-semibold text-slate-900">Tell us about your business</h3>
          <p className="text-sm text-slate-600 mt-1">We'll instantly shortlist 3–5 optimal jurisdictions.</p>
          <div className="mt-5 space-y-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Business Activity</label>
              <Input value={data.activity} onChange={(e) => upd('activity', e.target.value)} placeholder="e.g., Software Development" className="mt-1.5 h-11 rounded-lg" />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Visas Needed</label>
              <Select value={data.visas} onValueChange={(v) => upd('visas', v)}>
                <SelectTrigger className="mt-1.5 h-11 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VISA_OPTIONS.map((v) => (<SelectItem key={v} value={v}>{v}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Office Type</label>
              <Select value={data.office} onValueChange={(v) => upd('office', v)}>
                <SelectTrigger className="mt-1.5 h-11 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OFFICE_TYPES.map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={() => setStep(1)} variant="outline" className="rounded-full h-12 flex-1 border-slate-300"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
              <Button onClick={handleSubmit} className="btn-primary rounded-full h-12 flex-[2]">Compare Free Zones <ArrowRight className="h-4 w-4 ml-2" /></Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 p-3 rounded-lg bg-amber-50 border border-amber-200/60 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-amber-700 font-semibold">Early Bird — 5% off today</div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-slate-500 line-through text-sm">AED 4,888</span>
            <span className="font-display text-xl font-bold text-slate-900">AED 4,643</span>
          </div>
        </div>
        <div className="text-[11px] text-amber-700 font-medium">ANCFZ starter</div>
      </div>
    </div>
  );
}
