'use client';
import { useEffect, useState } from 'react';
import { FileText, Download } from 'lucide-react';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/invoices', { credentials: 'include' }).then(r => r.json()).then(d => { setInvoices(d.invoices || []); setLoading(false); });
  }, []);

  const filtered = invoices.filter(i => {
    const s = search.toLowerCase();
    return !s || (i.client_name || '').toLowerCase().includes(s) || (i.invoice_ref || '').toLowerCase().includes(s) || (i.client_email || '').toLowerCase().includes(s);
  });

  const downloadInvoice = (inv) => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${inv.invoice_ref}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: 'Poppins', Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 24px; }
  .hdr { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0A3D34; padding-bottom: 18px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand-text { font-weight: 800; font-size: 22px; letter-spacing: 0.02em; }
  .brand-text .gold { color: #D4AF37; }
  .brand-text .green { color: #0A3D34; }
  .tagline { font-size: 9px; letter-spacing: 0.3em; color: #0A3D34; font-weight: 500; margin-top: 4px; }
  .right { text-align: right; }
  .right h1 { margin: 0; font-size: 28px; color: #0A3D34; }
  .right .ref { font-family: monospace; color: #D4AF37; font-weight: 700; font-size: 14px; margin-top: 4px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; font-size: 12px; }
  .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; font-weight: 700; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 18px; }
  th { background: #0A3D34; color: #fff; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
  td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
  .total-row td { background: #fdf6e3; font-weight: 700; font-size: 16px; color: #0A3D34; border-top: 2px solid #D4AF37; }
  .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b; text-align: center; }
  .status { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  .status.paid { background: #dcfce7; color: #166534; }
  .status.pending { background: #fef3c7; color: #92400e; }
  .svg-logo { width: 56px; height: 56px; }
  @media print { .no-print { display: none; } body { padding: 0; } }
  .no-print { text-align: center; margin-bottom: 20px; }
  .no-print button { background: #0A3D34; color: white; border: 0; padding: 10px 24px; font-size: 14px; border-radius: 8px; cursor: pointer; font-weight: 600; }
</style></head><body>
<div class="no-print"><button onclick="window.print()">🖨️ Print / Save as PDF</button></div>
<div class="hdr">
  <div class="brand">
    <svg class="svg-logo" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
      <g fill="#0A3D34" opacity="0.95">
        <rect x="30" y="68" width="4" height="22"/><rect x="35" y="58" width="3" height="32"/>
        <polygon points="40,30 43,30 44,62 39,62"/><polygon points="41.5,18 41.5,30 43,30"/>
        <rect x="45" y="52" width="3" height="38"/><rect x="49" y="60" width="4" height="30"/><rect x="54" y="55" width="3" height="35"/>
      </g>
      <path d="M14 92 Q 50 78 96 76 L 102 72 L 96 86 Q 56 92 14 96 Z" fill="#D4AF37"/>
      <path d="M82 28 C 82 22 76 18 68 18 L 50 18 C 42 18 36 24 36 32 C 36 40 42 44 50 46 L 66 50 C 74 52 80 56 80 64 C 80 72 74 78 66 78 L 48 78 C 40 78 34 74 34 68" stroke="#0A3D34" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>
    <div>
      <div class="brand-text"><span class="green">SMARTSETUP</span><span class="gold">UAE</span></div>
      <div class="tagline">SETUP SMART. GROW FAST.</div>
      <div style="font-size:10px;color:#64748b;margin-top:6px">Axiscrest Global FZE LLC · TRN: 100000000000003</div>
    </div>
  </div>
  <div class="right">
    <h1>TAX INVOICE</h1>
    <div class="ref">${inv.invoice_ref}</div>
    <div style="font-size:10px;color:#64748b;margin-top:6px">Date: ${new Date(inv.date).toLocaleDateString('en-GB')}</div>
    <div style="margin-top:8px"><span class="status ${inv.status === 'paid' ? 'paid' : 'pending'}">${inv.status || 'pending'}</span></div>
  </div>
</div>
<div class="meta">
  <div><div class="label">Billed To</div><div style="font-weight:600">${inv.client_name || ''}</div><div>${inv.client_email || ''}</div></div>
  <div><div class="label">Service Details</div><div style="font-weight:600">UAE Business Setup · ${inv.zone || ''}</div><div>${inv.booking_type || ''}</div></div>
</div>
<table>
  <thead><tr><th>Description</th><th style="text-align:right">Amount (AED)</th></tr></thead>
  <tbody>
    <tr><td>UAE Business Setup — ${inv.zone || ''} Free Zone<br/><span style="color:#64748b;font-size:11px">${inv.booking_type || ''}</span></td><td style="text-align:right">${(Number(inv.amount) / 1.05).toFixed(2)}</td></tr>
    <tr><td>VAT 5%</td><td style="text-align:right">${(Number(inv.amount) - Number(inv.amount) / 1.05).toFixed(2)}</td></tr>
    <tr class="total-row"><td>TOTAL</td><td style="text-align:right">AED ${Number(inv.amount).toLocaleString()}</td></tr>
  </tbody>
</table>
<div class="footer">
  Thank you for choosing SmartSetupUAE.ae · admin@smartsetupuae.ae · +971 56 303 5503<br/>
  Axiscrest Global FZE LLC · Lic: 262843696888 · Dubai, United Arab Emirates
</div>
</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) {
      const a = document.createElement('a');
      a.href = url;
      a.download = `${inv.invoice_ref}.html`;
      a.click();
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="mb-5">
        <div className="text-2xl font-bold text-slate-900">Invoices</div>
        <div className="text-sm text-slate-500">{filtered.length} invoices generated from orders</div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-3 mb-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by client, email, or ref…" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
            <tr><th className="text-left px-4 py-2.5">Invoice Ref</th><th className="text-left px-4 py-2.5">Client</th><th className="text-left px-4 py-2.5">Zone</th><th className="text-left px-4 py-2.5">Type</th><th className="text-left px-4 py-2.5">Amount</th><th className="text-left px-4 py-2.5">Date</th><th className="text-left px-4 py-2.5">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={7} className="text-center py-8 text-slate-400">Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate-400">No invoices yet</td></tr>}
            {filtered.map(i => (
              <tr key={i.order_id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-mono text-xs text-emerald-700 font-semibold">{i.invoice_ref}</td>
                <td className="px-4 py-2.5"><div className="font-semibold">{i.client_name}</div><div className="text-xs text-slate-500">{i.client_email}</div></td>
                <td className="px-4 py-2.5">{i.zone}</td>
                <td className="px-4 py-2.5 text-xs">{i.booking_type}</td>
                <td className="px-4 py-2.5 font-bold">AED {Number(i.amount).toLocaleString()}</td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{new Date(i.date).toLocaleDateString()}</td>
                <td className="px-4 py-2.5">
                  <button onClick={() => downloadInvoice(i)} className="text-emerald-700 text-xs font-semibold inline-flex items-center gap-1 hover:underline"><FileText className="w-3 h-3" /> Invoice</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
