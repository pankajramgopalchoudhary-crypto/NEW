"""Golden Visa PDF Guide generator — branded for Axiscrest-Global FZE LLC.

GET /api/guides/golden-visa.pdf → downloadable, branded one-pager.
"""
from __future__ import annotations
import io, logging, os
from datetime import datetime
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether,
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/guides", tags=["guides"])

EMERALD = colors.HexColor("#0F2A2A")
EMERALD_LIGHT = colors.HexColor("#13433F")
BRONZE = colors.HexColor("#B68A4A")
GOLD = colors.HexColor("#F0C674")
INK = colors.HexColor("#0B1320")
MUTED = colors.HexColor("#475569")
PARCHMENT = colors.HexColor("#FFFCF5")


def _styles():
    base = getSampleStyleSheet()
    return {
        "brand_kicker": ParagraphStyle("brand_kicker", parent=base["Normal"],
            fontName="Helvetica-Bold", fontSize=8, textColor=BRONZE, leading=10,
            spaceAfter=4, letterSpacing=1.5),
        "h1": ParagraphStyle("h1", parent=base["Heading1"], fontName="Helvetica-Bold",
            fontSize=22, leading=26, textColor=INK, spaceAfter=6),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontName="Helvetica-Bold",
            fontSize=14, leading=18, textColor=EMERALD, spaceBefore=14, spaceAfter=6),
        "h3": ParagraphStyle("h3", parent=base["Heading3"], fontName="Helvetica-Bold",
            fontSize=11, leading=14, textColor=INK, spaceBefore=8, spaceAfter=4),
        "body": ParagraphStyle("body", parent=base["BodyText"], fontName="Helvetica",
            fontSize=9.5, leading=14, textColor=INK, spaceAfter=4),
        "small": ParagraphStyle("small", parent=base["BodyText"], fontName="Helvetica",
            fontSize=8, leading=11, textColor=MUTED),
        "bullet": ParagraphStyle("bullet", parent=base["BodyText"], fontName="Helvetica",
            fontSize=9.5, leading=13.5, textColor=INK, leftIndent=12, bulletIndent=0,
            spaceAfter=2),
        "tag": ParagraphStyle("tag", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=8, textColor=EMERALD, leading=10),
    }


CATEGORIES = [
    {
        "icon": "🏠", "title": "Real Estate Investor",
        "tag": "Min. Property Value: AED 2,000,000",
        "body": "Own UAE property with a minimum value of AED 2,000,000. Property must be completed (not off-plan). "
                "Mortgaged property is accepted if the paid amount equals or exceeds AED 2M. Jointly owned property "
                "qualifies if each owner's share is AED 2M+.",
        "perks": ["No sponsor needed", "Family sponsorship included", "Multiple properties can be combined"],
    },
    {
        "icon": "💼", "title": "Business Investor",
        "tag": "Min. Investment: AED 2,000,000 OR AED 250K annual tax",
        "body": "Invest a minimum of AED 2,000,000 in a UAE business (not real estate). OR own a business with annual "
                "taxes paid of at least AED 250,000 per year. A letter from the Federal Tax Authority is required.",
        "perks": ["Free zone and mainland businesses eligible", "Partners qualify proportionally"],
    },
    {
        "icon": "👨‍💻", "title": "Skilled Professional",
        "tag": "Min. Salary: AED 30,000 / month · Priority sectors",
        "body": "Salaried employees earning a minimum of AED 30,000 per month working in priority sectors: technology, "
                "science, engineering, health, education, business, and culture. Must hold at least a bachelor's degree.",
        "perks": ["Bachelor's degree required", "Health insurance required", "Family sponsorship included"],
    },
    {
        "icon": "🚀", "title": "Entrepreneur",
        "tag": "Incubator letter · OR AED 7M exit · OR AED 1M revenue",
        "body": "Founders of a UAE-approved startup. Requires one of: (a) accredited UAE incubator/accelerator letter, "
                "(b) previous startup sold for ≥ AED 7M, or (c) startup with annual revenue ≥ AED 1M.",
        "perks": ["Free zone startups accepted", "Accredited: Hub71, in5, Area 2071, DIFC"],
    },
    {
        "icon": "🏆", "title": "Person of Exceptional Talent",
        "tag": "Government endorsement required · No minimum investment",
        "body": "Demonstrated outstanding achievement in science, technology, culture, arts, sports, or creative industries. "
                "Requires endorsement from a UAE federal/local authority, accredited professional body, or major international award.",
        "perks": ["Scientists, doctors, athletes, artists, coders", "UAE Pioneers programme available"],
    },
    {
        "icon": "🎓", "title": "Outstanding Student / Graduate",
        "tag": "95%+ school score · OR 3.8+ university GPA (UAE only)",
        "body": "Two pathways: (a) UAE high school graduates with ≥ 95% from a UAE MoE-approved school (apply within 6 months), "
                "OR (b) UAE university graduates with GPA ≥ 3.8/4.0 from a UAE-accredited university. No investment required.",
        "perks": ["UAE institution required", "Apply within 2 years of graduation", "Parents may be sponsored"],
    },
]

INCLUDES = [
    ("10-year renewable residency", "Renewable indefinitely as long as you meet the criteria. No annual renewal fees like standard visas."),
    ("No UAE sponsor required",      "You self-sponsor. Not tied to an employer or local sponsor for your residency status."),
    ("Sponsor spouse and children",  "Unlimited children (no age restriction for sons). Domestic workers and parents (some categories)."),
    ("Live outside UAE without losing visa", "Standard residency visas expire after 6 months outside the UAE. Golden Visa has no such restriction."),
    ("Emirates ID and health insurance", "Full Emirates ID issued. Health insurance is required and arranged via UAE-licensed providers."),
    ("Bank accounts and business access", "Treated as long-term residents — easier banking, property purchase, and business setup."),
]

TIMELINE = [
    ("Eligibility Check",        "1–2 days"),
    ("Document Preparation",     "3–5 days"),
    ("ICA Submission",           "1–2 days"),
    ("Medical & Emirates ID",    "5–7 days"),
    ("Visa Stamped",             "Total: ~3 weeks"),
]


def _header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    # Header band
    canvas.setFillColor(EMERALD)
    canvas.rect(0, h - 22 * mm, w, 22 * mm, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(18 * mm, h - 9 * mm, "AXISCREST-GLOBAL FZE LLC  |  SmartSetupUAE.ae")
    canvas.setFillColor(colors.whitesmoke)
    canvas.setFont("Helvetica-Bold", 14)
    canvas.drawString(18 * mm, h - 16 * mm, "UAE Golden Visa — Official Programme Guide")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(GOLD)
    canvas.drawRightString(w - 18 * mm, h - 9 * mm, f"Issued: {datetime.now().strftime('%d %b %Y')}")
    canvas.setFillColor(colors.whitesmoke)
    canvas.drawRightString(w - 18 * mm, h - 16 * mm, "Cabinet Resolution No. 65 of 2021 (amended)")

    # Footer band
    canvas.setFillColor(EMERALD)
    canvas.rect(0, 0, w, 14 * mm, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(18 * mm, 8 * mm, "AXISCREST-GLOBAL FZE LLC")
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.whitesmoke)
    canvas.drawString(18 * mm, 4.5 * mm,
        "Ajman Free Zone, UAE · contact@smartsetupuae.ae · WhatsApp +971 58 590 3155 · "
        "smartsetupuae.ae · For informational use only.")
    canvas.setFillColor(GOLD)
    canvas.drawRightString(w - 18 * mm, 8 * mm, f"Page {doc.page}")
    canvas.restoreState()


def _build_pdf() -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=28 * mm, bottomMargin=18 * mm,
        title="UAE Golden Visa — Axiscrest-Global FZE LLC", author="SmartSetupUAE",
    )
    S = _styles()
    story = []

    # Brand logo header
    try:
        from reportlab.platypus import Image as _Img
        logo_path = os.path.join(os.path.dirname(__file__), "assets", "brand-logo.png")
        story.append(_Img(logo_path, width=200, height=60))
        story.append(Spacer(1, 10))
    except Exception:
        pass

    story.append(Paragraph("OFFICIAL UAE GOVERNMENT PROGRAMME — UPDATED 2025", S["brand_kicker"]))
    story.append(Paragraph("Who Qualifies for a Golden Visa?", S["h1"]))
    story.append(Paragraph(
        "The UAE Golden Visa grants <b>10-year renewable residency with no sponsor required</b>. "
        "Eligible categories are defined by the UAE government under Cabinet Resolution No. 65 of 2021 "
        "(amended 2022–2025). This guide is prepared and distributed by <b>Axiscrest-Global FZE LLC</b> "
        "as part of the SmartSetupUAE concierge service.", S["body"]))

    # 2025 policy update box
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>📢 2025 POLICY UPDATE</b>", S["tag"]))
    story.append(Paragraph(
        "• The <b>2-year property residence visa</b> threshold has been reduced from AED 750,000 to "
        "<b>AED 400,000</b> for sole owners (each owner needs AED 400K for joint ownership).<br/>"
        "• The 10-year Golden Visa amount is unchanged at <b>AED 2,000,000</b>, but: "
        "(a) off-plan property is now accepted at <b>any construction stage</b> with a developer NOC "
        "(50%-completion rule removed); (b) mortgage condition relaxed — bank NOC accepted, the AED 1M "
        "minimum-paid is removed; (c) DLD now accepts <b>current market value</b> of the property.",
        S["body"]))

    # Categories table
    story.append(Paragraph("Eligibility Categories", S["h2"]))
    for cat in CATEGORIES:
        block = []
        block.append(Paragraph(f"{cat['icon']}  <b>{cat['title']}</b>", S["h3"]))
        block.append(Paragraph(cat["body"], S["body"]))
        block.append(Paragraph(f"<b>{cat['tag']}</b>", S["tag"]))
        for p in cat["perks"]:
            block.append(Paragraph(f"✓  {p}", S["bullet"]))
        block.append(Spacer(1, 4))
        story.append(KeepTogether(block))

    # Includes
    story.append(Paragraph("What the Golden Visa Includes", S["h2"]))
    data = [[Paragraph(f"<b>{a}</b>", S["body"]), Paragraph(b, S["body"])] for a, b in INCLUDES]
    t = Table(data, colWidths=[55 * mm, 115 * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.4, colors.lightgrey),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
        ("BACKGROUND", (0, 0), (0, -1), PARCHMENT),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t)

    # Timeline
    story.append(Paragraph("Application Process & Timeline", S["h2"]))
    tdata = [[Paragraph(f"<b>{i+1}. {step}</b>", S["body"]), Paragraph(when, S["body"])]
             for i, (step, when) in enumerate(TIMELINE)]
    tt = Table(tdata, colWidths=[100 * mm, 70 * mm])
    tt.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.4, colors.lightgrey),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
        ("BACKGROUND", (0, 0), (-1, 0), PARCHMENT),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(tt)

    story.append(Paragraph(
        "<b>Documents typically required:</b> Valid passport (6+ months) · Passport-size photo · Current UAE visa "
        "or entry stamp · Proof of qualifying investment / employment / achievement · Medical fitness certificate "
        "(done in UAE) · Health insurance · Emirates ID biometrics.",
        S["body"]))

    story.append(Spacer(1, 8))
    story.append(Paragraph("Ready to become a UAE Golden Resident?", S["h2"]))
    story.append(Paragraph(
        "Schedule your private consultation today. Our specialists have processed <b>500+ Golden Visa "
        "applications</b>. <br/><br/>"
        "📲 WhatsApp / Call: <b>+971 58 590 3155</b><br/>"
        "🌐 Apply online: <b>smartsetupuae.ae/golden-visa</b><br/>"
        "✉ Email: <b>contact@smartsetupuae.ae</b>",
        S["body"]))

    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "This document is published by <b>Axiscrest-Global FZE LLC</b> (Ajman Free Zone, United Arab Emirates) "
        "for informational purposes only. Eligibility criteria and government fees may change. Always confirm "
        "with the UAE Federal Authority for Identity, Citizenship, Customs &amp; Port Security (ICP) before "
        "applying. © Axiscrest-Global FZE LLC.",
        S["small"]))

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buf.getvalue()


@router.get("/golden-visa.pdf")
async def golden_visa_pdf():
    try:
        pdf_bytes = _build_pdf()
    except Exception:
        logger.exception("PDF build failed")
        raise
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="UAE-Golden-Visa-Guide-Axiscrest-Global.pdf"',
            "Cache-Control": "public, max-age=86400",
        },
    )
