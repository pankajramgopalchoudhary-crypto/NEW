/**
 * SelfieToPassport — Capture or upload a selfie, AI-converts it to a UAE
 * passport-ready photo (white background, shoulders-up, professional).
 *
 * Two modes:
 *   1. "Take selfie"     — uses the webcam
 *   2. "Upload photo"    — accepts an existing image
 *   3. "Skip / submit own" — emits onUseManualUpload (a fallback path)
 *
 * Props:
 *   onResult(base64Png)   — called with the AI-generated passport photo
 *   onUseManualUpload()   — user opts out of AI, will submit a photo themselves
 */
import React, { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Camera, Upload, Sparkles, RefreshCw, Check, X, Image as ImageIcon } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result.split(',')[1]);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

export default function SelfieToPassport({ onResult, onUseManualUpload }) {
  const { toast } = useToast();
  const [mode, setMode] = useState('choose'); // choose | camera | preview | result
  const [sourceImg, setSourceImg] = useState(null);   // base64
  const [resultImg, setResultImg] = useState(null);   // base64
  const [busy, setBusy] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Start webcam stream
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } },
      });
      streamRef.current = stream;
      setMode('camera');
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => null);
        }
      }, 50);
    } catch (err) {
      toast({ title: 'Camera not available', description: err.message || 'Allow camera permission or use Upload instead.', variant: 'destructive' });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => () => stopCamera(), []);

  // Capture frame from webcam → base64
  const snap = () => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL('image/jpeg', 0.92);
    stopCamera();
    setSourceImg(dataUrl.split(',')[1]);
    setMode('preview');
  };

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 8 MB.', variant: 'destructive' });
      return;
    }
    const b64 = await fileToBase64(file);
    setSourceImg(b64);
    setMode('preview');
  };

  const generate = async () => {
    if (!sourceImg) return;
    setBusy(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/photo/passportize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: sourceImg, mime_type: 'image/jpeg' }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Server ${res.status}`);
      }
      setResultImg(data.image_base64);
      setMode('result');
      toast({ title: 'Passport photo ready ✓', description: 'White background applied. You can download or use this photo.' });
    } catch (err) {
      toast({ title: 'AI photo studio failed', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const useThis = () => {
    if (resultImg && onResult) onResult(resultImg);
    toast({ title: 'Photo saved to your application' });
  };

  const download = () => {
    const a = document.createElement('a');
    a.href = `data:image/png;base64,${resultImg}`;
    a.download = 'passport-photo.png';
    a.click();
  };

  const reset = () => {
    stopCamera();
    setSourceImg(null);
    setResultImg(null);
    setMode('choose');
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6" data-testid="selfie-to-passport">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] font-bold brand-emerald">
            <Sparkles className="h-3.5 w-3.5" /> AI Photo Studio
          </div>
          <h3 className="mt-2 font-display text-xl font-semibold text-slate-900">Get a passport-ready photo in 10 seconds</h3>
          <p className="mt-1 text-sm text-slate-600 max-w-xl">
            Take a selfie or upload any photo. Our AI removes the background, applies pure white,
            re-frames to shoulders-up and adjusts lighting to meet UAE passport-photo rules.
            Prefer to submit your own photo? <button onClick={onUseManualUpload} className="brand-emerald font-semibold hover:underline">Skip — I&apos;ll upload my own</button>.
          </p>
        </div>
      </div>

      <div className="mt-6">
        {mode === 'choose' && (
          <div className="grid sm:grid-cols-2 gap-3" data-testid="selfie-choose">
            <button onClick={startCamera} className="rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 p-8 text-left hover:bg-emerald-50 hover:border-emerald-500 transition-colors" data-testid="selfie-take">
              <div className="h-12 w-12 rounded-xl bg-emerald-700 text-white grid place-items-center"><Camera className="h-6 w-6" /></div>
              <div className="mt-3 font-semibold text-slate-900">Take a selfie</div>
              <div className="mt-1 text-xs text-slate-600">Uses your webcam. No file saved.</div>
            </button>
            <label className="cursor-pointer rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/40 p-8 text-left hover:bg-amber-50 hover:border-amber-500 transition-colors block" data-testid="selfie-upload">
              <input type="file" accept="image/*" className="hidden" onChange={onPickFile} />
              <div className="h-12 w-12 rounded-xl bg-amber-600 text-white grid place-items-center"><Upload className="h-6 w-6" /></div>
              <div className="mt-3 font-semibold text-slate-900">Upload a photo</div>
              <div className="mt-1 text-xs text-slate-600">Any selfie or portrait. JPG/PNG, up to 8 MB.</div>
            </label>
          </div>
        )}

        {mode === 'camera' && (
          <div className="space-y-3" data-testid="selfie-camera">
            <video ref={videoRef} className="rounded-2xl w-full max-w-md mx-auto bg-black" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex gap-2 justify-center">
              <Button onClick={snap} className="btn-primary rounded-full px-5"><Camera className="h-4 w-4 mr-2" /> Snap</Button>
              <Button onClick={reset} variant="outline" className="rounded-full px-5"><X className="h-4 w-4 mr-2" /> Cancel</Button>
            </div>
          </div>
        )}

        {mode === 'preview' && (
          <div className="space-y-3" data-testid="selfie-preview">
            <div className="grid sm:grid-cols-2 gap-3 items-start">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Your selfie</div>
                <img src={`data:image/jpeg;base64,${sourceImg}`} alt="Selfie preview" className="mt-1 w-full rounded-xl border border-slate-200" />
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 text-sm text-slate-700">
                <div className="font-semibold text-slate-900">What AI will do</div>
                <ul className="mt-2 space-y-1.5 list-disc list-inside text-xs">
                  <li>Replace background with pure white</li>
                  <li>Re-frame to shoulders-up, face centered</li>
                  <li>Apply professional studio lighting</li>
                  <li>Keep your identity 100% intact</li>
                </ul>
                <p className="mt-3 text-xs text-slate-500">~ 15 seconds. Free for Founder Club members.</p>
              </div>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <Button onClick={generate} disabled={busy} className="btn-primary rounded-full px-6" data-testid="selfie-generate">
                {busy ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Generating…</> : <><Sparkles className="h-4 w-4 mr-2" /> Generate passport photo</>}
              </Button>
              <Button onClick={reset} variant="outline" className="rounded-full px-5"><X className="h-4 w-4 mr-2" /> Retake</Button>
            </div>
          </div>
        )}

        {mode === 'result' && resultImg && (
          <div className="space-y-3" data-testid="selfie-result">
            <div className="grid sm:grid-cols-2 gap-3 items-start">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Your original</div>
                <img src={`data:image/jpeg;base64,${sourceImg}`} alt="Original" className="mt-1 w-full rounded-xl border border-slate-200 opacity-80" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold brand-emerald">Passport-ready ✓</div>
                <img src={`data:image/png;base64,${resultImg}`} alt="Passport photo" className="mt-1 w-full rounded-xl border-2 border-emerald-500 shadow-lg bg-white" />
              </div>
            </div>
            <div className="flex gap-2 justify-center pt-2 flex-wrap">
              <Button onClick={useThis} className="btn-primary rounded-full px-6" data-testid="selfie-use"><Check className="h-4 w-4 mr-2" /> Use this photo</Button>
              <Button onClick={download} variant="outline" className="rounded-full px-5"><ImageIcon className="h-4 w-4 mr-2" /> Download</Button>
              <Button onClick={reset} variant="outline" className="rounded-full px-5"><RefreshCw className="h-4 w-4 mr-2" /> Try another</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
