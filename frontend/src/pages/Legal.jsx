import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Sparkles } from 'lucide-react';

function LegalPage({ title, subtitle, body }) {
  return (
    <div>
      <Navbar />
      <section className="hero-gradient grain">
        <div className="max-w-4xl mx-auto px-5 lg:px-8 pt-14 pb-10">
          <div className="flex items-center gap-2 fade-up"><Sparkles className="h-4 w-4 brand-bronze" /><span className="text-xs uppercase tracking-[0.22em] text-slate-600 font-semibold">Legal</span></div>
          <h1 className="mt-3 font-display text-5xl font-semibold text-slate-900 fade-up delay-100">{title}</h1>
          <p className="mt-2 text-slate-600 fade-up delay-200">{subtitle}</p>
        </div>
      </section>
      <section className="py-14 bg-[#FFFCF5]">
        <div className="max-w-3xl mx-auto px-5 lg:px-8 prose prose-slate">
          {body}
        </div>
      </section>
      <Footer />
    </div>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Privacy Policy" subtitle="How we handle your data" body={(
      <div className="space-y-4 text-slate-700 leading-relaxed">
        <p>SmartSetupUAE.ae (operated by Axiscrest-Global FZE LLC) collects personal information you voluntarily provide — such as name, email, WhatsApp number, business activity and budget — in order to provide a free consultation and license shortlist.</p>
        <p>We do not sell your data. Information is shared only with relevant UAE freezone authorities or banks if you explicitly request setup.</p>
        <p>Data is stored securely. You may request deletion at any time via our <a href="/data-deletion" className="brand-emerald font-semibold">Data Deletion Page</a>.</p>
        <p>Cookies are used for analytics and session continuity. By using the site you consent to this.</p>
      </div>
    )} />
  );
}

export function Terms() {
  return (
    <LegalPage title="Terms & Conditions" subtitle="Please read carefully" body={(
      <div className="space-y-4 text-slate-700 leading-relaxed">
        <p>SmartSetupUAE.ae is a private consultancy operated by Axiscrest-Global FZE LLC (License 262843696888) and not a government body.</p>
        <p>Pricing displayed is indicative and subject to authority approvals. Government fees are non-refundable once submitted. Service fees are governed by our refund policy.</p>
        <p>By engaging our services you agree to provide accurate information, comply with UAE law and authorise SmartSetupUAE to liaise with selected jurisdictions on your behalf.</p>
      </div>
    )} />
  );
}

export function Refund() {
  return (
    <LegalPage title="Refund Policy" subtitle="Transparent and fair" body={(
      <div className="space-y-4 text-slate-700 leading-relaxed">
        <p>Pre-booking deposit of AED 999 is fully refundable within 7 days if the application has not been submitted to the relevant authority.</p>
        <p>Government fees are non-refundable once paid to the freezone or DED authority.</p>
        <p>Service fees are refundable on a pro-rata basis depending on the stage of completion. Email <span className="font-semibold">info@smartsetupuae.ae</span> to request a refund.</p>
      </div>
    )} />
  );
}

export function DataDeletion() {
  return (
    <LegalPage title="Data Deletion" subtitle="Erase your data on request" body={(
      <div className="space-y-4 text-slate-700 leading-relaxed">
        <p>You have the right to request deletion of all personal data we hold about you.</p>
        <p>Email <span className="font-semibold">info@smartsetupuae.ae</span> with the subject line “Data Deletion Request” and the registered name + email + phone associated with your enquiry.</p>
        <p>We process all requests within 30 days. A confirmation will be sent once data is erased. Data legally required to be retained (e.g. submitted licence applications) will be redacted from active systems and archived per UAE law.</p>
      </div>
    )} />
  );
}
