/**
 * Document OCR uploader — supports passport/EID/visa/utility/license/MOA/tenancy.
 * On select → reads file as base64 → calls /api/ocr/parse → returns extracted fields.
 *
 * Props:
 *   docType  – one of the OCR types ('passport', 'emirates_id', ...)
 *   label    – button label
 *   onResult – ({ confidence, fields }) => void
 */
import React, { useState, useRef } from 'react';
import { Upload, ScanLine, AlertTriangle, CheckCircle2, Loader2, Camera, X } from 'lucide-react';
import { ocrApi } from '../lib/backendApi';

function readBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || '').split(',')[1] || '');
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });
}

export default function DocumentOCRUploader({
  docType = 'passport',
  label = 'Scan & Auto-fill',
  onResult,
  compact = false,
}) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [result, setResult] = useState(null);

  const handlePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(''); setWarning(''); setResult(null);
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('File too large (max 8 MB).');
      const mime = file.type || 'image/jpeg';
      if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(mime)) {
        throw new Error('Only JPG / PNG / WEBP / PDF supported.');
      }
      const b64 = await readBase64(file);
      const res = await ocrApi.parse(docType, b64, mime);
      setResult(res);
      if (res.warning) setWarning(res.warning);
      onResult?.(res);
    } catch (err) {
      setError(err.message || 'OCR failed');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'} data-testid={`ocr-uploader-${docType}`}>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 disabled:opacity-60 transition-colors"
          data-testid={`ocr-pick-${docType}`}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
          {busy ? 'Scanning…' : label}
        </button>
        <button
          type="button"
          onClick={() => {
            if (fileRef.current) {
              fileRef.current.setAttribute('capture', 'environment');
              fileRef.current.click();
            }
          }}
          disabled={busy}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-slate-300 text-sm font-semibold text-slate-700 hover:border-emerald-700/40 transition-colors"
          data-testid={`ocr-camera-${docType}`}
          aria-label="Take photo"
        >
          <Camera className="h-4 w-4" /> Camera
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={handlePick}
          data-testid={`ocr-input-${docType}`}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900" data-testid="ocr-error">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> <span>{error}</span>
        </div>
      )}

      {warning && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900" data-testid="ocr-warning">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">{warning}</div>
            {result?.confidence != null && (
              <div className="text-amber-800/80 mt-0.5">Confidence: {Math.round((result.confidence || 0) * 100)}%</div>
            )}
          </div>
          <button type="button" onClick={() => { setWarning(''); setResult(null); }} className="ml-auto text-amber-900/60 hover:text-amber-900"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {result?.ok && !error && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs" data-testid="ocr-success">
          <div className="flex items-center gap-2 text-emerald-900 font-semibold">
            <CheckCircle2 className="h-4 w-4" /> Auto-filled · {Math.round((result.confidence || 0) * 100)}% confidence
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-slate-700">
            {Object.entries(result.fields || {}).slice(0, 8).map(([k, v]) => v ? (
              <div key={k} className="truncate"><span className="text-slate-500 uppercase text-[10px] tracking-wider">{k.replace(/_/g, ' ')}:</span> <span className="font-medium">{String(v)}</span></div>
            ) : null)}
          </div>
        </div>
      )}
    </div>
  );
}
