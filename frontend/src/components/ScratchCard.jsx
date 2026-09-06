import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { Gift, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';

// Silver scratch-card with realistic scratch interaction.
// • Top layer is a silver gradient with diagonal sheen + grain to mimic foil.
// • Drawing uses globalCompositeOperation = 'destination-out' to erase the
//   silver where the user drags, revealing the discount underneath.
// • Auto-reveals after 45% of the surface has been scratched.

export default function ScratchCard() {
  const [show, setShow] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [scratchPct, setScratchPct] = useState(0);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const isDrawing = useRef(false);
  const navigate = useNavigate();

  const [reward] = useState(() => {
    const existing = localStorage.getItem('ssu_scratch_coupon');
    if (existing) {
      try { return JSON.parse(existing); } catch { /* ignore */ }
    }
    const options = [
      { discount: 5, code: 'SMARTSAVE5' },
      { discount: 8, code: 'SMARTSAVE8' },
      { discount: 10, code: 'SMARTSAVE10' },
      { discount: 12, code: 'SMARTSAVE12' },
    ];
    return options[Math.floor(Math.random() * options.length)];
  });

  // First-time visitors only. Wait until user has actually engaged with the page
  // (scrolled past hero or 25s) so the modal never blocks initial reading.
  useEffect(() => {
    if (localStorage.getItem('ssu_scratch_seen')) return;
    // Only show on home/landing routes — never on checkout / dashboard / ai-search etc.
    const path = window.location.pathname;
    if (path !== '/' && path !== '/free-zones' && path !== '/mainland') return;

    let triggered = false;
    const trigger = () => {
      if (triggered) return;
      triggered = true;
      setShow(true);
      // Mark as seen on first show so refreshing the page doesn't re-open it.
      localStorage.setItem('ssu_scratch_seen', '1');
    };
    const onScroll = () => {
      if (window.scrollY > 800) trigger();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    const t = setTimeout(trigger, 25000);
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(t);
    };
  }, []);

  // Draw the silver foil. Runs after layout and on every container resize so
  // the canvas always matches the container dimensions exactly.
  const paintSilver = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Silver base gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#D9D9D9');
    grad.addColorStop(0.35, '#F4F4F4');
    grad.addColorStop(0.55, '#BFBFBF');
    grad.addColorStop(0.8, '#E8E8E8');
    grad.addColorStop(1, '#A8A8A8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Diagonal sheen stripes for foil feel
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-Math.PI / 6);
    for (let x = -w; x < w; x += 22) {
      const stripe = ctx.createLinearGradient(x, 0, x + 14, 0);
      stripe.addColorStop(0, 'rgba(255,255,255,0)');
      stripe.addColorStop(0.5, 'rgba(255,255,255,0.9)');
      stripe.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = stripe;
      ctx.fillRect(x, -h, 14, h * 2);
    }
    ctx.restore();

    // Grain noise
    const noise = 240;
    ctx.save();
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < noise; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000';
      ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    }
    ctx.restore();

    // Call-to-action text
    ctx.fillStyle = 'rgba(60,60,60,0.85)';
    ctx.font = `bold ${Math.min(18, Math.max(13, w / 22))}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SCRATCH HERE', w / 2, h / 2 - 12);
    ctx.font = `${Math.min(13, Math.max(10, w / 32))}px Inter, sans-serif`;
    ctx.fillStyle = 'rgba(80,80,80,0.75)';
    ctx.fillText('to reveal your discount', w / 2, h / 2 + 12);
  };

  // Initial paint when modal opens
  useLayoutEffect(() => {
    if (!show) return;
    setRevealed(false);
    setScratchPct(0);
    // Wait a frame so Dialog has laid out
    const id = requestAnimationFrame(() => {
      paintSilver();
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  // Repaint on container resize (so canvas dims always match)
  useEffect(() => {
    if (!show) return;
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => paintSilver());
    ro.observe(container);
    return () => ro.disconnect();
  }, [show]);

  // Scratch handler
  const scratch = (e) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    const x = point.clientX - rect.left;
    const y = point.clientY - rect.top;
    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 24, 0, Math.PI * 2);
    ctx.fill();
    // Soft brush edge
    ctx.beginPath();
    ctx.globalAlpha = 0.5;
    ctx.arc(x, y, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Sample pixels every ~8 strokes to compute scratched percentage
    setScratchPct((prev) => {
      const next = Math.min(prev + 1.6, 100);
      if (next >= 45 && !revealed) {
        setRevealed(true);
        // Fully clear so it's clean once revealed
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        localStorage.setItem('ssu_scratch_coupon', JSON.stringify(reward));
        localStorage.setItem('ssu_scratch_coupon_code', reward.code);
      }
      return next;
    });
  };

  const onDown = (e) => { isDrawing.current = true; scratch(e); };
  const onUp = () => { isDrawing.current = false; };

  const close = () => {
    setShow(false);
    localStorage.setItem('ssu_scratch_seen', '1');
  };

  return (
    <Dialog open={show} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-md rounded-3xl border-emerald-900/10 p-0 overflow-hidden">
        <VisuallyHidden.Root>
          <DialogTitle>Welcome scratch card discount</DialogTitle>
          <DialogDescription>Scratch the silver layer to reveal your first-time discount.</DialogDescription>
        </VisuallyHidden.Root>
        <div className="p-7">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] font-semibold brand-bronze">
            <Gift className="h-4 w-4" /> Welcome Gift
          </div>
          <h3 className="mt-3 font-display text-3xl font-semibold text-slate-900">You&apos;ve got a scratch card!</h3>
          <p className="mt-2 text-slate-600 text-sm">
            Scratch the silver foil below to reveal your exclusive first-time discount — applies to any UAE business setup package.
          </p>

          <div
            ref={containerRef}
            className="mt-6 relative h-48 rounded-2xl overflow-hidden border border-slate-300 select-none shadow-inner"
            data-testid="scratch-card-container"
          >
            {/* Discount underneath the silver foil */}
            <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-emerald-50 to-amber-50">
              <div className="text-center">
                <Sparkles className="h-6 w-6 brand-emerald mx-auto" />
                <div className="mt-2 text-[11px] uppercase tracking-[0.22em] text-emerald-700 font-semibold">Your exclusive discount</div>
                <div className="font-display text-5xl font-bold text-slate-900 mt-1" data-testid="scratch-card-discount">{reward.discount}% OFF</div>
                <div className="text-xs text-slate-500">any UAE business setup package</div>
              </div>
            </div>
            {/* Silver foil canvas */}
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full ${revealed ? 'pointer-events-none' : 'cursor-grab active:cursor-grabbing'} touch-none`}
              data-testid="scratch-card-canvas"
              onMouseDown={onDown}
              onMouseUp={onUp}
              onMouseLeave={onUp}
              onMouseMove={scratch}
              onTouchStart={onDown}
              onTouchEnd={onUp}
              onTouchMove={scratch}
            />
            {!revealed && (
              <div className="absolute bottom-2 left-0 right-0 mx-auto w-fit px-2.5 py-0.5 rounded-full bg-black/40 text-white text-[10px] font-semibold backdrop-blur" data-testid="scratch-progress">
                {Math.round(scratchPct)}% scratched
              </div>
            )}
          </div>

          {revealed && (
            <div className="mt-5 p-4 rounded-xl bg-emerald-50 border border-emerald-900/10 fade-up" data-testid="scratch-card-revealed">
              <div className="text-[10px] uppercase tracking-[0.22em] text-emerald-700 font-semibold">Your Code</div>
              <div className="flex items-center justify-between mt-1">
                <div className="font-mono text-xl font-bold text-slate-900">{reward.code}</div>
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(reward.code)} className="rounded-full border-emerald-900/20" data-testid="scratch-card-copy">Copy</Button>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Auto-applied at checkout · Valid 30 days · One-time use</div>
            </div>
          )}

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              onClick={() => { close(); navigate(`/checkout?coupon=${encodeURIComponent(reward.code)}`); }}
              className="btn-primary rounded-full w-full text-[13px] font-semibold px-3 h-11 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
              data-testid="scratch-card-start"
            >
              <span>Apply Now</span>
              <span aria-hidden="true">→</span>
            </Button>
            <Button onClick={close} variant="outline" className="rounded-full w-full border-slate-300 text-[13px] font-semibold px-3 h-11 inline-flex items-center justify-center whitespace-nowrap" data-testid="scratch-card-browse">
              Browse Free Zones
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
