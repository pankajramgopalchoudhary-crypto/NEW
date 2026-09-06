import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { CheckCircle2, Sparkles, MessageSquareText, Copy, FileUp, LayoutDashboard, Rocket } from 'lucide-react';
import { COMPANY_INFO } from '../data/zones';

const STEPS = [
  {
    n: 1,
    title: 'Slot Reserved',
    desc: 'Our advisor Pankaj contacts you within 2 hours via WhatsApp to confirm your details and answer questions.',
    done: true,
  },
  {
    n: 2,
    title: 'Name Availability Check (within 24 hours)',
    desc: 'We check all your company name preferences with the freezone authority and WhatsApp you availability results.',
    done: false,
  },
  {
    n: 3,
    title: 'Name Confirmed & Reserved',
    desc: 'You choose one available name. We reserve it formally. Setup fees due at this stage. Reservation fee is non-refundable.',
    done: false,
  },
  {
    n: 4,
    title: 'Document Upload',
    desc: 'Upload KYC documents: passport copy, photo, visa/entry stamp, and Emirates ID (if applicable).',
    done: false,
  },
  {
    n: 5,
    title: 'Licence Issued 🎉',
    desc: 'Submitted to the freezone authority. Typical processing: 24–72 hours. You receive trade licence and incorporation documents.',
    done: false,
  },
];

export default function CheckoutSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const reference = params.get('reference') || params.get('order') || 'UAE-' + Math.floor(Math.random() * 900000 + 100000);
  const amount = Number(params.get('amount') || 999);
  const zone = params.get('zone') || 'SPC Free Zone';
  const pkg = params.get('package') || 'Business Setup';
  const name = params.get('name') || 'Founder';
  const isBank = params.get('bank') === 'true';
  const [copied, setCopied] = useState(false);

  const confirmationText = useMemo(() => `✅ ORDER CONFIRMED — SmartSetupUAE.ae

Hi ${name}! Your UAE business setup order has been received.

📋 Order Ref: ${reference}
🏛 Zone: ${zone}
📦 Package: ${pkg}
💳 Amount paid: AED ${amount.toLocaleString()}${isBank ? ' (Pending bank credit — usually within 24 hours)' : ' (Paid)'}

What happens next:
1. Our advisor contacts you via WhatsApp within 2 hours.
2. We check all name preferences (within 24 hours).
3. Once a name is confirmed we proceed with setup fees and licence application.

Need help? WhatsApp us anytime: ${COMPANY_INFO.whatsapp}`,
  [name, reference, zone, pkg, amount, isBank]);

  const sendToWhatsApp = () => {
    const url = `https://wa.me/${COMPANY_INFO.whatsappNumber}?text=${encodeURIComponent(confirmationText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(confirmationText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('[checkout-success] clipboard write failed', err);
    }
  };

  // Auto-open WhatsApp confirmation once on mount (best-effort — many browsers block popup)
  useEffect(() => {
    const key = `ssu_conf_${reference}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    // Don't auto-open (popup blockers) — just keep the manual button prominent.
  }, [reference]);

  return (
    <div data-testid="checkout-success-page">
      <Navbar />
      <section className="bg-[#FFFCF5]">
        <div className="max-w-3xl mx-auto px-5 lg:px-8 pt-12 pb-20 space-y-6">
          {/* Hero */}
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-700 grid place-items-center shadow-lg"><CheckCircle2 className="h-8 w-8 text-white" strokeWidth={2.5} /></div>
            <h1 className="mt-5 font-display text-5xl font-bold text-slate-900">Order Confirmed!</h1>
            <p className="mt-3 text-slate-600">Our team will contact you via WhatsApp within <span className="font-semibold text-slate-900">2 hours</span>.</p>
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
              <Sparkles className="h-3.5 w-3.5 brand-emerald" />
              <span className="text-xs text-slate-700">Order Ref: <span className="font-mono font-bold brand-emerald" data-testid="order-ref">{reference}</span></span>
            </div>
            {isBank && (
              <div className="mt-3 mx-auto max-w-md p-3 rounded-xl bg-amber-50 border border-amber-200 text-[12px] text-amber-900" data-testid="bank-pending-note">
                ⏳ <span className="font-semibold">Pending bank credit</span> — your order will be activated once funds reflect (usually within 24 hours). Card payments are instant.
              </div>
            )}
          </div>

          {/* Save your order confirmation card */}
          <div className="card-elevated rounded-3xl p-6 sm:p-8" data-testid="save-confirmation-card">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-5 w-5 brand-emerald" />
              <h2 className="font-display text-xl font-semibold text-slate-900">Save Your Order Confirmation</h2>
            </div>
            <p className="mt-1 text-sm text-slate-600">Click the button below to send your order confirmation to your own WhatsApp. Save it for your records.</p>

            <div className="mt-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">Your confirmation message:</div>
              <pre
                data-testid="confirmation-message"
                className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-[12px] leading-relaxed text-slate-800 font-mono bg-white rounded-lg p-3 border border-emerald-200"
              >{confirmationText}</pre>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  onClick={sendToWhatsApp}
                  data-testid="send-to-whatsapp-btn"
                  className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-5 h-10"
                >
                  <MessageSquareText className="h-4 w-4 mr-2" /> Send to my WhatsApp
                </Button>
                <Button
                  onClick={copyMessage}
                  variant="outline"
                  data-testid="copy-message-btn"
                  className="rounded-full px-5 h-10 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                >
                  <Copy className="h-4 w-4 mr-2" /> {copied ? 'Copied!' : 'Copy Message'}
                </Button>
              </div>
            </div>
          </div>

          {/* What Happens Next */}
          <div className="card-elevated rounded-3xl p-6 sm:p-8" data-testid="what-happens-next">
            <div className="flex items-center gap-2">
              <Rocket className="h-5 w-5 brand-emerald" />
              <h2 className="font-display text-xl font-semibold text-slate-900">What Happens Next</h2>
            </div>

            <ol className="mt-5 relative space-y-5">
              {/* vertical connector */}
              <span aria-hidden className="absolute left-[14px] top-3 bottom-3 w-px bg-slate-200" />
              {STEPS.map((s) => (
                <li key={s.n} className="relative pl-12" data-testid={`step-${s.n}`}>
                  <div className={`absolute left-0 top-0 h-7 w-7 rounded-full grid place-items-center text-[11px] font-bold ring-4 ring-white ${
                    s.done ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {s.done ? <CheckCircle2 className="h-4 w-4 brand-emerald" strokeWidth={2.5} /> : s.n}
                  </div>
                  <div className="font-display text-base font-semibold text-slate-900">{s.title}</div>
                  <div className="text-[13px] text-slate-600 leading-snug mt-0.5">{s.desc}</div>
                </li>
              ))}
            </ol>

            <div className="mt-6 flex flex-wrap gap-3 justify-center">
              <Button
                onClick={() => navigate('/dashboard?upload=1')}
                data-testid="upload-docs-btn"
                className="rounded-full bg-emerald-800 hover:bg-emerald-900 text-white px-5 h-11"
              >
                <FileUp className="h-4 w-4 mr-2" /> Upload Documents Now
              </Button>
              <Button
                onClick={() => navigate('/dashboard')}
                variant="outline"
                data-testid="my-dashboard-btn"
                className="rounded-full px-5 h-11 border-emerald-800 text-emerald-800 hover:bg-emerald-50"
              >
                <LayoutDashboard className="h-4 w-4 mr-2" /> My Dashboard
              </Button>
            </div>

            <div className="mt-4 text-center text-[11px] text-slate-500">
              Order reference: <span className="font-mono font-bold text-emerald-800">{reference}</span>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
