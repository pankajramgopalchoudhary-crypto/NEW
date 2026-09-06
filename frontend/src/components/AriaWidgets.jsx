// Aria — AI Concierge floating widget + WhatsApp pulse button.
// Streams Gemini 3 Flash answers, captures leads inline, multilingual.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Sparkles, Loader2 } from 'lucide-react';
import { useI18n, LANGUAGES, flagUrl } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';

const WHATSAPP = '971585903155';
const API = process.env.REACT_APP_BACKEND_URL;
const SESSION_KEY = 'ssu_aria_session';

function genId() {
  return `aria_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

const QUICK_PROMPTS = {
  en: [
    "What's the cheapest free zone?",
    'Mainland vs Free Zone?',
    'How many visas can I get?',
    'Best zone for e-commerce?',
    'Can I get residency visa?',
    'Crypto / VARA setup?',
  ],
  ar: ['ما أرخص منطقة حرة؟', 'البر الرئيسي أم المنطقة الحرة؟', 'كم تأشيرة يمكنني الحصول عليها؟', 'أفضل منطقة للتجارة الإلكترونية؟'],
  hi: ['सबसे सस्ता फ्री ज़ोन?', 'मेनलैंड vs फ्री ज़ोन?', 'मुझे कितने वीज़ा मिल सकते हैं?', 'ई-कॉमर्स के लिए बेस्ट ज़ोन?'],
};

export function AriaChatbot() {
  const { lang, langMeta, t } = useI18n();
  const { user } = useAuth();
  const userEmail = user?.email || null;
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const sessionRef = useRef(null);
  const bottomRef = useRef(null);
  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: '', email: '', phone: '', country_code: '+971', nationality: '' });
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSent, setLeadSent] = useState(false);

  const submitLead = useCallback(async (e) => {
    e?.preventDefault?.();
    if (!leadForm.name || !leadForm.phone) return;
    setLeadSubmitting(true);
    try {
      await fetch(`${API}/api/aria/save-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...leadForm,
          session_id: sessionRef.current,
          source: 'aria-chatbot',
          transcript: messages.slice(-10).map((m) => `${m.role}: ${m.content}`).join('\n'),
        }),
      });
      setLeadSent(true);
      setLeadFormOpen(false);
      // Also open a support ticket so a human picks it up and SLA timer starts.
      try {
        const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
        await fetch(`${API}/api/support/tickets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: lastUserMsg?.content?.slice(0, 80) || 'New enquiry from Aria',
            message: messages.slice(-6).map((m) => `${m.role === 'user' ? 'Customer' : 'Aria'}: ${m.content}`).join('\n') || leadForm.name,
            customer_email: leadForm.email,
            customer_name: leadForm.name,
            phone: `${leadForm.country_code} ${leadForm.phone}`,
            channel: 'aria',
            related_url: window.location.pathname,
          }),
        });
      } catch (_t) { /* non-blocking */ }
      setMessages((m) => [...m, { role: 'assistant', content: `✓ Got it, ${leadForm.name}! I've opened a support ticket (you'll get a reference). Your advisor will WhatsApp you at ${leadForm.country_code} ${leadForm.phone} within 30 minutes. Meanwhile feel free to keep asking me anything.` }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Sorry — could not save your details. Please WhatsApp +971 58 590 3155 directly.' }]);
    } finally {
      setLeadSubmitting(false);
    }
  }, [leadForm, messages]);

  useEffect(() => {
    if (sessionRef.current) return;
    try {
      const existing = sessionStorage.getItem(SESSION_KEY);
      sessionRef.current = existing || genId();
      if (!existing) sessionStorage.setItem(SESSION_KEY, sessionRef.current);
    } catch (err) {
      sessionRef.current = genId();
      console.warn('[aria] could not persist session id', err);
    }
  }, []);

  // Greet once on open
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: 'assistant', content: t('chatGreeting') }]);
      setPulse(false);
    }
  }, [open, messages.length, t]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '', streaming: true }]);
    try {
      const resp = await fetch(`${API}/api/aria/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionRef.current,
          user_email: userEmail,
          message: text,
          language: (LANGUAGES.find((l) => l.code === lang) || {}).label || 'English',
          context: { page: window.location.pathname },
        }),
      });
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let acc = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const obj = JSON.parse(payload);
            if (obj.delta) {
              acc += obj.delta;
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { role: 'assistant', content: acc, streaming: true };
                return copy;
              });
            } else if (obj.error) {
              acc = `Sorry, I hit an error: ${obj.error}. Please WhatsApp our advisor.`;
            }
          } catch { /* noop */ }
        }
      }
      setMessages((m) => {
        const copy = [...m];
        // Detect lead-capture trigger tag from system prompt and strip it from display.
        const cleaned = (acc || '...').replace(/\[CAPTURE_LEAD\]/gi, '').trim();
        const wantsLead = /\[CAPTURE_LEAD\]/i.test(acc);
        copy[copy.length - 1] = { role: 'assistant', content: cleaned, streaming: false };
        if (wantsLead && !leadSent) {
          // Defer opening to next tick so message renders first.
          setTimeout(() => setLeadFormOpen(true), 350);
        }
        return copy;
      });
    } catch (err) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: 'assistant', content: `Connection issue — please WhatsApp +971 58 590 3155.`, streaming: false };
        return copy;
      });
    } finally {
      setSending(false);
    }
  }, [input, sending, lang, leadSent, userEmail]);

  const quickPrompts = QUICK_PROMPTS[lang] || QUICK_PROMPTS.en;

  return (
    <div data-smartsetup-widget="aria">
      {/* Launcher button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={`fixed bottom-6 right-6 z-50 group flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-br from-emerald-700 to-emerald-900 text-white shadow-2xl shadow-emerald-900/30 hover:scale-105 transition-transform`}
          data-testid="aria-launcher"
          dir={langMeta?.rtl ? 'rtl' : 'ltr'}
        >
          {pulse && <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-30" />}
          <Sparkles className="h-5 w-5" />
          <span className="hidden sm:inline text-sm font-semibold whitespace-nowrap">Ask Aria — AI Concierge</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-6rem)] bg-white rounded-2xl shadow-2xl shadow-emerald-900/20 border border-emerald-900/10 flex flex-col overflow-hidden"
          dir={langMeta?.rtl ? 'rtl' : 'ltr'}
          data-testid="aria-panel"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-emerald-800 to-emerald-700 text-white flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-amber-300/90 grid place-items-center font-display font-bold text-emerald-900">A</div>
            <div className="flex-1">
              <div className="font-semibold text-[15px]">Aria — AI Setup Concierge</div>
              <div className="text-[11px] opacity-85 flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" /> Online · 15 languages</div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-white/15" data-testid="aria-close"><X className="h-4 w-4" /></button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[linear-gradient(180deg,#FBFAF6,#FFFCF5)]">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-emerald-700 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'}`}>
                  {m.content || (m.streaming ? '...' : '')}
                  {m.streaming && m.content && <span className="inline-block w-1.5 h-3.5 bg-emerald-700 ml-0.5 align-middle animate-pulse" />}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Quick prompts */}
          {messages.length <= 1 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {quickPrompts.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-[11.5px] px-2.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-700/15 text-emerald-800 hover:bg-emerald-100 transition-colors"
                  data-testid="aria-quick-prompt"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            className="px-3 py-2.5 border-t border-slate-200 flex items-center gap-2 bg-white"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about UAE business setup…"
              disabled={sending}
              className="flex-1 px-3.5 py-2.5 rounded-full bg-slate-50 border border-slate-200 text-[13.5px] outline-none focus:border-emerald-700 focus:bg-white transition-colors"
              data-testid="aria-input"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="h-10 w-10 rounded-full bg-emerald-700 text-white grid place-items-center disabled:opacity-40 hover:bg-emerald-800 transition-colors"
              data-testid="aria-send"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>

          {/* Lead capture overlay */}
          {leadFormOpen && (
            <div className="absolute inset-0 z-10 bg-black/40 grid place-items-end" onClick={() => setLeadFormOpen(false)}>
              <form
                onClick={(e) => e.stopPropagation()}
                onSubmit={submitLead}
                className="w-full bg-white border-t-2 border-emerald-700 rounded-t-2xl p-5 fade-up"
                data-testid="aria-lead-form"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-emerald-700">Reserve your AED 999 slot</div>
                    <div className="font-semibold text-slate-900 mt-0.5">Your advisor will WhatsApp you in 30 min</div>
                  </div>
                  <button type="button" onClick={() => setLeadFormOpen(false)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
                </div>
                <div className="space-y-2">
                  <input required value={leadForm.name} onChange={(e) => setLeadForm((f) => ({ ...f, name: e.target.value }))} placeholder="Your name *" className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-700" data-testid="aria-lead-name" />
                  <div className="flex gap-1.5">
                    <select value={leadForm.country_code} onChange={(e) => setLeadForm((f) => ({ ...f, country_code: e.target.value }))} className="h-10 px-2 rounded-xl border border-slate-200 text-sm bg-white">
                      <option>+971</option><option>+91</option><option>+92</option><option>+44</option><option>+1</option><option>+65</option><option>+966</option>
                    </select>
                    <input required value={leadForm.phone} onChange={(e) => setLeadForm((f) => ({ ...f, phone: e.target.value }))} placeholder="WhatsApp number *" className="flex-1 h-10 px-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-700" data-testid="aria-lead-phone" />
                  </div>
                  <input type="email" value={leadForm.email} onChange={(e) => setLeadForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email (optional)" className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-700" />
                </div>
                <button type="submit" disabled={leadSubmitting || !leadForm.name || !leadForm.phone} className="mt-3 w-full h-11 rounded-xl bg-emerald-700 text-white font-semibold disabled:opacity-50 hover:bg-emerald-800 transition-colors" data-testid="aria-lead-submit">
                  {leadSubmitting ? 'Sending…' : 'Get my advisor call'}
                </button>
                <div className="mt-2 text-[10.5px] text-center text-slate-500">No spam · GDPR compliant · Reply STOP anytime</div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function WhatsAppFloatingButton() {
  const { lang } = useI18n();
  const msg = encodeURIComponent("Hi! I'm interested in setting up a business in UAE. Can you help?");
  return (
    <a
      href={`https://wa.me/${WHATSAPP}?text=${msg}`}
      target="_blank"
      rel="noopener noreferrer"
      data-smartsetup-widget="whatsapp"
      data-testid="whatsapp-floating-btn"
      className="fixed bottom-6 left-6 z-50 group flex items-center"
      aria-label="Chat on WhatsApp"
    >
      <span className="absolute h-14 w-14 rounded-full bg-[#25D366] animate-ping opacity-25" />
      <span className="relative h-14 w-14 rounded-full bg-[#25D366] grid place-items-center shadow-xl hover:scale-110 transition-transform">
        <svg viewBox="0 0 32 32" className="h-7 w-7 fill-white">
          <path d="M16.04 3C9.4 3 4 8.4 4 15.04c0 2.31.65 4.55 1.88 6.5L4 29l7.65-2c1.87 1.02 3.99 1.56 6.17 1.56h.01c6.64 0 12.04-5.4 12.04-12.04S22.68 3 16.04 3zm0 21.94c-1.92 0-3.8-.52-5.45-1.5l-.39-.23-4.04 1.06 1.08-3.94-.25-.41a9.92 9.92 0 01-1.52-5.28c0-5.51 4.49-10 10-10s10 4.49 10 10c0 5.5-4.49 10.3-10.43 10.3zm5.66-7.36c-.31-.16-1.83-.9-2.11-1-.28-.1-.48-.16-.69.16-.21.31-.79 1-.97 1.2-.18.21-.36.23-.66.08-.31-.16-1.3-.48-2.48-1.54-.92-.82-1.54-1.83-1.72-2.13-.18-.31-.02-.48.14-.63.14-.14.31-.36.47-.55.16-.18.21-.31.31-.52.1-.21.05-.39-.03-.55-.08-.16-.69-1.67-.95-2.28-.25-.6-.51-.52-.69-.53-.18-.01-.39-.01-.6-.01s-.55.08-.84.39c-.29.31-1.1 1.07-1.1 2.6 0 1.54 1.13 3.03 1.29 3.24.16.21 2.22 3.4 5.39 4.76.75.32 1.34.52 1.8.66.76.24 1.45.21 2 .13.61-.09 1.83-.75 2.09-1.47.26-.72.26-1.34.18-1.47-.08-.13-.28-.21-.59-.36z"/>
        </svg>
      </span>
      <span className="absolute left-16 whitespace-nowrap bg-emerald-900 text-white text-xs font-semibold px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        WhatsApp +971 58 590 3155
      </span>
    </a>
  );
}

export function LanguageSelector({ idSuffix = '' }) {
  const { lang, setLang, langMeta } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative notranslate" translate="no" data-smartsetup-widget="lang-selector">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full text-[12.5px] font-medium text-slate-700 hover:bg-slate-100 transition-colors"
        data-testid={`lang-selector-button${idSuffix}`}
        aria-label="Change language"
      >
        <img
          src={flagUrl(langMeta?.iso || 'gb')}
          alt={langMeta?.label || 'English'}
          width="20"
          height="14"
          className="rounded-sm shrink-0 object-cover"
          style={{ width: 20, height: 14 }}
        />
        <span className="hidden md:inline">{langMeta?.label || 'English'}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-slate-200 rounded-xl shadow-2xl p-1.5 min-w-[200px] max-h-[360px] overflow-y-auto">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] hover:bg-emerald-50 transition-colors ${lang === l.code ? 'bg-emerald-50 brand-emerald font-semibold' : 'text-slate-700'}`}
                data-testid={`lang-${l.code}`}
              >
                <img
                  src={flagUrl(l.iso)}
                  alt={l.label}
                  width="20"
                  height="14"
                  className="rounded-sm shrink-0 object-cover"
                  style={{ width: 20, height: 14 }}
                />
                <span className="flex-1 text-left">{l.label}</span>
                {lang === l.code && <span className="text-emerald-700">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
