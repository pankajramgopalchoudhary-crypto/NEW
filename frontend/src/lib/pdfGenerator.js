// PDF generator for AI Search comparison reports.
// Generates a branded multi-page PDF with full freezone comparison.
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const BRAND = {
  emerald: [4, 73, 50],
  bronze: [184, 119, 33],
  ink: [15, 23, 42],
  muted: [100, 116, 139],
  cream: [255, 252, 245],
};

function header(doc, title) {
  doc.setFillColor(...BRAND.emerald);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 252, 245);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('SmartSetupUAE.ae', 14, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('by Axiscrest-Global FZE LLC · Licence 262843696888 · Amber Gem Tower, Ajman', 14, 17.5);
  doc.setFontSize(8.5);
  doc.text('+971 58 590 3155  ·  info@smartsetupuae.ae  ·  www.smartsetupuae.ae', 14, 22.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title, 196, 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), 196, 20, { align: 'right' });
}

function footer(doc, pageNum, total) {
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.text(
    `Generated ${new Date().toLocaleString()} · www.smartsetupuae.ae · +971 58 590 3155`,
    14,
    290,
  );
  doc.text(`Page ${pageNum} / ${total}`, 196, 290, { align: 'right' });
}

export function generateAISearchPDF({ recommendation, lead = {}, allPackages = [] }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const activity = recommendation?.activity || 'UAE Business Setup';
  header(doc, 'AI Search Report');

  // Hero
  doc.setTextColor(...BRAND.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('Your AI-matched UAE setup', 14, 42);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.muted);
  const subline = `Activity: ${activity}${recommendation?.activityCode ? ' (' + recommendation.activityCode + ')' : ''} · Industry: ${recommendation?.industryGroup || 'General'}`;
  doc.text(subline, 14, 50);

  // Lead info card
  if (lead?.name || lead?.email) {
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(...BRAND.cream);
    doc.roundedRect(14, 56, 182, 22, 3, 3, 'FD');
    doc.setTextColor(...BRAND.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('PREPARED FOR', 19, 63);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`${lead.name || '—'}  ·  ${lead.email || '—'}  ·  ${lead.countryCode || ''} ${lead.phone || ''}`, 19, 70);
    if (lead.nationality || lead.residenceCountry) {
      doc.setFontSize(9);
      doc.setTextColor(...BRAND.muted);
      doc.text(`Nationality: ${lead.nationality || '—'}  ·  Country of residence: ${lead.residenceCountry || '—'}`, 19, 75);
    }
  }

  // Top 3 ranked zones card
  const startY = lead?.name ? 88 : 64;
  doc.setTextColor(...BRAND.emerald);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('AI-RANKED RECOMMENDATIONS', 14, startY);

  const options = recommendation?.options || [];
  if (options.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.muted);
    doc.text('No matched packages — please contact our advisor for a tailored quote.', 14, startY + 8);
  } else {
    autoTable(doc, {
      startY: startY + 4,
      head: [['Rank', 'Free Zone', 'Package', 'Validity', 'Visas', 'Activities', 'Match', 'From (AED)']],
      body: options.map((o, i) => [
        i === 0 ? 'BEST' : `#${i + 1}`,
        o.zone_name || '—',
        o.package_name || '—',
        o.raw?.duration_years ? `${o.raw.duration_years} yr${o.raw.duration_years > 1 ? 's' : ''}` : '1 yr',
        o.visa_quota ?? '—',
        o.activities_allowed ?? '3',
        `${o.score}%`,
        Number(o.gov || 0).toLocaleString(),
      ]),
      theme: 'striped',
      headStyles: { fillColor: BRAND.emerald, textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: BRAND.ink },
      alternateRowStyles: { fillColor: [252, 250, 244] },
      columnStyles: { 0: { fontStyle: 'bold' }, 6: { halign: 'right' }, 7: { halign: 'right', fontStyle: 'bold' } },
    });

    let nextY = doc.lastAutoTable.finalY + 6;
    if (options[0]?.reasons?.length) {
      doc.setTextColor(...BRAND.ink);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`Why ${options[0].zone_name} is your best match:`, 14, nextY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...BRAND.muted);
      options[0].reasons.forEach((r, i) => {
        doc.text(`•  ${r}`, 16, nextY + 6 + i * 5);
      });
    }
  }

  // ---- Page 2 — Full comparison table (all freezones) ----
  if (allPackages.length > 0) {
    doc.addPage();
    header(doc, 'Full Comparison');
    doc.setTextColor(...BRAND.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('All UAE Free Zones — At a glance', 14, 42);

    // Cheapest package per zone
    const byZone = new Map();
    allPackages.forEach((p) => {
      const k = String(p.slug || p.freezone_name || '').toLowerCase();
      const cur = byZone.get(k);
      if (!cur || (p.base_price || 0) < (cur.base_price || 0)) byZone.set(k, p);
    });
    const rows = [...byZone.values()].sort((a, b) => (a.base_price || 0) - (b.base_price || 0));

    autoTable(doc, {
      startY: 48,
      head: [['Free Zone', 'Cheapest Package', 'Validity', 'Visas', 'Activities', 'Shareholders', 'Starting Price (AED)']],
      body: rows.map((p) => [
        p.freezone_name || '—',
        p.package_name || '—',
        p.duration_years ? `${p.duration_years} yr${p.duration_years > 1 ? 's' : ''}` : '1 yr',
        p.visa_count ?? 0,
        p.activities_allowed ?? 3,
        (p.shareholder_count && p.shareholder_count < 50) ? `Up to ${p.shareholder_count}` : 'Up to 50',
        Number(p.base_price || 0).toLocaleString(),
      ]),
      theme: 'grid',
      headStyles: { fillColor: BRAND.emerald, textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: BRAND.ink },
      alternateRowStyles: { fillColor: [252, 250, 244] },
      columnStyles: { 6: { halign: 'right', fontStyle: 'bold' } },
    });
  }

  // ---- Page 3 — Next steps + contact ----
  doc.addPage();
  header(doc, 'Next Steps');
  doc.setTextColor(...BRAND.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Ready to launch your UAE company?', 14, 42);

  const steps = [
    ['1', 'Talk to a SmartSetupUAE advisor', 'Free call within 30 minutes. We confirm activity codes, freezone fit, and best price.'],
    ['2', 'Reserve your slot — AED 999', 'Locks in your quote and discount. Fully refundable if you change your mind in 7 days.'],
    ['3', 'Submit KYC + name', 'Upload passport, photo, choose 3 trade names. We handle Arabic translation, MOA, e-stamping.'],
    ['4', 'Trade Licence issued', 'Most freezones: 3–5 business days. Then visa stamping (UID → entry → medical → EID).'],
    ['5', 'Bank account opening', 'Free introduction to 6 UAE banks. Account in 2–4 weeks.'],
  ];
  let y = 52;
  steps.forEach(([num, t, d]) => {
    doc.setFillColor(...BRAND.emerald);
    doc.circle(20, y, 4, 'F');
    doc.setTextColor(255, 252, 245);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(num, 20, y + 1.4, { align: 'center' });
    doc.setTextColor(...BRAND.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(t, 30, y + 1);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.muted);
    const lines = doc.splitTextToSize(d, 160);
    doc.text(lines, 30, y + 7);
    y += 17;
  });

  // Contact card
  doc.setFillColor(...BRAND.emerald);
  doc.roundedRect(14, 220, 182, 50, 4, 4, 'F');
  doc.setTextColor(255, 252, 245);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Talk to a SmartSetupUAE advisor — free, no pressure', 22, 232);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('WhatsApp: +971 58 590 3155   ·   Email: info@smartsetupuae.ae', 22, 242);
  doc.text('Website: www.smartsetupuae.ae   ·   Office: 26th Floor, Amber Gem Tower, Ajman', 22, 250);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Save AED 1,000 — mention promo code AI-MATCH when you call', 22, 261);

  // Page numbers
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);
    footer(doc, i, total);
  }

  const fname = `SmartSetupUAE_AI_Search_${(activity || 'report').replace(/[^a-z0-9]+/gi, '_').slice(0, 32)}_${Date.now()}.pdf`;
  doc.save(fname);
  return fname;
}

/**
 * Compare PDF — side-by-side jurisdiction comparison for up to 4 free zones.
 * Receives the same ROWS + selectedZones array used in Compare.jsx so the PDF
 * mirrors what the user sees on screen.
 */
export function generateComparePDF({ selectedZones = [], rows = [], activity = '' }) {
  if (!selectedZones.length) return null;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  header(doc, 'Free-Zone Comparison');

  // Title block
  doc.setTextColor(...BRAND.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(
    `Side-by-side comparison — ${selectedZones.length} jurisdictions${activity ? ` · ${activity}` : ''}`,
    14,
    40,
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.muted);
  doc.text(
    'Live pricing from SmartSetupUAE database. Generated for your records — VAT-inclusive where applicable.',
    14,
    47,
  );

  // Build columns: first column = data point label, then one per zone
  const head = [['Data point', ...selectedZones.map((z) => z.name)]];
  const body = rows.map((r) => [r.label, ...selectedZones.map((z) => {
    try {
      const v = r.get(z);
      return typeof v === 'string' ? v : String(v ?? '—');
    } catch {
      return '—';
    }
  })]);

  autoTable(doc, {
    head,
    body,
    startY: 53,
    styles: { fontSize: 8, cellPadding: 2.5, valign: 'middle', overflow: 'linebreak' },
    headStyles: { fillColor: BRAND.emerald, textColor: BRAND.cream, fontStyle: 'bold' },
    columnStyles: { 0: { fontStyle: 'bold', textColor: BRAND.ink, cellWidth: 60 } },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      // page numbers re-drawn at the end (after we know total)
    },
  });

  // Closing CTA
  const finalY = doc.lastAutoTable.finalY || 53;
  if (finalY < 175) {
    doc.setFillColor(...BRAND.emerald);
    doc.roundedRect(14, finalY + 8, 270, 22, 2, 2, 'F');
    doc.setTextColor(...BRAND.cream);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Ready to register? Book a free 15-min consultation.', 20, finalY + 17);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text('+971 58 590 3155 · info@smartsetupuae.ae · www.smartsetupuae.ae', 20, finalY + 24);
  }

  // Footer + page numbers on every page
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.muted);
    doc.text(
      `Generated ${new Date().toLocaleString()} · www.smartsetupuae.ae · +971 58 590 3155`,
      14,
      205,
    );
    doc.text(`Page ${i} / ${total}`, 283, 205, { align: 'right' });
  }

  const slugs = selectedZones.map((z) => z.slug).join('-').slice(0, 60);
  const fname = `SmartSetupUAE_Comparison_${slugs}_${Date.now()}.pdf`;
  doc.save(fname);
  return fname;
}
