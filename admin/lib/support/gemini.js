// Direct Google Gemini callers (Node port of backend/aria.py helpers).
const KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function endpoint(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`;
}

export async function geminiText(system, user, { temperature = 0.5, maxOutputTokens = 1024 } = {}) {
  if (!KEY) throw new Error('GEMINI_API_KEY missing');
  const r = await fetch(endpoint(MODEL), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature, maxOutputTokens },
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `gemini ${r.status}`);
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || '').join('');
}

// Structured JSON output with model fallback + one retry on 503, mirroring
// gemini_direct_oneshot() in the Python backend.
export async function geminiJson(system, user) {
  if (!KEY) throw new Error('GEMINI_API_KEY missing');
  const models = [...new Set(['gemini-2.5-flash-lite', MODEL, 'gemini-2.0-flash-lite'])];
  let lastErr = '';
  for (const model of models) {
    const body = {
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const r = await fetch(endpoint(model), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        if (r.status === 503) { lastErr = `${model} overloaded`; await new Promise((s) => setTimeout(s, 1500)); continue; }
        const text = await r.text();
        if (r.status === 400 && text.includes('thinkingConfig')) {
          delete body.generationConfig.thinkingConfig;
          continue;
        }
        if (!r.ok) { lastErr = `${model} ${r.status}: ${text.slice(0, 200)}`; break; }
        const data = JSON.parse(text);
        const out = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
        if (out) return parseLooseJson(out);
        lastErr = `${model} empty`;
        break;
      } catch (e) {
        lastErr = `${model} ${e.message}`;
        break;
      }
    }
  }
  throw new Error(lastErr || 'Gemini exhausted');
}

export function parseLooseJson(raw) {
  let txt = String(raw || '').trim();
  if (txt.startsWith('```')) {
    const lines = txt.split('\n');
    txt = lines.length > 2 ? lines.slice(1, -1).join('\n') : txt.replace(/`/g, '');
  }
  if (txt.toLowerCase().startsWith('json')) txt = txt.slice(4).trim();
  if (!txt.startsWith('{')) {
    const s = txt.indexOf('{');
    const e = txt.lastIndexOf('}');
    if (s !== -1 && e !== -1) txt = txt.slice(s, e + 1);
  }
  return JSON.parse(txt);
}
