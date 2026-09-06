import React from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import LeadBox from '../components/LeadBox';
import { Button } from '../components/ui/button';
import { CheckCircle2, ArrowRight, FileText, Clock, ShieldCheck } from 'lucide-react';

export const SERVICES = {
  'investor-visa': {
    title: 'Investor Visa',
    tag: 'Residency',
    intro: 'Long-term UAE residency for company owners and shareholders, linked to your trade licence.',
    priceRange: 'AED 3,500 – 6,000 per visa',
    serviceFee: 'AED 1,500 SmartSetupUAE handling',
    eligibility: ['Hold a valid UAE trade licence', 'Shareholder / partner in the company', 'Valid passport (6+ months)', 'Clear medical fitness test'],
    benefits: ['2-year renewable residency', 'Sponsor family members', 'Open personal & corporate bank accounts', 'Emirates ID & health insurance'],
    documents: ['Passport copy', 'Trade licence', 'MOA / share certificate', 'Passport photo', 'Entry permit'],
    process: ['Entry permit issuance', 'Status change / entry', 'Medical + Emirates ID', 'Visa stamping'],
    timeline: '5–10 working days',
  },
  'employment-visa': {
    title: 'Employment Visa',
    tag: 'Residency',
    intro: 'Sponsor staff under your company with fully compliant labour and residency permits.',
    priceRange: 'AED 3,700 – 5,350 per visa',
    serviceFee: 'AED 1,200 SmartSetupUAE handling',
    eligibility: ['Active company with visa quota', 'Signed employment offer', 'Employee passport (6+ months)', 'Medical fitness'],
    benefits: ['2-year work & residency permit', 'WPS-compliant payroll setup', 'Labour contract registration', 'Emirates ID & insurance'],
    documents: ['Employee passport', 'Photo', 'Trade licence', 'Establishment card', 'Offer letter'],
    process: ['Quota / e-channel setup', 'Entry permit', 'Medical + Emirates ID', 'Labour contract + stamping'],
    timeline: '7–14 working days',
  },
  'family-visa': {
    title: 'Family Visa',
    tag: 'Residency',
    intro: 'Sponsor your spouse, children and parents once your residency and salary criteria are met.',
    priceRange: 'AED 4,000 – 6,000 per dependant',
    serviceFee: 'AED 1,200 SmartSetupUAE handling',
    eligibility: ['Sponsor with valid residency', 'Minimum salary / tenancy criteria', 'Attested marriage / birth certificates', 'Medical for 18+'],
    benefits: ['Residency for spouse & children', 'School & healthcare access', 'Parents sponsorship option', 'Emirates ID for dependants'],
    documents: ['Sponsor visa & Emirates ID', 'Attested certificates', 'Tenancy / Ejari', 'Salary certificate', 'Passport copies'],
    process: ['Entry permit', 'Status change', 'Medical + Emirates ID (18+)', 'Visa stamping'],
    timeline: '7–12 working days',
  },
  'vat-registration': {
    title: 'VAT Registration',
    tag: 'Compliance',
    intro: 'Register for UAE VAT with the FTA and stay compliant with quarterly filing.',
    priceRange: 'AED 1,500 – 3,000',
    serviceFee: 'Included in package or AED 1,500',
    eligibility: ['Taxable supplies above AED 375k (mandatory)', 'Above AED 187.5k (voluntary)', 'Valid trade licence', 'Bank account details'],
    benefits: ['FTA TRN issuance', 'Quarterly VAT return filing', 'Input VAT recovery guidance', 'Penalty avoidance'],
    documents: ['Trade licence', 'Passport & Emirates ID', 'MOA', 'Bank letter', 'Financials / turnover'],
    process: ['Eligibility review', 'FTA portal application', 'TRN issuance', 'Ongoing filing setup'],
    timeline: '5–20 working days (FTA dependent)',
  },
  'corporate-tax': {
    title: 'Corporate Tax',
    tag: 'Compliance',
    intro: '9% UAE Corporate Tax registration, assessment and filing — including free-zone qualifying income review.',
    priceRange: 'AED 1,200 – 5,000',
    serviceFee: 'From AED 1,200',
    eligibility: ['All UAE businesses must register', 'Free-zone qualifying income review', 'Taxable income above AED 375k at 9%', 'Valid licence'],
    benefits: ['CT registration with FTA', 'Qualifying free-zone status review', 'Annual CT return filing', 'Transfer pricing guidance'],
    documents: ['Trade licence', 'Financial statements', 'Shareholder details', 'MOA', 'Bank statements'],
    process: ['Registration', 'Tax position assessment', 'Bookkeeping alignment', 'Annual filing'],
    timeline: 'Registration 5–10 days',
  },
  'accounting': {
    title: 'Accounting & Bookkeeping',
    tag: 'Finance',
    intro: 'Monthly bookkeeping, management accounts and audit-ready financials for UAE companies.',
    priceRange: 'AED 1,000 – 2,500 / month',
    serviceFee: 'Plans from AED 1,000/mo',
    eligibility: ['Any active UAE company', 'Free zone or mainland', 'Startup to SME', 'VAT-registered or not'],
    benefits: ['Monthly bookkeeping', 'Management reports', 'Audit-ready statements', 'VAT & CT alignment'],
    documents: ['Bank statements', 'Sales & purchase invoices', 'Expense receipts', 'Payroll records'],
    process: ['Onboarding & chart of accounts', 'Monthly bookkeeping', 'Reporting', 'Year-end financials'],
    timeline: 'Ongoing monthly',
  },
  'pro-services': {
    title: 'PRO Services',
    tag: 'Government',
    intro: 'Government liaison and document processing — licence renewals, attestations, approvals and more.',
    priceRange: 'AED 500 – 3,000 per task',
    serviceFee: 'Retainer or per-task',
    eligibility: ['Any UAE company or individual', 'Licence holders', 'Visa applicants', 'Document attestation needs'],
    benefits: ['Licence renewals', 'Document clearing & attestation', 'Government approvals', 'Typing & translation'],
    documents: ['Trade licence', 'Passport / Emirates ID', 'Relevant application forms', 'Authority-specific docs'],
    process: ['Requirement assessment', 'Document preparation', 'Authority submission', 'Collection & delivery'],
    timeline: 'Task dependent',
  },
  'compliance': {
    title: 'Compliance Services',
    tag: 'Governance',
    intro: 'Stay compliant with UBO, ESR, AML and licence obligations — with proactive reviews and alerts.',
    priceRange: 'AED 1,500 – 6,000',
    serviceFee: 'From AED 1,500',
    eligibility: ['All UAE companies', 'Free zone & mainland', 'Regulated activities', 'Holding & trading entities'],
    benefits: ['UBO & register maintenance', 'ESR assessment & filing', 'AML / KYC framework', 'Compliance calendar & alerts'],
    documents: ['Trade licence', 'Shareholder register', 'MOA', 'Activity details', 'Financials'],
    process: ['Compliance health check', 'Gap analysis', 'Filing & registration', 'Ongoing monitoring'],
    timeline: 'Initial review 3–7 days',
  },
};

export default function ServicePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const svc = SERVICES[slug];
  if (!svc) return <Navigate to="/visa-services" replace />;

  return (
    <div data-testid={`service-page-${slug}`}>
      <Navbar />
      <section className="hero-gradient grain">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 pt-3 lg:pt-6 pb-10 grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7">
            <span className="text-[11px] uppercase tracking-[0.22em] text-slate-600 font-semibold">{svc.tag}</span>
            <h1 className="mt-4 font-display text-4xl lg:text-6xl font-semibold text-slate-900 leading-[1.05]">{svc.title}</h1>
            <p className="mt-5 text-lg text-slate-600 max-w-xl">{svc.intro}</p>
            <div className="mt-7 flex flex-wrap items-center gap-6">
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-semibold">Price Range</div>
                <div className="font-display text-2xl font-bold text-slate-900">{svc.priceRange}</div>
              </div>
              <div className="h-10 w-px bg-slate-200" />
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-semibold">Timeline</div>
                <div className="font-semibold text-slate-800 flex items-center gap-1"><Clock className="h-4 w-4 brand-emerald" /> {svc.timeline}</div>
              </div>
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button onClick={() => navigate('/consultation?service=' + encodeURIComponent(svc.title))} className="btn-primary rounded-full px-7 h-12">Request a Quote <ArrowRight className="h-4 w-4 ml-2" /></Button>
            </div>
            <div className="mt-3 text-xs text-slate-500 flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> {svc.serviceFee}</div>
          </div>
          <div className="lg:col-span-5 lg:sticky lg:top-24 self-start">
            <LeadBox sourcePage={`service:${slug}`} />
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#FFFCF5]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 grid md:grid-cols-2 gap-6">
          <div className="card-elevated rounded-2xl p-7">
            <div className="text-[11px] uppercase tracking-[0.22em] font-semibold brand-emerald">Eligibility</div>
            <ul className="mt-4 space-y-3">
              {svc.eligibility.map((e) => <li key={e} className="flex items-start gap-3"><CheckCircle2 className="h-5 w-5 brand-emerald shrink-0 mt-0.5" /><span className="text-slate-700">{e}</span></li>)}
            </ul>
          </div>
          <div className="card-elevated rounded-2xl p-7">
            <div className="text-[11px] uppercase tracking-[0.22em] font-semibold brand-bronze">Benefits</div>
            <ul className="mt-4 space-y-3">
              {svc.benefits.map((b) => <li key={b} className="flex items-start gap-3"><CheckCircle2 className="h-5 w-5 brand-bronze shrink-0 mt-0.5" /><span className="text-slate-700">{b}</span></li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#F8F3E8]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 grid md:grid-cols-2 gap-6">
          <div className="card-elevated rounded-2xl p-7">
            <div className="text-[11px] uppercase tracking-[0.22em] font-semibold brand-emerald flex items-center gap-2"><FileText className="h-4 w-4" /> Required Documents</div>
            <ul className="mt-4 space-y-2">
              {svc.documents.map((d) => <li key={d} className="text-slate-700 text-sm">• {d}</li>)}
            </ul>
          </div>
          <div className="card-elevated rounded-2xl p-7">
            <div className="text-[11px] uppercase tracking-[0.22em] font-semibold brand-bronze">Process</div>
            <ol className="mt-4 space-y-3">
              {svc.process.map((p, i) => (
                <li key={p} className="flex items-start gap-3">
                  <span className="h-6 w-6 rounded-full bg-emerald-50 brand-emerald text-xs font-bold grid place-items-center shrink-0">{i + 1}</span>
                  <span className="text-slate-700">{p}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#0F2A2A] text-white">
        <div className="max-w-4xl mx-auto px-5 lg:px-8 text-center">
          <h2 className="font-display text-3xl lg:text-4xl font-semibold">Ready to start your {svc.title.toLowerCase()}?</h2>
          <p className="mt-3 text-[#A9C0BB]">Talk to a SmartSetupUAE advisor — transparent pricing, no sales pressure.</p>
          <Button onClick={() => navigate('/consultation?service=' + encodeURIComponent(svc.title))} className="mt-6 rounded-full px-8 h-12 bg-[#F0C674] text-[#0F2A2A] hover:bg-[#e6b95c]">Book Free Consultation</Button>
        </div>
      </section>
      <Footer />
    </div>
  );
}
