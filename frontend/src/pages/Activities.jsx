import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ActivitySearch from '../components/ActivitySearch';
import LeadBox from '../components/LeadBox';
import { Sparkles } from 'lucide-react';

export default function Activities() {
  return (
    <div>
      <Navbar />
      <section className="hero-gradient grain">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 pt-10 pb-12 grid lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-7">
            <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 brand-bronze" /><span className="text-xs uppercase tracking-[0.22em] text-slate-600 font-semibold">Business Activity Search</span></div>
            <h1 className="mt-4 font-display text-5xl lg:text-7xl font-semibold leading-[1.02] text-slate-900">Choose the right activity before applying.</h1>
            <p className="mt-5 text-lg text-slate-600 max-w-2xl">Search approved business activities by keyword, code and jurisdiction. The data is pulled from your Supabase activity master table.</p>
          </div>
          <div className="lg:col-span-5 lg:sticky lg:top-24 self-start">
            <LeadBox sourcePage="activities" freezoneName="Activity Search" />
          </div>
        </div>
      </section>
      <ActivitySearch />
      <Footer />
    </div>
  );
}
