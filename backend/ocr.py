"""AI Document OCR — Passport / Emirates ID / Visa / Utility / License / MOA / Tenancy.

Uses Gemini 2.5 Flash vision (via emergentintegrations or direct Google API key — preferring
the direct key already in .env to stay on the free tier).
"""
from __future__ import annotations
import os, json, re, base64, logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ocr", tags=["ocr"])

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"


DOC_TYPES = {
    "passport": {
        "label": "Passport",
        "fields": ["full_name", "nationality", "gender", "date_of_birth", "passport_number",
                   "issue_date", "expiry_date", "place_of_birth", "issuing_country"],
    },
    "emirates_id": {
        "label": "Emirates ID",
        "fields": ["emirates_id_number", "full_name", "nationality", "expiry_date", "date_of_birth"],
    },
    "visa": {
        "label": "UAE Visa",
        "fields": ["visa_type", "full_name", "passport_number", "issue_date", "expiry_date",
                   "sponsor_name", "uid_number"],
    },
    "utility_bill": {
        "label": "Utility Bill",
        "fields": ["account_holder_name", "address_line_1", "city", "issuer", "bill_date", "amount_due"],
    },
    "trade_license": {
        "label": "Trade License",
        "fields": ["company_name", "license_number", "legal_form", "issue_date", "expiry_date",
                   "registered_address", "activities", "shareholders"],
    },
    "moa": {
        "label": "Memorandum of Association",
        "fields": ["company_name", "shareholders", "share_capital", "activities", "registered_address"],
    },
    "tenancy_contract": {
        "label": "Tenancy Contract (Ejari)",
        "fields": ["tenant_name", "landlord_name", "property_address", "rent_amount",
                   "lease_start", "lease_end", "ejari_number"],
    },
}


class OcrRequest(BaseModel):
    doc_type: str
    image_base64: str
    mime_type: str = "image/jpeg"


class OcrResponse(BaseModel):
    ok: bool
    doc_type: str
    confidence: float
    fields: Dict[str, Any]
    warning: Optional[str] = None
    raw: Optional[str] = None


def _build_prompt(doc_type: str) -> str:
    meta = DOC_TYPES[doc_type]
    field_list = ", ".join(meta["fields"])
    return f"""You are an OCR engine for UAE company formation. Extract structured data from this {meta['label']} image.

Return ONLY valid JSON in this exact shape:
{{
  "confidence": <float between 0 and 1, your honest estimate of legibility & extraction certainty>,
  "fields": {{
    {chr(10).join([f'    "{f}": "<value or empty>",' for f in meta["fields"]]).rstrip(",")}
  }},
  "issues": "<short reason if unclear>"
}}

RULES:
- Use ISO format (YYYY-MM-DD) for all dates.
- Use empty string "" for fields that are not visible or unreadable.
- Confidence below 0.95 if the image is blurry, cropped, or any required field is unreadable.
- Do NOT invent data. If unsure, leave the field empty and lower the confidence.
- Do NOT wrap the JSON in markdown fences.
"""


def _strip_json(text: str) -> str:
    text = text.strip()
    # Strip ```json ... ``` fences if present
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n", "", text)
        text = re.sub(r"\n```$", "", text)
    return text.strip()


@router.get("/types")
async def ocr_types():
    return {"types": [{"key": k, **v} for k, v in DOC_TYPES.items()]}


@router.post("/parse", response_model=OcrResponse)
async def parse_doc(req: OcrRequest):
    if req.doc_type not in DOC_TYPES:
        raise HTTPException(400, f"Unknown doc_type. Use one of: {list(DOC_TYPES.keys())}")
    if not GEMINI_API_KEY:
        raise HTTPException(500, "GEMINI_API_KEY not configured")
    if not req.image_base64 or len(req.image_base64) < 200:
        raise HTTPException(400, "image_base64 is required and must contain a real image")

    # Validate mime type
    mime = (req.mime_type or "image/jpeg").lower()
    if mime not in {"image/jpeg", "image/png", "image/webp", "application/pdf"}:
        raise HTTPException(400, f"Unsupported mime_type: {mime}. Use jpeg/png/webp/pdf.")

    prompt = _build_prompt(req.doc_type)
    body = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": mime, "data": req.image_base64}},
            ]
        }],
        "generationConfig": {"temperature": 0.1, "response_mime_type": "application/json"},
    }

    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(f"{GEMINI_URL}?key={GEMINI_API_KEY}", json=body)
        if r.status_code >= 400:
            logger.error("gemini ocr error %s: %s", r.status_code, r.text[:300])
            raise HTTPException(502, f"OCR provider error: {r.text[:200]}")
        data = r.json()
        try:
            text = data["candidates"][0]["content"]["parts"][0]["text"]
        except Exception:
            raise HTTPException(502, "OCR provider returned no text")

    cleaned = _strip_json(text)
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("OCR JSON parse failed: %s", cleaned[:300])
        return OcrResponse(
            ok=False, doc_type=req.doc_type, confidence=0.0,
            fields={}, warning="Document not clear. Please upload a clearer copy.", raw=cleaned[:500],
        )

    confidence = float(parsed.get("confidence", 0.0))
    fields = parsed.get("fields", {})
    warning = None
    if confidence < 0.95:
        warning = "Document not clear. Please upload a clearer copy."

    return OcrResponse(
        ok=confidence >= 0.95,
        doc_type=req.doc_type,
        confidence=round(confidence, 3),
        fields=fields,
        warning=warning,
    )
