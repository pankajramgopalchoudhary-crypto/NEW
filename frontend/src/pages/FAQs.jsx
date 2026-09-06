import React, { useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { ChevronDown, Search } from 'lucide-react';

// Detailed, page-grade FAQs grouped by category. Sourced from the founder's brief
// and from the actual questions clients ask Axiscrest-Global FZE LLC.
const SECTIONS = [
  {
    id: 'setup',
    title: 'Company setup & licences',
    items: [
      { q: 'How much does it cost to set up a company in the UAE?', a: 'The cheapest verified freezone licence is around AED 4,888 (ANCFZ, Ajman) for a 0-visa licence covering up to 3 activities. SPC and IFZA start a little higher but include 1 visa. Mainland LLC (DED Dubai) typically starts from AED 14,500 with no visa, plus AED 4,000–7,500 per visa. The final cost depends on jurisdiction, activity, office type and visa count. Use the Cost Calculator for an exact split.' },
      { q: 'What is the difference between Free Zone and Mainland?', a: 'Free zones offer 100% foreign ownership, fast setup (24–72 hours possible) and 0% corporate tax on qualifying income, but you cannot trade directly with mainland UAE customers without a local distributor or branch. Mainland (DED) gives you full UAE market access, government contracts and unlimited visas, but takes longer and costs more upfront. We help you pick based on your customer base and activity.' },
      { q: 'How long does company formation take?', a: 'Most free zone licences are issued within 1–5 working days once your KYC + activity is approved. ANCFZ and IFZA can issue in 24 hours. Visas (Emirates ID + medical) add another 5–14 working days. DED mainland is typically 3–7 working days for the licence and another 10–15 days for visas.' },
      { q: 'Do I need a physical office?', a: 'No, for most free zones a flexi-desk or virtual office is enough for up to 6 visas. Beyond that, or for certain regulated activities (medical, financial, food trading), the authority requires a physical office. For DED mainland you always need a tenancy contract (Ejari) before the licence is issued.' },
      { q: 'How many visas can I get with my licence?', a: 'Free zone packages range from 0 to 10+ visas depending on the package and office. IFZA and ANCFZ start at 1 visa per AED 4,888–6,000 step; DMCC and Meydan offer up to 6 with flexi-desk and unlimited with a real office; mainland LLC has no upper limit, only based on office area.' },
    ],
  },
  {
    id: 'pricing',
    title: 'Pricing, fees & transparency',
    items: [
      { q: 'Why are prices so different across consultants in the UAE?', a: 'Most consultants add a markup of AED 2,000–8,000 on top of the freezone fee, plus an undisclosed commission from the freezone (typically 5–15%). We show only the official authority price and add a single transparent service fee — currently AED 0 for the first 500 founders.' },
      { q: 'Are the prices on SmartSetupUAE.ae the final prices?', a: 'Yes. The headline price = government / freezone fee + our service fee (AED 0 for first 500 customers). VAT and add-ons such as Establishment Card, e-channel, medical, EID typing are listed separately so you see the exact split before paying.' },
      { q: 'Can I pay in instalments?', a: 'Yes. Most freezone packages support a 50/50 split: AED 999 to reserve the slot at checkout and the rest at activity approval. Stripe Checkout supports AED, USD, EUR, GBP and INR. For mainland we accept bank transfer to our Mashreq UAE account.' },
      { q: 'Is the AED 999 Founder Club fee refundable?', a: 'It is non-refundable once any Founder Club benefit (renewal discount, advisor session, partner discount) is used. If you cancel before activating any benefit we issue a full refund within 7 working days.' },
      { q: 'How do you calculate renewal costs?', a: 'Renewal is published by every freezone and authority. We show the renewal price on every freezone detail page, mark whether it includes Establishment Card / e-channel / immigration card renewal, and send you a reminder 90 days before expiry — so you never get hit with late penalties.' },
    ],
  },
  {
    id: 'visa',
    title: 'Visas & Golden Visa',
    items: [
      { q: 'Who qualifies for the UAE Golden Visa?', a: 'Investors (AED 2M property OR business), entrepreneurs with an incubator letter / AED 7M exit / AED 1M revenue, salaried professionals earning AED 30,000+ in priority sectors, persons of exceptional talent (with government endorsement) and outstanding students/graduates (95%+ school score or 3.8+ GPA at UAE university). 2026 expanded the no-property routes — see the Golden Visa page for full details.' },
      { q: 'Can I get residency without buying property?', a: 'Yes. The 2026 expansion lets entrepreneurs, salaried professionals (AED 30K+), specialised talent and outstanding students qualify without property. The 2-year investor visa now also qualifies with any property value for sole owners (previously AED 750K minimum).' },
      { q: 'How much do investor visas cost?', a: 'Standard 2-year residence visa: AED 4,000–7,500 per person including medical, EID, change-of-status and Establishment Card. 10-year Golden Visa: AED 4,500 consulting + AED 2,800 government fees (approx). Family visas are AED 3,500–5,500 each.' },
      { q: 'Can I sponsor my family on my new visa?', a: 'Yes, once your own residence is stamped you can sponsor spouse, children (sons under 18 / unmarried daughters with no age limit) and parents (if you meet income criteria). Golden Visa has no age cap on sons and no income test.' },
      { q: 'What is the salary requirement for family sponsorship?', a: 'AED 4,000 + accommodation, or AED 10,000 all-in, on a standard residence visa. Golden Visa holders have no minimum income requirement to sponsor family.' },
    ],
  },
  {
    id: 'compliance',
    title: 'VAT, Corporate Tax & compliance',
    items: [
      { q: 'Is Corporate Tax applicable to my UAE business?', a: 'UAE Corporate Tax is 9% on taxable income above AED 375,000. Qualifying free-zone income is 0%. Every company (free zone or mainland) must register for Corporate Tax even if income is below the threshold. We register, file and remind you of deadlines.' },
      { q: 'When do I need to register for VAT?', a: 'Mandatory if your taxable supplies in the last 12 months exceeded AED 375,000, or are expected to in the next 30 days. Voluntary at AED 187,500. Once registered you file VAT quarterly and pay 5% VAT on taxable supplies.' },
      { q: 'What is ESR / UBO / AML and do I need to worry?', a: 'Economic Substance Regulation (ESR), Ultimate Beneficial Owner declaration (UBO) and Anti-Money-Laundering (AML) compliance are all mandatory for UAE entities. Most fail because they miss the annual notification window — Founder Club members get 90 / 30 / 7-day reminders for every compliance deadline.' },
      { q: 'What happens if I miss a renewal or compliance filing?', a: 'Late penalties range from AED 1,000 (VAT late filing) to AED 20,000 (commercial licence expiry > 6 months) plus the licence may be cancelled. Founder Club members get automated reminders + a dedicated advisor — peace of mind that you never miss a deadline.' },
    ],
  },
  {
    id: 'banking',
    title: 'Banking & operations',
    items: [
      { q: 'Which banks open business accounts the fastest?', a: 'WIO Bank and Mashreq NeoBiz can open digital business accounts in 5–10 working days for freezone companies. Emirates NBD and ADCB typically take 3–6 weeks and require a physical office. We submit to all three in parallel and recommend whichever responds first.' },
      { q: 'Do I need a UAE residence visa to open a business account?', a: 'For most banks yes — at least the shareholder/manager needs a residence visa and Emirates ID. WIO and a few digital banks open accounts on entry stamp + freezone immigration card, but the daily transfer limits are lower until full KYC.' },
      { q: 'Can I run my UAE company from outside the UAE?', a: 'Yes, freezone licences are 100% remote — you can incorporate, get a licence and even start invoicing without ever stepping foot in the UAE. However, residency visa, Emirates ID and most bank accounts require an in-person visit (1–3 working days) at some point.' },
    ],
  },
  {
    id: 'about-us',
    title: 'About SmartSetupUAE.ae & Axiscrest-Global',
    items: [
      { q: 'Who runs SmartSetupUAE.ae?', a: 'SmartSetupUAE.ae is operated by Axiscrest-Global FZE LLC (Licence 262843696888), a UAE-licensed corporate services firm based in Amber Gem Tower, Ajman. Founder: Pankaj Choudhary. We do not earn commission from any freezone — our income comes only from our transparent service fee.' },
      { q: 'How is SmartSetupUAE.ae different from typical consultants?', a: '1) We publish official prices only — no hidden markup. 2) Zero commission from any freezone, so recommendations are based purely on your business needs. 3) AI-matched activity codes across 12,719 records — instantly. 4) Free advisory for the first 500 founders. 5) Lifetime renewal & compliance reminders. 6) A real person assigned to every client.' },
      { q: 'How do I contact you?', a: 'WhatsApp +971 58 590 3155 (replies within 30 minutes during UAE business hours), email info@smartsetupuae.ae, or book a free 30-minute call via the Consultation page. Address: CWS-1V-000384, 26th Floor, Amber Gem Tower, Ajman.' },
      { q: 'Is the advisor really included for free?', a: 'Yes — every client gets a dedicated WhatsApp + email advisor for the entire setup process. After the licence is issued, Founder Club members keep their advisor for life; non-members can re-engage for a small per-task fee.' },
    ],
  },
];

export default function FAQs() {
  const [query, setQuery] = useState('');
  const [openKey, setOpenKey] = useState('setup-0');

  const filteredSections = useMemo(() => {
    if (!query.trim()) return SECTIONS;
    const q = query.toLowerCase();
    return SECTIONS.map((s) => ({
      ...s,
      items: s.items.filter((it) => it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q)),
    })).filter((s) => s.items.length);
  }, [query]);

  return (
    <div data-testid="faqs-page">
      <Navbar />
      <section className="hero-gradient grain">
        <div className="max-w-[1480px] mx-auto px-5 lg:px-8 pt-3 lg:pt-6 pb-9 text-center">
          <span className="text-[11px] uppercase tracking-[0.22em] text-slate-600 font-semibold">Help Center</span>
          <h1 className="mt-3 font-display font-semibold text-slate-900" style={{ fontSize: 'clamp(2rem, 4.4vw, 4rem)', lineHeight: 1.04 }}>Frequently asked questions</h1>
          <p className="mt-3 text-slate-600 max-w-2xl mx-auto" style={{ fontSize: 'clamp(0.95rem, 1.1vw, 1.125rem)' }}>Everything about UAE business setup, free zone vs mainland licences, visa packages, Golden Visa, VAT, corporate tax, banking and renewals. Search for a topic or browse the sections below.</p>

          <div className="mt-6 max-w-xl mx-auto relative">
            <Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search FAQs… e.g., Golden Visa, VAT, renewal cost"
              className="w-full h-12 pl-11 pr-4 rounded-full border border-slate-200 bg-white text-sm outline-none focus:border-emerald-700 shadow-sm"
              data-testid="faq-search"
            />
          </div>
        </div>
      </section>

      <section className="py-12 bg-[#FFFCF5]">
        <div className="max-w-[1480px] mx-auto px-5 lg:px-8 space-y-10">
          {filteredSections.length === 0 && (
            <div className="text-center text-slate-500 py-12">No FAQs match &ldquo;{query}&rdquo;. Try a different keyword.</div>
          )}
          {filteredSections.map((section) => (
            <div key={section.id}>
              <h2 className="font-display text-xl lg:text-2xl font-semibold text-slate-900 mb-3">{section.title}</h2>
              <div className="space-y-2">
                {section.items.map((f, i) => {
                  const key = `${section.id}-${i}`;
                  const open = openKey === key;
                  return (
                    <div key={key} className="card-elevated rounded-2xl overflow-hidden" data-testid={`faq-${section.id}-${i}`}>
                      <button onClick={() => setOpenKey(open ? null : key)} className="w-full flex items-center justify-between gap-4 p-5 text-left">
                        <span className="font-semibold text-slate-900">{f.q}</span>
                        <ChevronDown className={`h-5 w-5 brand-emerald shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                      </button>
                      {open && <div className="px-5 pb-5 text-slate-700 text-sm leading-relaxed -mt-1">{f.a}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
