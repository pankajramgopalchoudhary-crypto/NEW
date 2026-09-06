import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Building2, CheckCircle2, Globe2, ShieldCheck } from 'lucide-react';

const rows = [
  ['Definition', 'A UAE mainland company is licensed by an emirate economic department and can trade directly across the UAE market.', 'A free zone company is licensed by a specific free zone authority and is usually designed for international trade, services, ecommerce, and controlled UAE operations.'],
  ['Best for', 'Local UAE clients, government contracts, physical offices, local branches, regulated activities.', 'Lower-cost setup, 100% ownership, remote/flexi workspace, international clients, consultants, ecommerce, media, trading.'],
  ['Market access', 'Can trade directly with UAE mainland customers without a distributor.', 'Can trade internationally and within its free zone; mainland trading may need distributor/importer or extra structure.'],
  ['Office', 'Usually needs Ejari/physical office depending on emirate and activity.', 'Many free zones offer flexi desk, virtual desk, shared desk, or office packages.'],
  ['Visas', 'Visa quota depends on office, activity, labour/immigration approvals.', 'Visa quota depends on package and free zone rules.'],
  ['Cost style', 'Can be higher once office, approvals, labour and immigration files are included.', 'Often clearer package pricing with visas/add-ons selected upfront.'],
];

export default function MainlandVsFreeZone() {
  const navigate = useNavigate();
  return (
    <div>
      <Navbar />
      <section className="hero-gradient grain">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 pt-12 lg:pt-16 pb-14">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-600 font-semibold">
            <Globe2 className="h-4 w-4 brand-bronze" /> UAE structure comparison
          </div>
          <h1 className="mt-4 font-display text-5xl lg:text-7xl font-semibold leading-[1.02] text-slate-900">
            Mainland vs Free Zone:<br /><span className="shine-text">choose by how you trade.</span>
          </h1>
          <p className="mt-5 text-lg text-slate-600 max-w-3xl">
            Mainland is best when you need direct UAE market access, local branches or government contracts. Free zone is best when you want a faster, package-based setup with strong ownership and flexible workspace options.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button onClick={() => navigate('/mainland')} className="btn-primary rounded-full px-7 h-12">Explore Mainland</Button>
            <Button onClick={() => navigate('/free-zones')} variant="outline" className="rounded-full px-7 h-12 border-slate-300">Explore Free Zones</Button>
          </div>
        </div>
      </section>
      <section className="py-16 bg-[#FFFCF5]">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 grid lg:grid-cols-2 gap-6">
          <div className="card-elevated rounded-3xl p-7">
            <div className="h-11 w-11 rounded-xl bg-emerald-50 grid place-items-center"><Building2 className="h-5 w-5 brand-emerald" /></div>
            <h2 className="mt-4 font-display text-3xl font-semibold text-slate-900">What is Mainland?</h2>
            <p className="mt-3 text-slate-600 leading-relaxed">A mainland licence is issued by the relevant Department of Economy / DED. It lets the company operate directly in the UAE market, serve local customers, open physical branches, hire staff and bid for many government or enterprise contracts.</p>
          </div>
          <div className="card-elevated rounded-3xl p-7">
            <div className="h-11 w-11 rounded-xl bg-amber-50 grid place-items-center"><ShieldCheck className="h-5 w-5 brand-bronze" /></div>
            <h2 className="mt-4 font-display text-3xl font-semibold text-slate-900">What is a Free Zone?</h2>
            <p className="mt-3 text-slate-600 leading-relaxed">A free zone licence is issued by a free zone authority such as IFZA, Meydan, SPC, SHAMS, RAKEZ, DMCC, DAFZA or ANCFZ. It usually offers package-based pricing, flexible workspace, 100% foreign ownership and easier setup for many founders.</p>
          </div>
        </div>
      </section>
      <section className="py-16 bg-[#F8F3E8]">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr><th className="text-left p-4">Factor</th><th className="text-left p-4">Mainland</th><th className="text-left p-4">Free Zone</th></tr>
              </thead>
              <tbody>
                {rows.map(([factor, mainland, freezone]) => (
                  <tr key={factor} className="border-t border-slate-100">
                    <td className="p-4 font-semibold text-slate-900">{factor}</td>
                    <td className="p-4 text-slate-700">{mainland}</td>
                    <td className="p-4 text-slate-700">{freezone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-8 card-elevated rounded-3xl p-7">
            <h3 className="font-display text-2xl font-semibold text-slate-900">SmartSetupUAE recommendation</h3>
            <div className="mt-4 grid md:grid-cols-3 gap-4">
              {['Choose Mainland if your customers are mainly inside UAE.', 'Choose Free Zone if you want lower package cost and flexible workspace.', 'Ask us if your activity has approvals, office or banking constraints.'].map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-slate-700"><CheckCircle2 className="h-5 w-5 brand-emerald shrink-0" /> {item}</div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
