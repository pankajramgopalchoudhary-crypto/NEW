import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import GoldenVisaLeadForm from '../components/GoldenVisaLeadForm';
import { Button } from '../components/ui/button';
import {
  Crown, CheckCircle2, Sparkles, ArrowRight, Download,
  Home, Briefcase, Code2, Rocket, Trophy, GraduationCap, ShieldCheck, Heart,
  Clock, FileBadge2, Phone, MapPin,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const CATEGORIES = [
  {
    Icon: Home, title: 'Real Estate Investor',
    tag: 'Min. Property Value: AED 2,000,000',
    body: "Own UAE property with a minimum value of AED 2,000,000. Property must be completed (not off-plan). Mortgaged property is accepted if the paid amount equals or exceeds AED 2M. Jointly owned property qualifies if each owner's share is AED 2M+.",
    perks: ['No sponsor needed', 'Family sponsorship included', 'Multiple properties can be combined'],
  },
  {
    Icon: Briefcase, title: 'Business Investor',
    tag: 'Min. Investment: AED 2,000,000 · OR AED 250K annual tax',
    body: 'Invest a minimum of AED 2,000,000 in a UAE business (not real estate). OR own a business with annual taxes paid of at least AED 250,000 per year. A letter from the Federal Tax Authority confirming tax payments is required. Free zone businesses are eligible if investment amount is met.',
    perks: ['Free zone and mainland businesses eligible', 'Partners qualify proportionally'],
  },
  {
    Icon: Code2, title: 'Skilled Professional',
    tag: 'Min. Salary: AED 30,000/month · Priority sectors only',
    body: 'Salaried employees earning a minimum of AED 30,000 per month working in priority sectors: technology, science, engineering, health, education, business, and culture. Must have a valid UAE employment contract and hold at least a bachelor\u2019s degree. Must be in the UAE and employed by a UAE-registered company.',
    perks: ["Bachelor\u2019s degree required", 'Health insurance required', 'Family sponsorship included'],
  },
  {
    Icon: Rocket, title: 'Entrepreneur',
    tag: 'Incubator letter · OR AED 7M exit · OR AED 1M revenue',
    body: 'Founders of a UAE-approved startup. Requires one of: (a) a letter from an accredited UAE business incubator or accelerator, OR (b) a previous startup sold for a minimum of AED 7,000,000, OR (c) a startup with annual revenue of AED 1,000,000+. Applicants must already own or be establishing a business in the UAE.',
    perks: ['Free zone startups accepted', 'Approved incubators: Hub71, in5, Area 2071, DIFC, others'],
  },
  {
    Icon: Trophy, title: 'Person of Exceptional Talent',
    tag: 'Government endorsement required · No minimum investment',
    body: 'Individuals with demonstrated outstanding achievement in science, technology, culture, arts, sports, or creative industries. Requires endorsement or nomination from a UAE federal or local government authority, accredited professional body, or major international award. No minimum investment required \u2014 talent and achievement are evaluated.',
    perks: ['Scientists, doctors, athletes, artists, coders', 'UAE Pioneers programme also available'],
  },
  {
    Icon: GraduationCap, title: 'Outstanding Student / Graduate',
    tag: '95%+ school score · OR 3.8+ university GPA (UAE only)',
    body: 'Two pathways: (a) UAE high school graduates with a minimum score of 95% or above from a UAE Ministry of Education-approved school (applies within 6 months of graduation), OR (b) UAE university graduates with a minimum GPA of 3.8 out of 4.0 (or equivalent) from a UAE-accredited university. No investment required.',
    perks: ['Must be from UAE institution', 'Apply within 2 years of graduation', 'Parents may be sponsored'],
  },
];

const INCLUDES = [
  { Icon: Clock,       title: '10-year renewable residency',          body: 'Renewable indefinitely as long as you meet the criteria. No annual renewal fees like standard visas.' },
  { Icon: ShieldCheck, title: 'No UAE sponsor required',              body: 'You self-sponsor. You are not tied to an employer or local sponsor for your residency status.' },
  { Icon: Heart,       title: 'Sponsor spouse and children',          body: 'Unlimited children (no age restriction for sons). Can also sponsor domestic workers. Parents under some categories.' },
  { Icon: MapPin,      title: 'Live outside UAE without losing visa', body: 'Standard residency visas expire if you stay outside the UAE for 6 months. Golden Visa has no such restriction.' },
  { Icon: FileBadge2,  title: 'Emirates ID & health insurance',       body: 'Full Emirates ID issued. Health insurance is required and can be arranged via UAE-licensed providers.' },
  { Icon: Briefcase,   title: 'Bank accounts & business access',      body: 'Treated as long-term UAE residents. Easier banking, property purchase, and business setup.' },
];

const TIMELINE = [
  { i: 1, label: 'Eligibility Check',     when: '1–2 days' },
  { i: 2, label: 'Document Prep',         when: '3–5 days' },
  { i: 3, label: 'ICA Submission',        when: '1–2 days' },
  { i: 4, label: 'Medical & Emirates ID', when: '5–7 days' },
  { i: 5, label: 'Visa Stamped',          when: 'Total: ~3 weeks', done: true },
];

export default function GoldenVisa() {
  const navigate = useNavigate();
  const pdfUrl = `${BACKEND_URL}/api/guides/golden-visa.pdf`;

  return (
    <div className="min-h-screen bg-[#FFFCF5]">
      <Navbar />

      {/* HERO — full-bleed */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0F2A2A] via-[#13433f] to-[#0F2A2A] text-white">
        <div className="absolute inset-0 pointer-events-none opacity-25">
          <div className="absolute -top-32 -right-20 w-[700px] h-[700px] rounded-full bg-[#F0C674]/30 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 w-[500px] h-[500px] rounded-full bg-emerald-500/15 blur-3xl" />
        </div>
        <div className="relative max-w-[1480px] mx-auto px-5 lg:px-8 py-8 lg:py-12 grid lg:grid-cols-[1.25fr_1fr] gap-10 items-start">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#F0C674]/40 bg-[#F0C674]/10 text-[10px] uppercase tracking-[0.18em] font-bold text-[#F0C674]">
              <Crown className="h-3 w-3" /> Official UAE Government Programme · Updated 2026
            </div>
            <h1 className="mt-3 font-display font-bold tracking-tight" style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2.4rem)', lineHeight: 1.08 }}>
              UAE <span className="italic" style={{ color: '#F0C674' }}>Golden Visa</span> — 10-year residency.<br />No sponsor required.
            </h1>
            <p className="mt-3 text-white/85 max-w-2xl" style={{ fontSize: 'clamp(0.78rem, 0.9vw, 0.92rem)', lineHeight: 1.5 }}>
              The UAE Golden Visa grants long-term renewable residency to investors, entrepreneurs, specialised talent,
              skilled professionals and outstanding students. In 2026 the programme expanded to include no-property
              pathways for entrepreneurs, talent and high-achieving professionals. Processed by Axiscrest-Global FZE LLC — 500+ Golden Visas filed.
            </p>

            {/* 2025 policy update banner */}
            <div className="mt-5 max-w-2xl rounded-2xl border border-[#F0C674]/30 bg-white/5 backdrop-blur p-3 text-xs" data-testid="gv-2026-update">
              <div className="text-[9px] uppercase tracking-[0.22em] font-bold" style={{ color: '#F0C674' }}>📢 2026 residency update</div>
              <ul className="mt-1.5 space-y-1 text-white/90 text-[11.5px] leading-snug">
                <li>• No-property Golden Visa routes now available for entrepreneurs, specialised talent, outstanding students and skilled professionals.</li>
                <li>• 2-year investor visa now qualifies with any property value for sole owners; the old AED 750K threshold is removed.</li>
                <li>• Joint ownership now qualifies when each owner holds at least AED 400K in combined property value.</li>
                <li>• Golden Visa also accepts approved fund investment or qualifying UAE business performance without real estate.</li>
              </ul>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={() => document.getElementById('eligibility-form')?.scrollIntoView({ behavior: 'smooth' })} className="rounded-full px-5 h-11 text-sm font-semibold" style={{ background: '#F0C674', color: '#0F2A2A' }} data-testid="gv-cta-check">
                Check eligibility — free <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <a href={pdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full px-5 h-11 border border-white/30 text-white text-sm font-semibold hover:bg-white/10 transition-colors" data-testid="gv-cta-pdf">
                <Download className="h-4 w-4" /> Download branded PDF guide
              </a>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-3 max-w-md">
              {[
                { k: '500+', l: 'Visas processed' },
                { k: '~3 wks', l: 'Avg. timeline' },
                { k: '0', l: 'Renewal hassle' },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur p-3.5">
                  <div className="font-display text-2xl font-bold" style={{ color: '#F0C674' }}>{s.k}</div>
                  <div className="text-[10px] uppercase tracking-wider text-white/70 mt-0.5">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Hero side card */}
          <div className="rounded-3xl bg-white/5 backdrop-blur border border-white/15 p-5">
            <div className="text-[10px] uppercase tracking-[0.22em] font-bold" style={{ color: '#F0C674' }}>What you receive</div>
            <ul className="mt-3 space-y-2.5">
              {INCLUDES.slice(0, 6).map((i) => (
                <li key={i.title} className="flex items-start gap-2.5">
                  <div className="h-7 w-7 rounded-lg grid place-items-center shrink-0" style={{ background: 'rgba(240,198,116,0.15)' }}>
                    <i.Icon className="h-4 w-4" style={{ color: '#F0C674' }} />
                  </div>
                  <div>
                    <div className="font-semibold text-white text-[12.5px]">{i.title}</div>
                    <div className="text-[11px] text-white/75 leading-snug mt-0.5">{i.body}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 2025 PROPERTY VISA UPDATE */}
      <section className="py-16 bg-white border-y border-slate-200">
        <div className="max-w-[1480px] mx-auto px-5 lg:px-8 grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] font-bold brand-bronze">2026 Policy Update</div>
            <h2 className="mt-3 font-display font-semibold text-slate-900" style={{ fontSize: 'clamp(2rem, 3.6vw, 3rem)', lineHeight: 1.1 }}>
              New residency paths: <span className="brand-emerald">No-property Golden Visa</span> plus easier 2-year investor entry
            </h2>
            <p className="mt-4 text-slate-700 text-base lg:text-lg leading-relaxed">
              In 2026 the UAE expanded residency access beyond real estate. The 2-year investor visa now qualifies
              with any value property for sole owners, and the Golden Visa includes no-property pathways for entrepreneurs,
              talent, outstanding students and high-income skilled workers.
            </p>
            <ul className="mt-4 space-y-2 text-slate-700 text-[14.5px]">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-5 w-5 brand-emerald mt-0.5 shrink-0" /> Sole owners can now qualify for the 2-year investor visa with any property value — the old AED 750K floor is removed.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-5 w-5 brand-emerald mt-0.5 shrink-0" /> Joint ownership qualifies when each owner holds at least AED 400K of property value.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-5 w-5 brand-emerald mt-0.5 shrink-0" /> Golden Visa now accepts approved fund investment or qualifying UAE business performance without requiring real estate.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-5 w-5 brand-emerald mt-0.5 shrink-0" /> No property purchase is required for many categories including entrepreneurs, specialised talent, outstanding students and skilled professionals.</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-amber-200 bg-[#FFFCF5] p-7 shadow-lg">
            <div className="grid grid-cols-1 gap-4">
              <div className="rounded-2xl bg-white border border-amber-200 p-5">
                <div className="text-[10px] uppercase tracking-[0.22em] font-bold brand-bronze">2-Year Property Visa · NEW</div>
                <div className="font-display font-bold text-slate-900 mt-2" style={{ fontSize: 'clamp(1.8rem, 2.8vw, 2.4rem)' }}>AED 400,000</div>
                <div className="text-[13px] text-slate-600 mt-1">Sole owner threshold (down from AED 750K). Renewable every 2 years.</div>
              </div>
              <div className="rounded-2xl bg-[#0F2A2A] text-white p-5">
                <div className="text-[10px] uppercase tracking-[0.22em] font-bold" style={{ color: '#F0C674' }}>10-Year Golden Visa</div>
                <div className="font-display font-bold mt-2" style={{ fontSize: 'clamp(1.8rem, 2.8vw, 2.4rem)' }}>AED 2,000,000</div>
                <div className="text-[13px] text-white/80 mt-1">Unchanged amount, but off-plan & mortgage rules <b>fully relaxed</b> in 2024/25.</div>
              </div>
            </div>
            <Button onClick={() => document.getElementById('eligibility-form')?.scrollIntoView({ behavior: 'smooth' })} className="btn-primary rounded-full w-full mt-5 h-12 text-base" data-testid="gv-policy-cta">
              Check which one I qualify for
            </Button>
          </div>
        </div>
      </section>

      {/* ELIGIBILITY CATEGORIES */}
      <section className="py-20 bg-[#FFFCF5]">
        <div className="max-w-[1480px] mx-auto px-5 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="text-[10px] uppercase tracking-[0.22em] font-bold brand-bronze">Eligibility</div>
            <h2 className="mt-2 font-display text-3xl lg:text-5xl font-semibold text-slate-900">Who qualifies for a Golden Visa?</h2>
            <p className="mt-4 text-slate-600">Six government-defined categories. Pick the one that fits — or ask us, we&rsquo;ll match you in under 30 seconds.</p>
          </div>

          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {CATEGORIES.map((c) => (
              <div key={c.title} className="card-elevated rounded-3xl p-6 flex flex-col" data-testid={`gv-cat-${c.title.replace(/\s+/g,'-').toLowerCase()}`}>
                <div className="h-12 w-12 rounded-2xl grid place-items-center bg-[#F0C674]/15" style={{ color: '#B68A4A' }}>
                  <c.Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-xl font-semibold text-slate-900">{c.title}</h3>
                <p className="mt-3 text-[13px] text-slate-600 leading-relaxed">{c.body}</p>
                <div className="mt-4 px-3 py-2 rounded-xl bg-emerald-700/8 text-[12px] font-semibold brand-emerald">{c.tag}</div>
                <ul className="mt-3 space-y-1.5">
                  {c.perks.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-[12.5px] text-slate-700">
                      <CheckCircle2 className="h-4 w-4 brand-emerald shrink-0 mt-0.5" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHAT IT INCLUDES */}
      <section className="py-20 bg-white border-y border-slate-200">
        <div className="max-w-[1480px] mx-auto px-5 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <div className="text-[10px] uppercase tracking-[0.22em] font-bold brand-bronze">Benefits</div>
            <h2 className="mt-2 font-display text-3xl lg:text-5xl font-semibold text-slate-900">What the Golden Visa includes</h2>
          </div>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {INCLUDES.map((b) => (
              <div key={b.title} className="rounded-2xl border border-slate-200 p-6 bg-[#FFFCF5]">
                <div className="h-10 w-10 rounded-xl bg-emerald-700/10 grid place-items-center brand-emerald">
                  <b.Icon className="h-4.5 w-4.5" />
                </div>
                <h3 className="mt-3 font-display text-lg font-semibold text-slate-900">{b.title}</h3>
                <p className="mt-1.5 text-[13px] text-slate-600">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TIMELINE */}
      <section className="py-20 bg-[#F8F3E8]">
        <div className="max-w-[1480px] mx-auto px-5 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <div className="text-[10px] uppercase tracking-[0.22em] font-bold brand-bronze">Process</div>
            <h2 className="mt-2 font-display text-3xl lg:text-5xl font-semibold text-slate-900">Application process &amp; timeline</h2>
            <p className="mt-3 text-slate-600 text-sm">From eligibility check to passport stamping — typically under 3 weeks.</p>
          </div>
          <ol className="mt-10 grid sm:grid-cols-2 lg:grid-cols-5 gap-4 max-w-5xl mx-auto">
            {TIMELINE.map((s) => (
              <li key={s.label} className={`rounded-2xl p-5 border ${s.done ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white border-slate-200'}`}>
                <div className={`text-[10px] uppercase tracking-wider font-bold ${s.done ? 'text-amber-200' : 'brand-bronze'}`}>Step {s.done ? '✓' : s.i}</div>
                <div className={`mt-1.5 font-display text-lg font-semibold ${s.done ? 'text-white' : 'text-slate-900'}`}>{s.label}</div>
                <div className={`mt-1 text-[12px] ${s.done ? 'text-amber-100/80' : 'text-slate-500'}`}>{s.when}</div>
              </li>
            ))}
          </ol>

          <div className="mt-10 max-w-4xl mx-auto rounded-3xl border border-slate-200 bg-white p-6">
            <div className="text-[10px] uppercase tracking-[0.22em] font-bold brand-bronze">Documents Required</div>
            <p className="mt-2 text-sm text-slate-700">
              Valid passport (6+ months) · Passport-size photo · Current UAE visa or entry stamp ·
              Proof of qualifying investment / employment / achievement · Medical fitness certificate (done in UAE) ·
              Health insurance · Emirates ID biometrics.
            </p>
          </div>
        </div>
      </section>

      {/* FORM */}
      <section className="py-20 bg-[#FFFCF5]" id="eligibility-form">
        <div className="max-w-[1480px] mx-auto px-5 lg:px-8 grid lg:grid-cols-[1fr_1.15fr] gap-10 items-start">
          <div className="rounded-3xl bg-gradient-to-br from-[#0F2A2A] to-[#13433f] text-white p-9">
            <div className="text-[10px] uppercase tracking-[0.22em] font-bold" style={{ color: '#F0C674' }}>Our Service</div>
            <h2 className="mt-2 font-display text-3xl lg:text-4xl font-semibold">Golden Visa Consulting — AED 4,500</h2>
            <ul className="mt-5 space-y-2.5">
              {['Free eligibility assessment',
                'Document checklist & preparation',
                'ICA submission and follow-up',
                'Medical, biometrics, EID scheduling',
                'Family visa add-on (spouse + children)',
                'Renewal reminders & lifelong support',
              ].map((p) => (
                <li key={p} className="flex items-start gap-2"><CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" style={{ color: '#F0C674' }} /><span className="text-white/90">{p}</span></li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button onClick={() => navigate('/consultation?service=Golden%20Visa&source=golden-visa', { state: { service: 'Golden Visa' } })} className="rounded-full px-5 h-11 font-semibold" style={{ background: '#F0C674', color: '#0F2A2A' }} data-testid="gv-book-call">
                <Phone className="h-4 w-4 mr-2" /> Book a private consultation
              </Button>
              <a href={pdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full px-5 h-11 border border-white/30 text-white font-semibold hover:bg-white/10 transition-colors" data-testid="gv-pdf">
                <Download className="h-4 w-4" /> Download Guide (PDF)
              </a>
            </div>
            <div className="mt-6 text-[11px] text-white/60">
              PDF guide is published by <b>Axiscrest-Global FZE LLC</b> · Ajman Free Zone, UAE.
            </div>
          </div>

          <GoldenVisaLeadForm />
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-white border-t border-slate-200">
        <div className="max-w-[1000px] mx-auto px-5 lg:px-8">
          <div className="text-[10px] uppercase tracking-[0.22em] font-bold brand-bronze text-center">FAQ</div>
          <h2 className="mt-2 font-display text-2xl lg:text-4xl font-semibold text-slate-900 text-center">Golden Visa — Common questions</h2>
          <div className="mt-8 space-y-3">
            {[
              { q: 'How long does the UAE Golden Visa take?', a: 'Typical end-to-end timeline is 2–3 weeks: 1–2 days for eligibility check, 3–5 days for document preparation, 1–2 days for ICA submission, 5–7 days for medical and Emirates ID. Talent and student categories sometimes take longer because they need government endorsement.' },
              { q: 'Do I have to buy property to get the Golden Visa?', a: 'No. The 2026 expansion added no-property routes for entrepreneurs, salaried professionals (AED 30K+), specialised talent and outstanding students. Even the standard 2-year investor visa now qualifies with any property value for sole owners.' },
              { q: 'Is the Golden Visa transferable to family?', a: 'Yes — sponsor your spouse, sons (no age limit), unmarried daughters and parents (subject to category). Domestic workers can also be sponsored on a Golden Visa. Family visas are issued for the same duration as the main applicant.' },
              { q: 'What if I stay outside the UAE for more than 6 months?', a: 'Standard residence visas expire after 6 months outside the UAE. Golden Visa has no such restriction — you can live abroad and still keep your UAE residency intact for the full 10-year term.' },
              { q: 'Can I work for any employer with a Golden Visa?', a: 'Yes. The Golden Visa is self-sponsored, so you are not tied to a single employer. You can start your own business, freelance, change jobs without cancelling residency and even live in the UAE while working remotely for an overseas company.' },
              { q: 'What is the total Axiscrest-Global fee?', a: 'AED 4,500 consulting fee + actual government fees (typically AED 2,800–3,500 for ICA + medical + EID + insurance). No success-fee. No commissions. We refund the consulting fee if your application is rejected for reasons we missed during eligibility check.' },
            ].map((f, i) => (
              <details key={i} className="card-elevated rounded-2xl p-5 group" data-testid={`gv-faq-${i}`}>
                <summary className="cursor-pointer flex items-center justify-between font-semibold text-slate-900">
                  <span>{f.q}</span>
                  <span className="text-emerald-700 ml-3 transition-transform group-open:rotate-180">▼</span>
                </summary>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}