/**
 * PageFAQ — drop-in FAQ section for any page.
 *
 * Renders title + intro + accordion list with proper SEO schema markup
 * (Schema.org/FAQPage JSON-LD injected so each page can rank for the
 * question keywords directly in Google's rich results).
 *
 * Usage:
 *   import PageFAQ from '../components/PageFAQ';
 *   import { faqMainland } from '../constants/pageFaqs';
 *   <PageFAQ title="Mainland licence — Common questions" items={faqMainland} />
 */
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function PageFAQ({ title, intro, items = [], testId = 'page-faq' }) {
  const [open, setOpen] = useState(0);
  if (!items.length) return null;
  // Build JSON-LD for SEO
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  };
  return (
    <section className="py-14 lg:py-16 bg-white border-t border-slate-200/70" data-testid={testId}>
      <div className="max-w-[1100px] mx-auto px-5 lg:px-8">
        <div className="text-[10px] uppercase tracking-[0.22em] font-bold brand-emerald text-center">Frequently Asked Questions</div>
        <h2 className="mt-2 font-display text-2xl lg:text-3xl font-semibold text-slate-900 text-center">{title}</h2>
        {intro && <p className="mt-3 text-base text-slate-600 max-w-2xl mx-auto text-center">{intro}</p>}
        <div className="mt-7 space-y-2.5">
          {items.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className="card-elevated rounded-2xl overflow-hidden" data-testid={`${testId}-${i}`}>
                <button
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="w-full flex items-center justify-between gap-4 p-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="font-semibold text-slate-900 text-[15px]">{f.q}</span>
                  <ChevronDown className={`h-5 w-5 brand-emerald shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-slate-700 text-sm leading-relaxed -mt-1 whitespace-pre-line">
                    {f.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <script
          type="application/ld+json"
        >
          {JSON.stringify(ld).replace(/</g, '\\u003c')}
        </script>
      </div>
    </section>
  );
}
