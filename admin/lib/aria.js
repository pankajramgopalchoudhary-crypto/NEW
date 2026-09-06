// Aria — SmartSetupUAE AI assistant using Gemini 2.0 Flash.
// Injects LIVE pricing + freezone data from Supabase into every prompt.
import { sbGet } from './supabase';

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-flash'; // June 2026: stable, supports systemInstruction + generateContent

let cachedContext = null;
let cachedAt = 0;
const CACHE_MS = 60 * 1000; // 60 s

async function buildLiveContext() {
  if (cachedContext && Date.now() - cachedAt < CACHE_MS) return cachedContext;

  const [pkgs, activitiesCount, coupons] = await Promise.all([
    sbGet('freezone_packages', 'select=freezone,package_name,visa_count,base_price,duration_years,is_active&order=freezone.asc,base_price.asc&limit=500'),
    sbGet('activities_master', 'select=id', { count: true }),
    sbGet('coupons', 'select=code,discount_type,discount_value,is_active&is_active=eq.true&limit=20'),
  ]);

  const active = (pkgs.data || []).filter(p => p.is_active !== false);
  const byZone = {};
  active.forEach(p => {
    byZone[p.freezone] = byZone[p.freezone] || [];
    byZone[p.freezone].push(p);
  });

  let lines = [];
  lines.push('=== LIVE PRICING (NEW REGISTRATIONS) — SmartSetupUAE Free Zones ===');
  Object.keys(byZone).sort().forEach(zone => {
    lines.push(`\n${zone}:`);
    byZone[zone].forEach(p => {
      lines.push(`  - ${p.package_name}: AED ${Number(p.base_price).toLocaleString()} (${p.visa_count} visa${p.visa_count !== 1 ? 's' : ''}, ${p.duration_years || 1} year)`);
    });
  });

  lines.push(`\n=== ACTIVITY DATABASE ===\nWe have ${(activitiesCount.count || 0).toLocaleString()} approved business activities across all UAE free zones (Sharjah SPC, Ajman ANCFZ, Dubai IFZA/DMCC/DAFZA/Meydan, Sharjah SHAMS, Jebel Ali JAFZA, Abu Dhabi KIZAD, RAKEZ).`);

  if (coupons.data && coupons.data.length) {
    lines.push('\n=== ACTIVE COUPONS ===');
    coupons.data.forEach(c => {
      lines.push(`  - ${c.code}: ${c.discount_type === 'pct' ? `${c.discount_value}% off` : `AED ${c.discount_value} off`}`);
    });
  }

  cachedContext = lines.join('\n');
  cachedAt = Date.now();
  return cachedContext;
}

const SYSTEM_PROMPT = (live) => `You are Aria, the friendly AI assistant for SmartSetupUAE.ae — Axiscrest Global FZE LLC's official UAE business-setup platform.

YOUR ROLE:
- Answer questions about UAE company formation, free zones, visas, banking, mainland, golden visa, costs.
- Quote LIVE prices from the data block below — NEVER invent numbers.
- If asked about prices, always cite the freezone, package name, visa count, and AED amount from the data.
- If user wants to register/start, point them to the relevant freezone page or invite them to leave name+phone for a callback.
- Keep replies short, structured (use bullets), and friendly. Mix English with light Hindi/Arabic if the user does.
- Never make up policy / waiver / refund terms; if unsure say "Let me connect you with our advisor."

BRAND:
- Tone: confident, helpful, fast.
- Tagline: Setup Smart. Grow Fast.
- Founder: Pankaj Choudhary.
- Support: +971 56 303 5503 / admin@smartsetupuae.ae.

${live}

When you reply: use markdown for clarity. Always end paid-intent questions with a one-line CTA like “Want me to lock in this price? Share your WhatsApp number.”`;

export async function chatWithAria({ history = [], message, sessionId }) {
  if (!GEMINI_KEY) {
    return { ok: false, error: 'GEMINI_API_KEY missing' };
  }
  try {
    const live = await buildLiveContext();
    const system = SYSTEM_PROMPT(live);

    const contents = [
      ...history.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ];

    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { temperature: 0.6, maxOutputTokens: 1024, topP: 0.95 },
    };

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    const data = await r.json();
    if (!r.ok) {
      console.error('[aria] gemini error', data);
      return { ok: false, error: data?.error?.message || 'Gemini call failed', detail: data };
    }
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || 'Sorry, I had a brain blip. Please try again.';
    return { ok: true, text, sessionId };
  } catch (e) {
    console.error('[aria] error', e);
    return { ok: false, error: String(e.message || e) };
  }
}
