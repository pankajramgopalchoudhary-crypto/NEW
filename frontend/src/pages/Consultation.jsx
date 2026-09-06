import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { BUDGETS, COUNTRY_CODES } from '../mock';
import { CheckCircle2, Phone, Mail, MessageCircle, Sparkles } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { captureLead } from '../lib/supabaseRest';
import { useLocation, useSearchParams } from 'react-router-dom';

export default function Consultation() {
  const location = useLocation();
  const [params] = useSearchParams();
  const initialService = location.state?.service || params.get('service') || 'Free Zone Setup';
  const initialMessage = location.state?.message || '';
  const [data, setData] = useState({ name: '', email: '', code: '+971', phone: '', service: initialService, budget: 'Any Budget', message: initialMessage });
  const [done, setDone] = useState(false);
  const { toast } = useToast();
  const upd = (k, v) => setData((d) => ({ ...d, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!data.name || !data.email || !data.phone) {
      toast({ title: 'Please complete the required fields' });
      return;
    }
    const payload = {
      source_page: 'consultation',
      name: data.name,
      email: data.email,
      phone_country_code: data.code,
      phone_number: data.phone,
      business_activity: data.service,
      budget: data.budget,
      message: data.message,
    };
    try {
      await captureLead(payload);
    } catch {
      const list = JSON.parse(localStorage.getItem('ssu_consultations') || '[]');
      list.push({ ...payload, at: new Date().toISOString(), status: 'pending_sync' });
      localStorage.setItem('ssu_consultations', JSON.stringify(list));
    }
    setDone(true);
    toast({ title: 'Request submitted', description: 'An advisor will contact you within minutes.' });
  };

  return (
    <div>
      <Navbar />
      <section className="hero-gradient grain">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 pt-3 lg:pt-6 pb-10 grid lg:grid-cols-12 gap-12">
          <div className="lg:col-span-6">
            <div className="flex items-center gap-2 fade-up"><Sparkles className="h-4 w-4 brand-bronze" /><span className="text-xs uppercase tracking-[0.22em] text-slate-600 font-semibold">Book a Free Consultation</span></div>
            <h1 className="mt-4 font-display text-5xl lg:text-6xl font-semibold leading-[1.02] text-slate-900 fade-up delay-100">A 30-minute call,<br /><span className="shine-text">zero sales pressure.</span></h1>
            <p className="mt-5 text-slate-600 max-w-md fade-up delay-200">Tell us a little about your plan. A senior advisor will respond within minutes during business hours (9am–9pm UAE).</p>
            <div className="mt-8 space-y-4 fade-up delay-300">
              <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl bg-emerald-50 grid place-items-center"><Phone className="h-4 w-4 brand-emerald" /></div><div><div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-semibold">Phone</div><div className="font-semibold text-slate-900">+971 56 303 5503</div></div></div>
              <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl bg-emerald-50 grid place-items-center"><Mail className="h-4 w-4 brand-emerald" /></div><div><div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-semibold">Email</div><div className="font-semibold text-slate-900">hello@smartsetupuae.ae</div></div></div>
              <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl bg-emerald-50 grid place-items-center"><MessageCircle className="h-4 w-4 brand-emerald" /></div><div><div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-semibold">WhatsApp</div><div className="font-semibold text-slate-900">+971 58 590 3155</div></div></div>
            </div>
          </div>
          <div className="lg:col-span-6">
            {done ? (
              <div className="card-elevated rounded-3xl p-10 text-center fade-up">
                <div className="h-14 w-14 rounded-full bg-emerald-50 grid place-items-center mx-auto"><CheckCircle2 className="h-7 w-7 brand-emerald" /></div>
                <h3 className="font-display text-3xl font-semibold mt-5">You're booked, {data.name.split(' ')[0]}!</h3>
                <p className="text-slate-600 mt-2">An advisor will WhatsApp you on {data.code} {data.phone} shortly.</p>
                <Button onClick={() => setDone(false)} variant="outline" className="rounded-full mt-6 border-slate-300">Submit another</Button>
              </div>
            ) : (
              <form onSubmit={submit} className="card-elevated rounded-3xl p-7 lg:p-9 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div><label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Name *</label><Input value={data.name} onChange={(e) => upd('name', e.target.value)} className="mt-1.5 h-11 rounded-lg" placeholder="Your full name" /></div>
                  <div><label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Email *</label><Input type="email" value={data.email} onChange={(e) => upd('email', e.target.value)} className="mt-1.5 h-11 rounded-lg" placeholder="you@company.com" /></div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">WhatsApp *</label>
                  <div className="mt-1.5 flex gap-2">
                    <Select value={data.code} onValueChange={(v) => upd('code', v)}>
                      <SelectTrigger className="w-[110px] h-11 rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>{COUNTRY_CODES.map((c) => (<SelectItem key={c.label} value={c.code}>{c.label}</SelectItem>))}</SelectContent>
                    </Select>
                    <Input value={data.phone} onChange={(e) => upd('phone', e.target.value.replace(/[^0-9]/g, ''))} className="h-11 rounded-lg" placeholder="50 123 4567" />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Service</label>
                    <Select value={data.service} onValueChange={(v) => upd('service', v)}>
                      <SelectTrigger className="mt-1.5 h-11 rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>{['Free Zone Setup', 'Mainland Formation', 'Golden Visa', 'Investor / Partner Visa', 'Employment Visa', 'Family Visa', 'Bank Account', 'Not Sure Yet'].map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Budget</label>
                    <Select value={data.budget} onValueChange={(v) => upd('budget', v)}>
                      <SelectTrigger className="mt-1.5 h-11 rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>{BUDGETS.map((b) => (<SelectItem key={b} value={b}>{b}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tell us about your business</label>
                  <Textarea value={data.message} onChange={(e) => upd('message', e.target.value)} rows={4} className="mt-1.5 rounded-lg" placeholder="What do you plan to do? Any specific activity, visa or banking question?" />
                </div>
                <Button type="submit" className="btn-primary rounded-full w-full h-12">Book Free Consultation</Button>
                <div className="text-[11px] text-slate-500 text-center">We respond within minutes during business hours (9am–9pm UAE)</div>
              </form>
            )}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
