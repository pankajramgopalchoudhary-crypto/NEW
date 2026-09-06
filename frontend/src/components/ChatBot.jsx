import React, { useEffect, useRef, useState } from 'react';
import { Bot, Send, X, User, MessageSquareText } from 'lucide-react';
import { COMPANY_INFO } from '../data/zones';
import { captureLead } from '../lib/supabaseRest';

const QUICK = [
  'How much does a free zone cost?',
  'Free Zone vs Mainland?',
  'Golden Visa eligibility?',
  'How long does setup take?',
  'Can I get a bank account?',
  'What documents do I need?',
];

function botReply(text) {
  const t = text.toLowerCase().trim();
  if (/^(hi|hello|hey|salam|hola|namaste)/.test(t))
    return "Hi there! \ud83d\udc4b I'm the SmartSetupUAE assistant. I can help with free zones, mainland setup, visas, banking, costs and timelines. What would you like to know?";
  if (/(cost|price|how much|cheap|cheapest|budget|aed)/.test(t))
    return "\ud83d\udcb0 The cheapest UAE free zone is ANCFZ Ajman \u2014 from AED 4,888 (licence only). With 1 investor visa it's around AED 10,800. Dubai zones like Meydan or IFZA start AED 12,500\u201312,900. Want a custom quote? Share your activity and visa needs.";
  if (/(free ?zone vs mainland|mainland vs|difference|which is better)/.test(t))
    return "\ud83c\udfdb\ufe0f Free Zone = 100% ownership, lower cost, no UAE-public trading. Mainland = full UAE market access, government contracts, retail / restaurants. If you only serve international clients online \u2192 Free Zone. If you sell to UAE consumers offline \u2192 Mainland.";
  if (/(visa|residency|golden)/.test(t))
    return "\ud83d\udeec Visa options: Investor Visa (2 yr), Employee Visa (2 yr), Golden Visa (10 yr, AED 2M+ investment / specialised talent), Family Visa. Investor visa add-on AED 4,495. Golden Visa consulting AED 4,500. Tell me your profile and I'll check eligibility.";
  if (/(bank|account|banking|mashreq|emirates nbd|wio|fab|adcb)/.test(t))
    return "\ud83c\udfe6 We assist with bank account opening (AED 2,000) at Emirates NBD, Mashreq, FAB, ADCB and Wio. Required: trade licence, MoA, passport, address proof, and source of funds. Typical turnaround: 7\u201321 days.";
  if (/(document|paper|kyc|passport)/.test(t))
    return "\ud83d\udcc4 You'll need: passport copy (6+ months validity), passport photo, address proof, proposed company names (3), business activity, shareholder details. For regulated activities (e.g. financial, medical) additional approvals apply.";
  if (/(time|long|duration|how soon|days|weeks)/.test(t))
    return "\u23f1\ufe0f Fastest: ANCFZ 24\u201372 hours. SPC, IFZA, Meydan, SHAMS: 3\u20135 days. RAKEZ / JAFZA / DMCC: 1\u20134 weeks. Mainland (DED): 5\u201314 days. After licence: visa stamping 7\u201310 days, bank account 7\u201321 days.";
  if (/(refund|money back)/.test(t))
    return "\ud83d\udcdd Government fees are non-refundable once submitted. Our service fee is refundable before licence application. Full policy: /refund.";
  if (/(payment|pay|deposit|999|bank transfer)/.test(t))
    return `\ud83d\udcb3 Pre-booking deposit: AED ${COMPANY_INFO.prebookAmount} to reserve your slot. Pay via card, bank transfer or WhatsApp link. Bank: ${COMPANY_INFO.bank.name}, IBAN ${COMPANY_INFO.bank.iban}. Remaining balance shown in dashboard. Proof confirmation may take up to 24 hours.`;
  if (/(consultant|advisor|talk|human|agent|call)/.test(t))
    return "\ud83d\udc64 You can talk to a senior advisor right now. Click \"Chat on WhatsApp\" or book a free 30-min call at /consultation. Hours: 9am\u20139pm UAE.";
  if (/(activity|business|company|trade)/.test(t))
    return "\ud83d\udd0d Tell me your business activity (e.g., Software Development, E-Commerce, Restaurant) and I'll suggest the best free zone, cost and visa plan. Or open AI Search at /ai-search.";
  if (/(thank|thanks|cheers|appreciate)/.test(t))
    return "You're welcome! \ud83d\ude4c Anything else I can help with? You can also chat directly with our human advisor on WhatsApp.";
  return "Let me get a human advisor for that. Meanwhile, you can also share your name + WhatsApp here and we'll reach out within minutes. Or use the WhatsApp button below to chat directly.";
}

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([
    { from: 'bot', text: "\ud83d\udc4b Hi! I'm the SmartSetupUAE assistant. Ask me about free zones, mainland setup, visas, costs or banking." },
  ]);
  const [input, setInput] = useState('');
  const [collectLead, setCollectLead] = useState(false);
  const [lead, setLead] = useState({ name: '', phone: '' });
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, open]);

  const sendMessage = (text) => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { from: 'user', text }]);
    setInput('');
    setTimeout(() => {
      const reply = botReply(text);
      setMsgs((m) => {
        const next = [...m, { from: 'bot', text: reply }];
        if (next.length > 4 && !collectLead) {
          setTimeout(() => setCollectLead(true), 600);
        }
        return next;
      });
    }, 600);
  };

  const submitLead = async (e) => {
    e.preventDefault();
    if (!lead.name || !lead.phone) return;
    const payload = {
      source_page: 'chatbot',
      name: lead.name,
      phone_country_code: '+971',
      phone_number: lead.phone,
      message: msgs.map((m) => `${m.from}: ${m.text}`).join('\n'),
    };
    try {
      await captureLead(payload);
    } catch {
      const leads = JSON.parse(localStorage.getItem('ssu_leads') || '[]');
      leads.push({ ...payload, created_at: new Date().toISOString(), status: 'pending_sync' });
      localStorage.setItem('ssu_leads', JSON.stringify(leads));
    }
    setMsgs((m) => [...m, { from: 'bot', text: `Thanks ${lead.name.split(' ')[0]}! \ud83c\udf89 An advisor will WhatsApp you on +971 ${lead.phone} shortly. Anything else?` }]);
    setLead({ name: '', phone: '' });
    setCollectLead(false);
  };

  return (
    <>
      {/* Toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        data-testid="chatbot-toggle-btn"
        className="fixed bottom-5 right-24 z-[60] h-14 w-14 rounded-full bg-brand-emerald hover:opacity-90 transition-all text-white grid place-items-center shadow-2xl shadow-emerald-900/30"
        aria-label="Chat with us"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
        {!open && <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-amber-400 ring-2 ring-white animate-pulse" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-[60] w-[min(380px,calc(100vw-2rem))] h-[min(540px,calc(100vh-7rem))] card-elevated rounded-3xl overflow-hidden flex flex-col fade-up">
          {/* Header */}
          <div className="bg-brand-emerald p-4 text-[#FFFCF5]">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/15 grid place-items-center"><Bot className="h-5 w-5" /></div>
              <div className="flex-1">
                <div className="font-display text-lg font-semibold">SmartSetupUAE Advisor</div>
                <div className="text-xs flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" /> Online — replies instantly</div>
              </div>
              <button onClick={() => setOpen(false)} className="h-8 w-8 rounded-full hover:bg-white/15 grid place-items-center" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 bg-[#FFFCF5] space-y-3">
            {msgs.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.from === 'user' ? 'flex-row-reverse' : ''} fade-up`}>
                <div className={`h-7 w-7 rounded-full grid place-items-center shrink-0 ${m.from === 'user' ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                  {m.from === 'user' ? <User className="h-3.5 w-3.5 brand-bronze" /> : <Bot className="h-3.5 w-3.5 brand-emerald" />}
                </div>
                <div className={`px-3.5 py-2.5 rounded-2xl text-sm max-w-[78%] leading-relaxed ${m.from === 'user' ? 'bg-amber-100 text-slate-900 rounded-tr-sm' : 'bg-white border border-emerald-900/8 text-slate-800 rounded-tl-sm'}`}>
                  {m.text}
                </div>
              </div>
            ))}

            {/* Quick replies */}
            {msgs.length < 3 && (
              <div className="pt-2 flex flex-wrap gap-1.5">
                {QUICK.map((q) => (
                  <button key={q} onClick={() => sendMessage(q)} className="text-[11px] font-medium px-3 py-1.5 rounded-full border border-emerald-900/15 bg-white text-slate-700 hover:bg-emerald-50 hover:brand-emerald transition">
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Lead capture inline */}
            {collectLead && (
              <form onSubmit={submitLead} className="mt-2 p-3 rounded-2xl bg-emerald-50 border border-emerald-900/10 fade-up">
                <div className="text-xs font-semibold brand-emerald mb-2">Want an advisor to follow up?</div>
                <input value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} placeholder="Your name" className="w-full text-sm border border-emerald-200 rounded-lg px-3 py-2 mb-2 bg-white" />
                <div className="flex gap-2">
                  <div className="px-3 py-2 text-sm bg-white border border-emerald-200 rounded-lg text-slate-700">+971</div>
                  <input value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value.replace(/[^0-9]/g, '') })} placeholder="WhatsApp number" className="flex-1 text-sm border border-emerald-200 rounded-lg px-3 py-2 bg-white" />
                </div>
                <div className="flex gap-2 mt-2">
                  <button type="submit" className="flex-1 btn-primary rounded-lg py-2 text-xs font-semibold">Send to Advisor</button>
                  <button type="button" onClick={() => setCollectLead(false)} className="px-3 py-2 text-xs text-slate-500">Skip</button>
                </div>
              </form>
            )}
          </div>

          {/* Input */}
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="border-t border-emerald-900/10 p-3 flex items-center gap-2 bg-white">
            <input data-testid="chatbot-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your question…" className="flex-1 px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:border-brand-emerald" />
            <button data-testid="chatbot-send-btn" type="submit" className="h-10 w-10 rounded-full bg-brand-emerald text-white grid place-items-center hover:opacity-90" aria-label="Send"><Send className="h-4 w-4" /></button>
          </form>
          <a href={`https://wa.me/${COMPANY_INFO.whatsappNumber}?text=Hello%20SmartSetupUAE`} target="_blank" rel="noreferrer" className="px-4 py-2.5 bg-emerald-50 border-t border-emerald-900/10 text-xs font-semibold brand-emerald flex items-center justify-center gap-2 hover:bg-emerald-100 transition">
            <MessageSquareText className="h-3.5 w-3.5" /> Talk to a human on WhatsApp
          </a>
        </div>
      )}
    </>
  );
}
