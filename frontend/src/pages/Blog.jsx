import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { BLOG_POSTS } from '../mock';
import { Calendar, Clock, Sparkles, ArrowUpRight } from 'lucide-react';

export default function Blog() {
  const featured = BLOG_POSTS[0];
  const rest = BLOG_POSTS.slice(1);
  const [activePost, setActivePost] = useState(null);
  const openPost = (post) => {
    setActivePost(post);
    window.setTimeout(() => document.getElementById('blog-article')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  return (
    <div>
      <Navbar />
      <section className="hero-gradient grain">
        <div className="max-w-[1480px] mx-auto px-5 lg:px-8 pt-3 lg:pt-6 pb-9 text-center">
          <div className="inline-flex items-center gap-2 fade-up justify-center">
            <Sparkles className="h-4 w-4 brand-bronze" />
            <span className="text-xs uppercase tracking-[0.22em] text-slate-600 font-semibold">Insights &amp; Guides</span>
          </div>
          <h1 className="mt-3 font-display font-semibold text-slate-900 fade-up delay-100" style={{ fontSize: 'clamp(2.2rem, 4.6vw, 4.4rem)', lineHeight: 1.04 }}>The honest UAE<br /><span className="shine-text">setup journal.</span></h1>
          <p className="mt-4 text-base text-slate-600 max-w-2xl mx-auto fade-up delay-200">Cost breakdowns, jurisdiction comparisons, banking how-tos and visa updates — written by advisors, not marketers.</p>
        </div>
      </section>
      <section className="py-12 bg-[#FFFCF5]">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <button type="button" onClick={() => openPost(featured)} className="text-left group block card-elevated rounded-3xl overflow-hidden grid lg:grid-cols-2 w-full">
            <div className="aspect-[16/10] lg:aspect-auto overflow-hidden">
              <img src={featured.image} alt={featured.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            </div>
            <div className="p-8 lg:p-12 flex flex-col justify-center">
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="text-[10px] uppercase tracking-[0.2em] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 brand-emerald border border-emerald-900/10">{featured.category}</span>
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {featured.date}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {featured.readTime}</span>
              </div>
              <h2 className="font-display text-3xl lg:text-4xl font-semibold text-slate-900 mt-4 group-hover:brand-emerald transition-colors leading-tight">{featured.title}</h2>
              <p className="mt-3 text-slate-600">{featured.excerpt}</p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold brand-emerald">Read article <ArrowUpRight className="h-4 w-4" /></div>
            </div>
          </button>
        </div>
      </section>
      {activePost && (
        <section id="blog-article" className="py-12 bg-[#FFFCF5]">
          <div className="max-w-4xl mx-auto px-5 lg:px-8">
            <article className="card-elevated rounded-3xl p-8 lg:p-10">
              <div className="text-[10px] uppercase tracking-[0.2em] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 brand-emerald border border-emerald-900/10 inline-block">{activePost.category}</div>
              <h2 className="mt-4 font-display text-4xl font-semibold text-slate-900">{activePost.title}</h2>
              <p className="mt-3 text-slate-600">{activePost.excerpt}</p>
              <div className="mt-6 space-y-4 text-slate-700 leading-relaxed">
                <p>SmartSetupUAE recommends comparing the full first-year and renewal cost before choosing a UAE jurisdiction. The best option depends on activity approval, visa needs, office requirements, banking expectations and whether the company will trade locally or internationally.</p>
                <p>For founders, the right decision is rarely only the cheapest headline licence. Review authority fees, visa costs, establishment card, workspace, add-ons, service support and renewal obligations together.</p>
                <p>Use the AI Activity Search, Free Zone Finder, Mainland page or consultation form to confirm the exact route before payment.</p>
              </div>
              <Button onClick={() => setActivePost(null)} variant="outline" className="mt-7 rounded-full border-slate-300">Close Article</Button>
            </article>
          </div>
        </section>
      )}
      <section className="py-12 pb-24 bg-[#FFFCF5]">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rest.map((p) => (
            <button key={p.id} type="button" onClick={() => openPost(p)} className="text-left group card-elevated rounded-2xl overflow-hidden">
              <div className="aspect-[16/10] overflow-hidden">
                <img src={p.image} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="text-[10px] uppercase tracking-[0.2em] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 brand-emerald border border-emerald-900/10">{p.category}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {p.readTime}</span>
                </div>
                <h3 className="font-display text-xl font-semibold mt-3 text-slate-900 group-hover:brand-emerald transition-colors leading-snug">{p.title}</h3>
                <p className="mt-2 text-sm text-slate-600 line-clamp-2">{p.excerpt}</p>
              </div>
            </button>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
}
