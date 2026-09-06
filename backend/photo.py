"""Selfie → Passport-ready photo.

POST /api/photo/passportize  body = { image_base64, mime_type? }
Uses Gemini Nano Banana via the Emergent universal LLM key to:
  - remove the current background and replace with pure white
  - crop / re-frame to shoulders-up, face centered
  - keep facial identity intact
  - return base64-encoded PNG (35mm × 45mm aspect)

If Nano Banana cannot produce an image (rate-limited / unsupported subject),
returns { ok: False, error } so the frontend can show "Submit photo manually" CTA.
"""
from __future__ import annotations
import base64  # noqa: F401
import logging
import os
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent  # type: ignore

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/photo", tags=["photo"])

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
MODEL = "gemini-3.1-flash-image-preview"   # Nano Banana (latest, image-editing capable)

PASSPORT_PROMPT = (
    "Take the person in this selfie and produce a UAE passport-ready photo of them. "
    "Strict requirements: PURE WHITE background (no shadows, no gradient), centered "
    "shoulders-up framing, face takes ~70% of the vertical frame, neutral expression, "
    "eyes facing camera, mouth closed, no sunglasses, no hat, no heavy jewelry, "
    "professional even studio lighting on the face, sharp focus, natural skin tone, "
    "35mm × 45mm vertical aspect ratio, high resolution. "
    "Do NOT alter the person's identity, ethnicity, age or features — only the "
    "background, framing and lighting. Output exactly ONE image, no text."
)


class PassportizeRequest(BaseModel):
    image_base64: str
    mime_type: Optional[str] = "image/jpeg"


class PassportizeResponse(BaseModel):
    ok: bool
    image_base64: Optional[str] = None
    mime_type: Optional[str] = None
    error: Optional[str] = None


@router.post("/passportize", response_model=PassportizeResponse)
async def passportize(req: PassportizeRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY not configured.")
    if not req.image_base64 or len(req.image_base64) < 200:
        raise HTTPException(400, "image_base64 missing or too small.")

    # Strip data-URI prefix if the client included one
    raw = req.image_base64
    if raw.startswith("data:"):
        raw = raw.split(",", 1)[-1]

    try:
        chat = (
            LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"passport-{uuid.uuid4().hex[:10]}",
                system_message="You are a professional passport photo studio. Produce ONE image only.",
            )
            .with_model("gemini", MODEL)
            .with_params(modalities=["image", "text"])
        )
        msg = UserMessage(text=PASSPORT_PROMPT, file_contents=[ImageContent(raw)])
        _text, images = await chat.send_message_multimodal_response(msg)
        if not images:
            return PassportizeResponse(ok=False, error="Model did not return an image. Please use the 'Submit photo manually' option instead.")
        out = images[0]
        return PassportizeResponse(ok=True, image_base64=out["data"], mime_type=out.get("mime_type") or "image/png")
    except Exception as exc:
        logger.exception("Passportize failed")
        return PassportizeResponse(ok=False, error=f"AI photo studio failed: {str(exc)[:160]}")
