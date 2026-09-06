"""High-level notification triggers — composes branded email + WhatsApp message
for the 7 lifecycle events listed in PART 19 of the master prompt:

  1. Lead submitted
  2. Order placed / payment received
  3. Document approved
  4. Document rejected
  5. Appointment scheduled
  6. Renewal reminder
  7. Founder Club purchased

Anywhere in the app, just import and call:
    from notify_triggers import notify_order_placed
    await notify_order_placed(client_email='x@y.com', client_name='Sara', client_whatsapp='971...',
                              order_ref='ORD-001', amount=4888, currency='AED', package_name='IFZA Starter')

Each helper sends both channels (email via Resend, WhatsApp via Meta Cloud) and never
raises — it logs & returns a status dict. Order endpoint can decide whether to await.
"""
from __future__ import annotations
import os, logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from notifications import _send_resend_email, _send_wa, ADMIN_NOTIFY_WHATSAPP, NOTIFY_ADMIN_EMAIL

logger = logging.getLogger(__name__)

BRAND_NAME = "SmartSetupUAE"
BRAND_LEGAL = "Axiscrest-Global FZE LLC"
BRAND_PHONE = "+971 58 590 3155"
BRAND_URL = "https://smartsetupuae.ae"
BRAND_LOGO_URL = os.environ.get("BRAND_LOGO_URL", "")


def _e164(num: str) -> str:
    """Strip + and spaces from a phone number."""
    return "".join(ch for ch in (num or "") if ch.isdigit())


def _shell(title: str, body_html: str, cta_text: Optional[str] = None, cta_url: Optional[str] = None) -> str:
    cta_block = ""
    if cta_text and cta_url:
        cta_block = f"""
        <div style="text-align:center;margin:24px 0 8px">
          <a href="{cta_url}" style="display:inline-block;background:#0F2A2A;color:#F0C674;padding:12px 26px;border-radius:999px;font-weight:700;text-decoration:none;font-family:Inter,system-ui,Arial,sans-serif">
            {cta_text}
          </a>
        </div>"""
    return f"""<!doctype html><html><body style="margin:0;padding:0;background:#FFFCF5;font-family:Inter,system-ui,Arial,sans-serif;color:#0B1320">
      <div style="max-width:600px;margin:0 auto;background:#FFFCF5;padding:0">
        <!-- header -->
        <div style="background:linear-gradient(135deg,#0F2A2A 0%,#13433f 100%);padding:22px 28px;color:#fff">
          <div style="font-size:11px;letter-spacing:2px;color:#F0C674;font-weight:700;text-transform:uppercase">{BRAND_LEGAL}</div>
          <div style="font-size:22px;font-weight:800;margin-top:4px">SmartSetup<span style="color:#F0C674">UAE</span></div>
        </div>
        <!-- body -->
        <div style="padding:28px;background:#fff;border-bottom:1px solid #e2e8f0">
          <h1 style="margin:0 0 14px;font-size:20px;color:#0F2A2A;font-weight:700">{title}</h1>
          {body_html}
          {cta_block}
        </div>
        <!-- footer -->
        <div style="padding:20px 28px;font-size:11px;color:#64748b;text-align:center;background:#F8F3E8">
          {BRAND_LEGAL} · {BRAND_PHONE} · <a href="{BRAND_URL}" style="color:#0F2A2A">smartsetupuae.ae</a><br>
          Ajman Free Zone, United Arab Emirates · You received this because you are a {BRAND_NAME} client.
        </div>
      </div>
    </body></html>"""


async def _dual_send(name: str, email: Optional[str], whatsapp: Optional[str],
                     subject: str, html: str, wa_text: str) -> Dict[str, Any]:
    out = {"event": name, "ts": datetime.now(timezone.utc).isoformat()}
    if email:
        out["email"] = await _send_resend_email(email, subject, html)
    if whatsapp:
        out["whatsapp"] = await _send_wa(_e164(whatsapp), wa_text)
    # also mirror to admin
    if ADMIN_NOTIFY_WHATSAPP:
        try:
            await _send_wa(_e164(ADMIN_NOTIFY_WHATSAPP), f"[Internal · {name}] {wa_text[:1200]}")
        except Exception as e:
            logger.warning("Admin WA mirror failed: %s", e)
    return out


# ------------------- 1. LEAD SUBMITTED -------------------
async def notify_lead_submitted(*, lead_name: str, lead_phone: str = "",
                                lead_email: str = "", source: str = "website",
                                summary: str = "") -> Dict[str, Any]:
    subject = "We received your enquiry — SmartSetupUAE"
    html = _shell(
        f"Hi {lead_name.split()[0] if lead_name else 'there'}, we got your enquiry 👋",
        f"""<p style="margin:0 0 12px;font-size:14.5px;line-height:1.6">
            Thanks for reaching out to <b>SmartSetupUAE</b> — a senior advisor will WhatsApp you within
            <b>2 hours</b> with a personalised setup plan covering license, visas, banking & pricing.
          </p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#475569">
            Source: <b>{source}</b><br>
            Phone we'll call: <b>{lead_phone or '—'}</b><br>
            Notes: {summary or '—'}
          </p>
          <p style="margin:0;font-size:13px;color:#475569">
            Or chat with us now: <a href="https://wa.me/{_e164(BRAND_PHONE)}" style="color:#0F2A2A;font-weight:600">WhatsApp {BRAND_PHONE}</a>
          </p>""",
        cta_text="See your AI-matched zones", cta_url=f"{BRAND_URL}/ai-search",
    )
    wa = (f"Hi {lead_name.split()[0] if lead_name else 'there'}! Thanks for reaching out to SmartSetupUAE 👋\n"
          f"A senior advisor will contact you within 2 hours.\n\n"
          f"Need help right now? Reply here or call {BRAND_PHONE}.")
    return await _dual_send("lead_submitted", lead_email or None, lead_phone or None,
                            subject, html, wa)


# ------------------- 2. ORDER PLACED / PAYMENT RECEIVED -------------------
async def notify_order_placed(*, client_email: str, client_name: str = "",
                              client_whatsapp: str = "", order_ref: str = "",
                              amount: float = 0, currency: str = "AED",
                              package_name: str = "", line_items: Optional[List[str]] = None,
                              paid: bool = True) -> Dict[str, Any]:
    pretty_amount = f"{currency} {amount:,.2f}"
    items_html = ""
    if line_items:
        items_html = "<ul style='padding-left:18px;margin:8px 0 12px;font-size:14px;color:#0B1320'>"
        for li in line_items:
            items_html += f"<li style='margin:4px 0'>{li}</li>"
        items_html += "</ul>"
    status_pill = ("✅ Payment received" if paid else "⏳ Payment pending")
    subject = ("Order confirmed — " if paid else "Order received — ") + (package_name or order_ref or "SmartSetupUAE")
    html = _shell(
        f"{status_pill} · {package_name or 'Your SmartSetupUAE order'}",
        f"""<p style="margin:0 0 14px;font-size:14.5px;line-height:1.6">
              Hi {client_name.split()[0] if client_name else 'there'}, we have {'received your payment' if paid else 'recorded your order'}.
              A specialist has been assigned and will reach out shortly.
            </p>
            <div style="background:#F8F3E8;border:1px solid #F0C674;border-radius:12px;padding:14px 18px;margin:12px 0">
              <div style="font-size:11px;text-transform:uppercase;color:#B68A4A;font-weight:700;letter-spacing:1.5px">Order summary</div>
              <div style="font-size:18px;font-weight:800;color:#0F2A2A;margin-top:4px">{pretty_amount}</div>
              <div style="font-size:12.5px;color:#475569;margin-top:2px">Reference: <b>{order_ref or '—'}</b></div>
              {items_html}
            </div>
            <p style="margin:14px 0 0;font-size:13.5px;line-height:1.6">
              You can track every step (name reservation → license → EID → bank account) live in your <b>Founder Portal</b>.
            </p>""",
        cta_text="Open Founder Portal", cta_url=f"{BRAND_URL}/dashboard",
    )
    wa = (f"✅ {('Payment confirmed' if paid else 'Order received')} — SmartSetupUAE\n"
          f"Order: {order_ref or '—'}\n"
          f"Amount: {pretty_amount}\n"
          f"Package: {package_name or '—'}\n\n"
          f"Track progress: {BRAND_URL}/dashboard")
    return await _dual_send("order_placed", client_email or None, client_whatsapp or None,
                            subject, html, wa)


# ------------------- 3. DOCUMENT APPROVED -------------------
async def notify_doc_approved(*, client_email: str, client_name: str = "",
                              client_whatsapp: str = "", doc_label: str = "Document",
                              reviewer: str = "") -> Dict[str, Any]:
    subject = f"✅ {doc_label} approved"
    html = _shell(
        f"{doc_label} approved",
        f"""<p style="margin:0 0 12px;font-size:14.5px;line-height:1.6">
              Great news — your <b>{doc_label}</b> has been approved by our compliance team{(' (' + reviewer + ')') if reviewer else ''}.
              We are moving to the next step.
            </p>""",
        cta_text="View status", cta_url=f"{BRAND_URL}/dashboard",
    )
    wa = f"✅ {doc_label} approved by SmartSetupUAE. Track here: {BRAND_URL}/dashboard"
    return await _dual_send("document_approved", client_email or None, client_whatsapp or None,
                            subject, html, wa)


# ------------------- 4. DOCUMENT REJECTED -------------------
async def notify_doc_rejected(*, client_email: str, client_name: str = "",
                              client_whatsapp: str = "", doc_label: str = "Document",
                              reason: str = "Document is unclear or expired") -> Dict[str, Any]:
    subject = f"Action needed — {doc_label} re-upload"
    html = _shell(
        f"Please re-upload your {doc_label}",
        f"""<p style="margin:0 0 12px;font-size:14.5px;line-height:1.6">
              We need a clearer or updated <b>{doc_label}</b> to proceed.
            </p>
            <div style="background:#FEF3F2;border:1px solid #FBA8A0;border-radius:12px;padding:14px 18px;margin:12px 0;color:#7F1D1D">
              <b>Reason:</b> {reason}
            </div>
            <p style="margin:14px 0 0;font-size:14px;line-height:1.6">
              You can re-upload directly from your dashboard — our AI scanner will validate it instantly.
            </p>""",
        cta_text="Re-upload now", cta_url=f"{BRAND_URL}/dashboard#kyc",
    )
    wa = (f"⚠ SmartSetupUAE: please re-upload your {doc_label}.\n"
          f"Reason: {reason}\n"
          f"Upload here: {BRAND_URL}/dashboard")
    return await _dual_send("document_rejected", client_email or None, client_whatsapp or None,
                            subject, html, wa)


# ------------------- 5. APPOINTMENT SCHEDULED -------------------
async def notify_appointment_scheduled(*, client_email: str, client_name: str = "",
                                       client_whatsapp: str = "", appointment_type: str = "Medical Test",
                                       date_iso: str = "", location: str = "", address: str = "",
                                       map_url: str = "", documents: Optional[List[str]] = None) -> Dict[str, Any]:
    pretty_date = date_iso
    try:
        pretty_date = datetime.fromisoformat(date_iso.replace("Z", "+00:00")).strftime("%A, %d %b %Y · %H:%M")
    except Exception:
        pass
    docs_html = ""
    if documents:
        docs_html = "<p style='margin:10px 0 0;font-size:13px;color:#0B1320'><b>Bring:</b> " + ", ".join(documents) + "</p>"
    map_html = f"<p style='margin:6px 0 0;font-size:13px'><a href='{map_url}' style='color:#0F2A2A;font-weight:600'>Open in Google Maps →</a></p>" if map_url else ""
    subject = f"📅 {appointment_type} scheduled — {pretty_date}"
    html = _shell(
        f"{appointment_type} scheduled",
        f"""<p style="margin:0 0 14px;font-size:14.5px;line-height:1.6">
              Your <b>{appointment_type}</b> has been booked. Please arrive 15 minutes early.
            </p>
            <div style="background:#F0F9F4;border:1px solid #A7E0BD;border-radius:12px;padding:14px 18px;margin:12px 0">
              <div style="font-size:11px;text-transform:uppercase;color:#0F766E;font-weight:700;letter-spacing:1.5px">Appointment</div>
              <div style="font-size:17px;font-weight:800;color:#0F2A2A;margin-top:4px">{pretty_date}</div>
              <div style="font-size:14px;color:#0B1320;margin-top:4px"><b>{location}</b><br>{address}</div>
              {map_html}
              {docs_html}
            </div>""",
        cta_text="View in dashboard", cta_url=f"{BRAND_URL}/dashboard",
    )
    docs_wa = (" Bring: " + ", ".join(documents)) if documents else ""
    wa = (f"📅 {appointment_type} scheduled by SmartSetupUAE\n"
          f"When: {pretty_date}\nWhere: {location}, {address}\n"
          f"{('Map: ' + map_url) if map_url else ''}\n{docs_wa}\n\n"
          f"Full details: {BRAND_URL}/dashboard")
    return await _dual_send("appointment_scheduled", client_email or None, client_whatsapp or None,
                            subject, html, wa)


# ------------------- 6. RENEWAL REMINDER -------------------
async def notify_renewal_reminder(*, client_email: str, client_name: str = "",
                                  client_whatsapp: str = "", renewal_type: str = "License",
                                  due_date: str = "", days_remaining: int = 0) -> Dict[str, Any]:
    pretty = renewal_type.replace("_", " ").title()
    pretty_date = due_date
    try:
        pretty_date = datetime.fromisoformat(due_date.replace("Z", "+00:00")).strftime("%d %b %Y")
    except Exception:
        pass
    urgency = "🔴 URGENT" if days_remaining <= 7 else ("🟠 ACTION SOON" if days_remaining <= 30 else "🟢 UPCOMING")
    subject = f"{urgency} · {pretty} renewal due in {days_remaining} day{'s' if days_remaining != 1 else ''}"
    html = _shell(
        f"{pretty} renewal — {days_remaining} days remaining",
        f"""<p style="margin:0 0 12px;font-size:14.5px;line-height:1.6">
              Your <b>{pretty}</b> expires on <b>{pretty_date}</b>. Renewing before expiry avoids fines and ensures
              continuous business operation.
            </p>
            <div style="background:#FFF7E5;border:1px solid #F0C674;border-radius:12px;padding:14px 18px;margin:12px 0">
              <div style="font-size:11px;text-transform:uppercase;color:#B68A4A;font-weight:700;letter-spacing:1.5px">Status</div>
              <div style="font-size:18px;font-weight:800;color:#0F2A2A;margin-top:4px">{urgency} · {days_remaining} day{'s' if days_remaining != 1 else ''} left</div>
              <div style="font-size:13px;color:#475569;margin-top:2px">Due: {pretty_date}</div>
            </div>
            <p style="margin:14px 0 0;font-size:13.5px;line-height:1.6">
              Founder Club members get up to 10% off renewal fees.
            </p>""",
        cta_text="Start renewal", cta_url=f"{BRAND_URL}/dashboard",
    )
    wa = (f"{urgency} SmartSetupUAE renewal\n{pretty}: {pretty_date} ({days_remaining}d left)\n"
          f"Start: {BRAND_URL}/dashboard")
    return await _dual_send("renewal_reminder", client_email or None, client_whatsapp or None,
                            subject, html, wa)


# ------------------- 7. FOUNDER CLUB PURCHASED -------------------
async def notify_founder_club(*, client_email: str, client_name: str = "",
                              client_whatsapp: str = "", expiry_date: str = "") -> Dict[str, Any]:
    subject = "👑 Welcome to the SmartSetupUAE Founder Club"
    html = _shell(
        "Welcome to the Founder Club 👑",
        f"""<p style="margin:0 0 12px;font-size:14.5px;line-height:1.6">
              Hi {client_name.split()[0] if client_name else 'there'} — your Founder Club membership is now <b>ACTIVE</b>.
            </p>
            <ul style="margin:0 0 12px;padding-left:18px;font-size:14px;line-height:1.7">
              <li>10% off licence &amp; visa renewals (lifetime)</li>
              <li>Up to 15% off SmartSetupUAE services</li>
              <li>Dedicated senior advisor</li>
              <li>VAT &amp; corporate-tax filing support</li>
              <li>Banking introductions &amp; priority appointments</li>
            </ul>
            <p style="margin:0;font-size:13px;color:#475569">Expiry: <b>{expiry_date or 'Lifetime'}</b></p>""",
        cta_text="Open my Founder dashboard", cta_url=f"{BRAND_URL}/dashboard",
    )
    wa = ("👑 Welcome to the SmartSetupUAE Founder Club! Your membership is now active. "
          f"Open your dashboard: {BRAND_URL}/dashboard")
    return await _dual_send("founder_club_purchased", client_email or None, client_whatsapp or None,
                            subject, html, wa)
