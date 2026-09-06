"""Aria — AI Concierge for SmartSetupUAE.

Streams Gemini 3 Flash responses, grounded on live Supabase data
(freezone_packages, activities_master). Captures intent → leads.
"""
from __future__ import annotations
import os
import json
import asyncio
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

logger = logging.getLogger(__name__)

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3-flash-preview")
# Set LLM_PROVIDER=gemini in production .env to bypass Emergent and use Gemini directly.
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "emergent").lower()
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

router = APIRouter(prefix="/api/aria", tags=["aria"])


# ----------------------------------------------------------------------
# Direct Google Gemini caller (works on Hostinger / any host — no Emergent
# dependency). When GEMINI_API_KEY is present we prefer this. Falls back to
# the Emergent integrations layer.
# ----------------------------------------------------------------------
async def gemini_direct_stream(system: str, user: str):
    """Server-Sent-Events style async generator yielding text deltas.

    NOTE: Gemini 2.5 "thinking" models stream the thoughts BEFORE emitting any
    output text, which causes a ~10-20 second wait with zero bytes in the SSE
    stream. So we just call the non-streaming endpoint and chunk the output
    client-side. The frontend already has a beautiful interactive loader.
    """
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    body = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 1024},
    }
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(url, json=body, headers={"Content-Type": "application/json"})
            if r.status_code >= 400:
                yield {"error": r.text[:400]}
                return
            data = r.json()
            parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            full = "".join(p.get("text", "") for p in parts)
            if not full:
                yield {"error": "Empty response from Gemini"}
                return
            # Chunk into ~6 char pieces so the frontend gets a typing animation
            step = max(1, len(full) // 60)
            for i in range(0, len(full), step):
                yield {"delta": full[i:i + step]}
    except Exception as exc:
        yield {"error": str(exc)}


async def gemini_direct_oneshot(system: str, user: str) -> str:
    """One-shot Gemini call with fallback model + retry on 503 (overloaded).

    For structured JSON output we use flash-lite (no extended thinking) so the
    response fits inside the token budget reliably.
    """
    models_to_try = ["gemini-2.5-flash-lite", GEMINI_MODEL, "gemini-2.0-flash-lite"]
    seen = set()
    last_err = ""
    for model in models_to_try:
        if model in seen:
            continue
        seen.add(model)
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
        body = {
            "system_instruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 4096,
                "responseMimeType": "application/json",
                "thinkingConfig": {"thinkingBudget": 0},  # disable thinking for JSON tasks
            },
        }
        async with httpx.AsyncClient(timeout=45) as c:
            for attempt in range(2):
                try:
                    r = await c.post(url, json=body, headers={"Content-Type": "application/json"})
                    if r.status_code == 503:
                        last_err = f"{model} 503 overloaded"
                        await asyncio.sleep(1.5)
                        continue
                    if r.status_code == 400 and "thinkingConfig" in r.text:
                        # Model doesn't support thinkingConfig — retry without
                        body["generationConfig"].pop("thinkingConfig", None)
                        continue
                    if r.status_code >= 400:
                        last_err = f"{model} {r.status_code}: {r.text[:200]}"
                        break
                    data = r.json()
                    parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                    out = "".join(p.get("text", "") for p in parts)
                    if out:
                        return out
                    last_err = f"{model} empty"
                    break
                except Exception as e:
                    last_err = f"{model} exc: {e}"
                    break
    raise RuntimeError(last_err or "Gemini exhausted")


# ---------- Cached freezone snapshot for grounding ----------
_CACHE: Dict[str, Any] = {"packages": None}


async def _fetch_packages_snapshot() -> str:
    """Pull cheapest package per freezone from Supabase as a compact context string."""
    if _CACHE["packages"]:
        return _CACHE["packages"]
    if not (SUPABASE_URL and SUPABASE_SERVICE_KEY):
        return "(Pricing data unavailable.)"
    headers = {"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"}
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(
                f"{SUPABASE_URL}/rest/v1/freezone_packages",
                params={
                    "select": "freezone,package_name,visa_count,shareholder_count,base_price,activities_allowed,duration_years",
                    "is_active": "eq.true",
                    "order": "freezone.asc,base_price.asc",
                    "limit": "500",
                },
                headers=headers,
            )
            data = r.json() if r.status_code == 200 else []
    except Exception as exc:
        logger.warning("Supabase fetch failed: %s", exc)
        data = []

    # Compact per-zone summary
    by_zone: Dict[str, Dict[str, Any]] = {}
    for p in data:
        fz = p.get("freezone")
        if not fz:
            continue
        cur = by_zone.get(fz)
        if not cur or (p.get("base_price") or 0) < (cur.get("base_price") or 0):
            by_zone[fz] = p
    lines = ["LIVE UAE FREE ZONE PRICING (cheapest active package per zone, AED):"]
    for fz, p in sorted(by_zone.items()):
        lines.append(
            f"  • {fz}: {p.get('package_name')} — AED {int(p.get('base_price') or 0):,} "
            f"({p.get('visa_count') or 0} visas, {p.get('activities_allowed') or 3} activities, "
            f"{p.get('duration_years') or 1} yr)"
        )
    snap = "\n".join(lines)
    _CACHE["packages"] = snap
    return snap


SYSTEM_PROMPT_TEMPLATE = """You are Aria, the AI Business Setup Concierge for **SmartSetupUAE** (Axiscrest-Global FZE LLC).

You help entrepreneurs choose the right UAE jurisdiction (free zone or mainland), pick visa packages, understand setup cost, and convert curious visitors into booked clients.

# Voice
- Confident, warm, concise. Talk like a senior UAE consultant — not a chatbot.
- Always answer in the user's language. If they write Arabic, answer in Arabic. Hindi → Hindi. Etc.
- Replies under 110 words unless they explicitly ask for detail. Use bullets sparingly.
- Never invent prices or quotas — if data missing, say "let me confirm with an advisor".

# Grounding — these are the *only* prices you may quote
{pricing}

# UAE VISA ALLOTMENT (2026 — quote these confidently)
Visa quota always depends on workspace + free zone rules — never on Ejari for free zones.

- **DMCC**: flexi-desk ≈ 3 visas · serviced office 4–5 visas · physical office 1 visa per 100 sq.ft (largest scalable cap)
- **IFZA**: 0–6 visas per package; smart-desk (no office) up to 1 visa, larger packs 2–6
- **Meydan**: virtual office 1–6 visas; 6-visa pack is the bestseller
- **RAKEZ**: flexi-desk 1 visa · executive office 2–4 · larger industrial / warehouse 6+ visas
- **SHAMS**: 1–3 visas; media-focused, lean teams
- **SPC**: 1–3 visas with the standard creative package
- **ANCFZ (Ajman)**: 0–3 visas; cheapest entry pack starts at zero-visa
- **DAFZA**: 5–7 visas typical, scales with office sq.ft.
- **JAFZA**: starts at 3 visas, scales with warehouse size
- **DUBAI MAINLAND (DET)**: visa quota driven by Ejari office sq.ft (≈1 visa per 9 sqm / 100 sq.ft), starts ~AED 12,500
- **Golden Visa**: 10-yr residency, AED 2M property OR AED 2M deposit OR specialised talent — we handle the application.

# LEAD CAPTURE (CRITICAL)
The moment someone shows ANY of these intents, end your reply with the exact tag `[CAPTURE_LEAD]` on its own line. This is invisible to the user — our UI will detect it and open a small form (name + WhatsApp + email).

Intents that MUST trigger `[CAPTURE_LEAD]`:
- Asks "how do I start", "what's the process", "can I book", "I want this", "next step", "sign me up"
- Asks for a quote, exact price for their case, or to be contacted by a human
- Mentions "interested", "ready to go", "let's do it", "proceed"
- Shares their nationality + business + ANY commitment phrase
- Asks "do you call me", "can someone help me", "advisor", "consult", "WhatsApp me"

Before the tag, give one helpful 1-2 sentence reply. Example:
"For your activity (Software), ANCFZ at AED 4,888 is the cheapest. We can lock that price for 7 days with an AED 999 fully-refundable reservation.
[CAPTURE_LEAD]"

# Rules
- If the question is off-topic (cooking, sports, etc), redirect politely to UAE setup in one sentence — do NOT trigger lead capture.
- Never mention you are an AI, ChatGPT, Gemini, Claude, etc. You are "Aria, SmartSetupUAE's concierge".
- For mainland questions, mention that DET/DED mainland licences start ~AED 12,500 and visa quota depends on office Ejari.
- For banking: most UAE FZ business accounts open in 2-4 weeks; we introduce 6 partner banks free (Mashreq Neo, WIO, Emirates NBD, RAK Bank, ADCB, FAB).
- For taxes: 9% corporate tax above AED 375k profit, 5% VAT if registered, free zones get 0% if qualifying income only.
- Founder Club: AED 999/yr lifetime perks (priority advisor, free renewal reminders, 15% off year-2 services).
- WhatsApp: +971 58 590 3155.
- Reservation: AED 999, fully refundable within 7 days.
- Typical setup timeline: free-zone licence 3-7 working days, mainland 7-14 working days, residence visa 5-10 working days after medical/Emirates ID.
"""


class ChatRequest(BaseModel):
    session_id: str
    message: str
    language: Optional[str] = "English"
    context: Optional[Dict[str, Any]] = None  # current page, selected zone, etc
    user_email: Optional[str] = None  # used to persist & recall memory


# ---------- Aria persistent memory ----------
# Each user_email (or session_id when no email is provided) owns a transcript.
# Latest 12 turns are injected into the system prompt so Aria can resume
# conversations like a real long-term advisor.
try:
    from motor.motor_asyncio import AsyncIOMotorClient
    _mongo_client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    _aria_mem = _mongo_client[os.environ.get("DB_NAME", "smartsetupuae")]["aria_conversations"]
except Exception as _exc:  # pragma: no cover
    _aria_mem = None
    logger.warning("Aria memory disabled — Mongo not available: %s", _exc)


async def _load_recent_memory(key: str, limit: int = 12) -> List[Dict[str, str]]:
    if _aria_mem is None or not key:
        return []
    try:
        cursor = _aria_mem.find({"key": key}).sort("at", -1).limit(limit)
        rows = [doc async for doc in cursor]
        # Return oldest → newest for natural conversational flow
        return [{"role": r.get("role", "user"), "text": r.get("text", "")} for r in reversed(rows)]
    except Exception as exc:
        logger.warning("Aria memory load failed: %s", exc)
        return []


async def _append_memory(key: str, role: str, text: str) -> None:
    if _aria_mem is None or not key or not text:
        return
    try:
        from datetime import datetime, timezone
        await _aria_mem.insert_one({
            "key": key,
            "role": role,
            "text": text[:4000],
            "at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as exc:
        logger.warning("Aria memory append failed: %s", exc)


def _memory_to_prompt(turns: List[Dict[str, str]]) -> str:
    if not turns:
        return ""
    lines = ["\n\n# PREVIOUS CONVERSATION (use sparingly — only when it helps the user):"]
    for t in turns[-12:]:
        who = "User" if t.get("role") == "user" else "You"
        snippet = (t.get("text") or "").replace("\n", " ")[:240]
        lines.append(f"- {who}: {snippet}")
    lines.append("# END OF PREVIOUS CONVERSATION")
    return "\n".join(lines)


async def emergent_stream(system: str, user: str):
    """Stream a reply via Emergent universal LLM key.

    Uses **Claude Haiku 4.5** for chat — ~3-4x faster than Sonnet for
    conversational Aria replies, while keeping the same UAE knowledge quality.
    Falls back when the direct Gemini key is invalid / quota-exhausted.
    """
    try:
        chat = (LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"aria-{abs(hash(user)) % 10**9}",
            system_message=system,
        ).with_model("anthropic", "claude-haiku-4-5-20251001"))
        full_text = await chat.send_message(UserMessage(text=user))
        # Stream in ~12-char chunks for a snappy typing animation client-side
        step = max(1, len(full_text) // 30)
        for i in range(0, len(full_text), step):
            yield {"delta": full_text[i:i + step]}
    except Exception as exc:
        yield {"error": f"Emergent stream failed: {exc}"}


@router.post("/chat")
async def chat_stream(req: ChatRequest):
    # Pick provider: explicit LLM_PROVIDER override > Emergent (most reliable) > Gemini direct
    use_emergent = bool(EMERGENT_LLM_KEY) and LLM_PROVIDER != "gemini"
    if not use_emergent and not GEMINI_API_KEY:
        raise HTTPException(500, "No LLM provider configured (set EMERGENT_LLM_KEY or GEMINI_API_KEY).")

    pricing = await _fetch_packages_snapshot()
    sys_msg = SYSTEM_PROMPT_TEMPLATE.format(pricing=pricing)
    if req.language and req.language.lower() not in ("english", "en"):
        sys_msg += f"\n\n# IMPORTANT: Reply in **{req.language}** for this conversation."
    if req.context:
        sys_msg += f"\n\n# Current page context (use sparingly):\n{json.dumps(req.context)[:400]}"

    # PERSISTENT MEMORY — prefer user_email key, fall back to session_id
    memory_key = (req.user_email or req.session_id or "").strip().lower()
    recent_turns = await _load_recent_memory(memory_key) if memory_key else []
    sys_msg += _memory_to_prompt(recent_turns)

    # Persist the user message immediately (so a crash mid-reply still saves it)
    await _append_memory(memory_key, "user", req.message)

    async def event_generator():
        full_reply_chunks: List[str] = []
        try:
            generator = emergent_stream(sys_msg, req.message) if use_emergent else gemini_direct_stream(sys_msg, req.message)
            async for ev in generator:
                if "delta" in ev:
                    full_reply_chunks.append(ev["delta"])
                    yield f"data: {json.dumps({'delta': ev['delta']})}\n\n"
                elif "error" in ev:
                    # If Emergent errored AND we have a Gemini key as backup, try once
                    if use_emergent and GEMINI_API_KEY:
                        async for ev2 in gemini_direct_stream(sys_msg, req.message):
                            if "delta" in ev2:
                                full_reply_chunks.append(ev2["delta"])
                                yield f"data: {json.dumps({'delta': ev2['delta']})}\n\n"
                            elif "error" in ev2:
                                yield f"data: {json.dumps({'error': ev2['error']})}\n\n"
                        break
                    yield f"data: {json.dumps({'error': ev['error']})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            logger.exception("Aria stream failed")
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
            yield "data: [DONE]\n\n"
        finally:
            # Persist the final assistant response for memory
            final = "".join(full_reply_chunks).strip()
            if final and memory_key:
                await _append_memory(memory_key, "assistant", final)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------- Smart search ranker (one-shot, non-streaming) ----------
class SmartRankRequest(BaseModel):
    activity: str
    industry: Optional[str] = None
    nationality: Optional[str] = None
    visas_needed: Optional[int] = 1
    budget_aed: Optional[int] = None
    language: Optional[str] = "English"


@router.post("/smart-rank")
async def smart_rank(req: SmartRankRequest):
    """Use Claude Sonnet to produce a smarter ranking + 'why' explanation."""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY not configured.")

    pricing = await _fetch_packages_snapshot()
    system = (
        "You are a UAE business-setup ranking engine. Given an activity, return the top 3 "
        "free zones (from the LIVE PRICING list) most suitable, with a 1-line reason each.\n\n"
        "RANKING ALGORITHM — apply in this strict order:\n\n"
        "STEP 1 — ACTIVITY SPECIALISATION (40% weight) — match the activity to its specialised zone(s):\n"
        "- Gold · Diamonds · Precious metals · Commodities → DMCC (always top match — it is THE global hub)\n"
        "- Crypto · Blockchain · Web3 · Token · Virtual assets → DMCC (Crypto Centre)\n"
        "- AI · Machine learning · Robotics · Gaming → DMCC (AI Centre + Gaming Centre)\n"
        "- Media · Film · Music · Advertising · Publishing · Creative · Freelance creator → SHAMS, then SPC\n"
        "- E-Commerce · Online retail · Drop-shipping → IFZA, SPC, then ANCFZ\n"
        "- Aviation · Aerospace · Cargo · Logistics · Freight → DAFZA (airport-adjacent), then JAFZA\n"
        "- Maritime · Shipping · Oil & gas · Heavy industrial · Manufacturing · Warehouse → JAFZA, RAKEZ\n"
        "- Tech · SaaS · Software · IT consulting · App dev → IFZA, Meydan FZ, then ANCFZ\n"
        "- Management consulting · Marketing · HR · Advisory · Coaching → IFZA, Meydan FZ, ANCFZ\n"
        "- General trading · Import-export · Distribution → IFZA, RAKEZ, ANCFZ\n"
        "- Healthcare adjacent · Wellness · Fitness → DMCC Nook, RAKEZ\n"
        "- Education · Training · Tutoring → SPC, RAKEZ\n"
        "- Restaurant · Café · Cloud kitchen · F&B retail → Mainland (DET/DED) preferred — only mention freezone if explicitly asked\n\n"
        "STEP 2 — PRICE (30% weight) — among activity-matched zones, cheaper wins.\n"
        "STEP 3 — SPEED (15% weight) — 24-72 hrs > 1-2 weeks > 2-3 weeks.\n"
        "STEP 4 — VISA HEADROOM (10% weight) — bigger max visa quota if user needs >1.\n"
        "STEP 5 — POPULARITY / BRAND TRUST (5% weight) — DMCC, DAFZA, JAFZA carry more prestige.\n\n"
        "CRITICAL RULES:\n"
        "- ANCFZ/RAKEZ should NOT win every ranking just because they're cheap. They should win ONLY for general-purpose / tech / trading activities where no specialised zone exists.\n"
        "- For Gold/Diamonds → DMCC MUST be #1 even if it costs AED 15,000+ (specialisation overrides price).\n"
        "- For Media → SHAMS MUST be #1.\n"
        "- For Aviation/Logistics → DAFZA MUST be #1.\n"
        "- For Maritime/Heavy Industrial → JAFZA MUST be #1.\n"
        "- For pure software/consulting where any zone works → cheapest fast zone wins (often ANCFZ or IFZA).\n\n"
        "Score = (specialisation_match × 40) + (price_rank × 30) + (speed_rank × 15) + (visa_fit × 10) + (brand × 5).\n"
        "Always include the SPECIALISED zone in top 3, even if its price is higher.\n\n"
        "Output **strict JSON only** in this exact shape (no markdown, no commentary):\n"
        '{"top": [{"zone": "...", "package": "...", "price_aed": 0000, "speed": "...", "score": 0-100, "reason": "..."}, '
        '{"zone": "...", "package": "...", "price_aed": 0000, "speed": "...", "score": 0-100, "reason": "..."}, '
        '{"zone": "...", "package": "...", "price_aed": 0000, "speed": "...", "score": 0-100, "reason": "..."}], '
        '"summary": "1 short paragraph"}'
        f"\n\nLIVE PRICING (cheapest first per zone — trust these numbers, do not invent):\n{pricing}"
    )
    user = (
        f"Activity: {req.activity}\nIndustry: {req.industry or 'general'}\n"
        f"Nationality: {req.nationality or 'unknown'}\nVisas needed: {req.visas_needed}\n"
        f"Budget AED: {req.budget_aed or 'flexible'}\nLanguage for summary: {req.language}"
    )
    chat = None  # legacy fallback removed — Gemini-only
    try:
        out = await gemini_direct_oneshot(system, user)
        # Robust JSON parse — Gemini sometimes wraps in fences even with mime override
        txt = out.strip()
        # strip markdown fences
        if txt.startswith("```"):
            lines = txt.split("\n")
            txt = "\n".join(lines[1:-1]) if len(lines) > 2 else txt.strip("`")
        if txt.lower().startswith("json"):
            txt = txt[4:].strip()
        # extract first {...} block if extra prose snuck in
        if not txt.startswith("{"):
            start = txt.find("{")
            end = txt.rfind("}")
            if start != -1 and end != -1:
                txt = txt[start:end + 1]
        return json.loads(txt)
    except Exception as exc:
        logger.exception("smart_rank failed")
        return {"top": [], "summary": "", "error": str(exc)}


@router.post("/save-lead")
async def save_lead(payload: Dict[str, Any]):
    """Persist a chatbot-captured lead via Supabase REST."""
    if not (SUPABASE_URL and SUPABASE_SERVICE_KEY):
        raise HTTPException(500, "Supabase not configured.")
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    body = {
        "name": payload.get("name") or "Aria visitor",
        "email": payload.get("email") or "",
        "phone": payload.get("phone") or payload.get("whatsapp") or "",
        "country_code": payload.get("country_code") or "+971",
        "nationality": payload.get("nationality") or "",
        "residence_country": payload.get("residence_country") or "",
        "source": "aria-chatbot",
        "status": "new",
        "raw_payload": payload,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(f"{SUPABASE_URL}/rest/v1/leads", headers=headers, json=body)
            if r.status_code >= 400:
                logger.warning("save_lead failed: %s %s", r.status_code, r.text)
                raise HTTPException(r.status_code, r.text)
            return r.json()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, str(exc))
