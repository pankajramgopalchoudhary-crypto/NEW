// Payment proof upload widget — used on Checkout page after order is reserved.
// Uploads file directly to Supabase Storage `payment-proofs` bucket and inserts
// a row into `payment_proofs` table for admin review.
import React, { useState } from 'react';
import { Upload, CheckCircle2, AlertCircle, Loader2, FileText } from 'lucide-react';

const BUCKET = 'payment-proofs';

export default function PaymentProofUpload({ orderRef, customer, amount, onUploaded }) {
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const upload = async () => {
    if (!file) { setError('Please choose a file first.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('File too large — max 10 MB.'); return; }
    setUploading(true); setError('');

    const supaUrl = process.env.REACT_APP_SUPABASE_URL;
    const supaKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const safeRef = (orderRef || `guest-${Date.now()}`).replace(/[^a-z0-9-]/gi, '');
    const objectPath = `${safeRef}/${Date.now()}.${ext}`;

    try {
      // 1. Upload file to Storage
      const upResp = await fetch(`${supaUrl}/storage/v1/object/${BUCKET}/${objectPath}`, {
        method: 'POST',
        headers: {
          apikey: supaKey,
          Authorization: `Bearer ${supaKey}`,
          'Content-Type': file.type || 'application/octet-stream',
          'x-upsert': 'true',
        },
        body: file,
      });
      if (!upResp.ok) {
        const txt = await upResp.text();
        throw new Error(`Upload failed: ${txt.slice(0, 200)}`);
      }

      // 2. Insert metadata row
      const metaResp = await fetch(`${supaUrl}/rest/v1/payment_proofs`, {
        method: 'POST',
        headers: {
          apikey: supaKey,
          Authorization: `Bearer ${supaKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          order_ref: orderRef || null,
          customer_email: customer?.email || null,
          customer_name: customer?.name || null,
          customer_phone: customer?.phone || null,
          amount_aed: amount || null,
          file_path: objectPath,
          file_name: file.name,
          file_size_bytes: file.size,
          mime_type: file.type,
          notes: notes || null,
          status: 'pending_review',
        }),
      });
      if (!metaResp.ok) {
        const txt = await metaResp.text();
        throw new Error(`Metadata save failed: ${txt.slice(0, 200)}`);
      }
      const [row] = await metaResp.json();
      setDone(true);
      onUploaded?.(row);
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-700/30 bg-emerald-50 p-5" data-testid="payment-proof-success">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-emerald-900">Payment proof received</div>
            <div className="text-sm text-emerald-800 mt-1">Our finance team will verify and confirm within 30 minutes. You will receive a WhatsApp + email confirmation as soon as it&apos;s approved.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-5 hover:border-emerald-700/40 transition-colors" data-testid="payment-proof-upload">
      <div className="flex items-center gap-2 mb-2">
        <Upload className="h-4 w-4 text-emerald-700" />
        <div className="font-semibold text-slate-900 text-sm">Upload payment proof</div>
      </div>
      <p className="text-xs text-slate-500 mb-3">Bank transfer slip, screenshot, or PDF. Admin verifies in 30 min. PDF / JPG / PNG · max 10 MB.</p>

      <label className="block">
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => { setFile(e.target.files?.[0] || null); setError(''); }}
          disabled={uploading}
          className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-800 hover:file:bg-emerald-100 cursor-pointer"
          data-testid="payment-proof-file"
        />
      </label>

      {file && (
        <div className="mt-3 text-xs text-slate-600 flex items-center gap-2">
          <FileText className="h-3.5 w-3.5" />
          <span>{file.name} · {(file.size / 1024).toFixed(1)} KB</span>
        </div>
      )}

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional) — transaction reference, sender bank, etc."
        rows={2}
        className="mt-3 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-emerald-700"
      />

      {error && (
        <div className="mt-2 text-xs text-rose-600 flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </div>
      )}

      <button
        onClick={upload}
        disabled={!file || uploading}
        className="mt-3 w-full h-11 rounded-xl bg-emerald-700 text-white font-semibold disabled:opacity-50 hover:bg-emerald-800 transition-colors inline-flex items-center justify-center gap-2"
        data-testid="payment-proof-submit"
      >
        {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : <><Upload className="h-4 w-4" /> Send payment proof</>}
      </button>
    </div>
  );
}
