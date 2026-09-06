import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Send, Plus, LifeBuoy, Clock, CheckCircle2, ChevronLeft, AlertTriangle, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/support`;

async function authHeaders() {
  try {
    if (!supabase) return {};
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
}

function StatusPill({ status }) {
  const tones = {
    open: 'bg-amber-100 text-amber-800 border-amber-200',
    in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
    pending: 'bg-slate-100 text-slate-700 border-slate-200',
    resolved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    closed: 'bg-slate-200 text-slate-700 border-slate-300',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider border ${tones[status] || tones.open}`}>
      {status?.replace('_', ' ')}
    </span>
  );
}

function TicketList({ tickets, onOpen }) {
  if (!tickets?.length) {
    return (
      <div className="text-center py-14 text-slate-500 border border-dashed rounded-2xl" data-testid="support-empty">
        No tickets yet. Create one to get started.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white overflow-hidden" data-testid="support-ticket-list">
      {tickets.map((t) => (
        <li key={t.id}>
          <button
            onClick={() => onOpen(t.id)}
            className="w-full text-left px-5 py-4 hover:bg-slate-50 focus:outline-none focus:bg-slate-50 transition-colors"
            data-testid={`support-ticket-${t.id}`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-500">{t.ticket_number || t.reference}</span>
                  <StatusPill status={t.status} />
                </div>
                <div className="mt-1 font-semibold text-slate-900 truncate">{t.subject}</div>
                <div className="mt-1 text-[12px] text-slate-500 flex items-center gap-3">
                  <Clock className="h-3 w-3" />
                  {t.created_at ? new Date(t.created_at).toLocaleString() : '—'}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] uppercase tracking-wider">
                    {t.priority || 'medium'}
                  </span>
                </div>
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function NewTicket({ onCreated }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('medium');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!subject.trim() || !message.trim()) return;
    setBusy(true); setErr('');
    try {
      const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
      const r = await fetch(`${API}/tickets`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ subject, message, category, priority, channel: 'web' }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || 'Ticket creation failed');
      onCreated(j.ticket.id);
    } catch (e) {
      setErr(String(e.message || e));
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3" data-testid="support-new-ticket">
      <h3 className="font-display font-semibold text-lg text-slate-900">Open a new ticket</h3>
      <Input
        placeholder="Subject — one line summary"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        data-testid="new-ticket-subject"
        className="rounded-lg"
      />
      <div className="grid grid-cols-2 gap-3">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger data-testid="new-ticket-category" className="rounded-lg"><SelectValue /></SelectTrigger>
          <SelectContent>
            {['general','technical','account','payment','visa','compliance','sales','foundersclub','other'].map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger data-testid="new-ticket-priority" className="rounded-lg"><SelectValue /></SelectTrigger>
          <SelectContent>
            {['low','medium','high','urgent'].map(p => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      <Textarea
        rows={5}
        placeholder="Describe what you need help with…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        data-testid="new-ticket-message"
        className="rounded-lg"
      />
      {err && (
        <div className="text-[12px] text-rose-600 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" /> {err}
        </div>
      )}
      <Button
        onClick={submit}
        disabled={busy || !subject.trim() || !message.trim()}
        className="btn-primary rounded-full inline-flex items-center gap-2"
        data-testid="new-ticket-submit"
      >
        <Send className="h-4 w-4" /> {busy ? 'Creating…' : 'Send ticket'}
      </Button>
    </div>
  );
}

function fmtSize(n) {
  const b = Number(n || 0);
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

// Image attachments render as a thumbnail (signed URL, 1h TTL); everything else
// gets a file chip. Both show a size badge.
function AttachmentChip({ att, sign }) {
  const [url, setUrl] = useState('');
  const isImage = String(att.content_type || '').startsWith('image/')
    || /\.(png|jpe?g|webp|gif)$/i.test(att.name || att.path || '');

  useEffect(() => {
    let dead = false;
    if (!isImage) return undefined;
    sign(att.path).then((u) => { if (!dead && u) setUrl(u); });
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [att.path, isImage]);

  const open = async () => {
    const u = url || (await sign(att.path));
    if (u) window.open(u, '_blank', 'noopener');
  };

  if (isImage) {
    return (
      <button onClick={open} className="group relative block rounded-xl overflow-hidden border border-slate-200 hover:border-emerald-500 transition-colors"
              data-testid={`attachment-${att.path}`}>
        {url ? (
          <img src={url} alt={att.name || 'attachment'} className="h-24 w-32 object-cover" />
        ) : (
          <div className="h-24 w-32 grid place-items-center bg-slate-100 text-slate-400"><ImageIcon className="h-5 w-5" /></div>
        )}
        <span className="absolute bottom-1 right-1 rounded-md bg-slate-900/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {fmtSize(att.size) || 'image'}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={open}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-slate-700 hover:border-emerald-500 hover:text-emerald-700 transition-colors"
      data-testid={`attachment-${att.path}`}
    >
      <FileText className="h-3.5 w-3.5" /> {att.name || 'file'}
      {att.size ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{fmtSize(att.size)}</span> : null}
    </button>
  );
}

function TicketThread({ id, onBack }) {
  const [ticket, setTicket] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploadErr, setUploadErr] = useState('');
  const scrollRef = useRef(null);

  const load = useCallback(async () => {
    const headers = await authHeaders();
    const r = await fetch(`${API}/tickets/${id}`, { headers });
    if (!r.ok) return;
    const j = await r.json();
    setTicket(j.ticket);
    setMsgs(j.messages || []);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 30);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Subscribe to Supabase Broadcast channel (backend broadcasts on every mutation).
  useEffect(() => {
    if (!id || !supabase?.channel) return;
    const channel = supabase
      .channel(`ticket:${id}`)
      .on('broadcast', { event: '*' }, () => { load(); })
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch { /* noop */ } };
  }, [id, load]);

  const signAttachment = useCallback(async (path) => {
    try {
      const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
      const r = await fetch(`${API}/tickets/${id}/attachments/sign-download`, {
        method: 'POST', headers, body: JSON.stringify({ path }),
      });
      const j = await r.json();
      return j.signed_url || '';
    } catch { return ''; }
  }, [id]);

  const uploadOne = async (file) => {
    const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
    const signRes = await fetch(`${API}/tickets/${id}/attachments/sign-upload`, {
      method: 'POST', headers,
      body: JSON.stringify({ filename: file.name, content_type: file.type || 'application/octet-stream', size: file.size }),
    });
    const sign = await signRes.json();
    if (!signRes.ok) throw new Error(sign.detail || 'Upload rejected');
    const put = await fetch(sign.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    if (!put.ok) throw new Error('File upload failed');
    return { path: sign.path, name: file.name, content_type: sign.content_type, size: file.size };
  };

  const send = async () => {
    if (!reply.trim() && files.length === 0) return;
    setBusy(true); setUploadErr('');
    try {
      let attachments = [];
      for (const f of files) {
        // eslint-disable-next-line no-await-in-loop
        attachments.push(await uploadOne(f));
      }
      const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
      const r = await fetch(`${API}/tickets/${id}/messages`, {
        method: 'POST', headers, body: JSON.stringify({ body: reply || '(attachment)', attachments }),
      });
      if (r.ok) { setReply(''); setFiles([]); load(); }
    } catch (e) {
      setUploadErr(String(e.message || e));
    } finally { setBusy(false); }
  };

  if (!ticket) return <div className="py-10 text-center text-slate-400">Loading…</div>;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden" data-testid="support-thread">
      <div className="p-5 border-b border-slate-100 flex items-start gap-3">
        <button onClick={onBack} className="text-slate-500 hover:text-slate-900" data-testid="thread-back">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-500">{ticket.ticket_number || ticket.reference}</span>
            <StatusPill status={ticket.status} />
          </div>
          <h2 className="mt-1 font-display font-semibold text-lg text-slate-900 truncate">{ticket.subject}</h2>
        </div>
      </div>
      <div ref={scrollRef} className="max-h-[420px] overflow-y-auto p-5 space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={`p-3 rounded-xl text-[13px] leading-relaxed ${m.from_role === 'customer' ? 'bg-slate-50 border border-slate-200' : 'bg-emerald-50 border border-emerald-100'}`}>
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-slate-500 mb-1">
              {m.from_role === 'customer' ? 'You' : (m.from_role === 'aria' ? 'Aria (AI)' : 'Support')} · {m.created_at ? new Date(m.created_at).toLocaleString() : ''}
            </div>
            <div className="whitespace-pre-wrap text-slate-800">{m.body}</div>
            {Array.isArray(m.attachments) && m.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap items-end gap-2" data-testid="msg-attachments">
                {m.attachments.map((a, k) => (
                  <AttachmentChip key={k} att={a} sign={signAttachment} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {ticket.status !== 'closed' && (
        <div className="border-t border-slate-100 p-4">
          <Textarea
            rows={3}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Reply…"
            className="rounded-lg"
            data-testid="thread-reply"
          />
          {files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2" data-testid="thread-selected-files">
              {files.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 border border-slate-200 px-2 py-1 text-[11.5px] text-slate-700">
                  <FileText className="h-3.5 w-3.5" /> {f.name}
                  <span className="text-[10px] text-slate-500 font-semibold">{fmtSize(f.size)}</span>
                  <button onClick={() => setFiles(files.filter((_, k) => k !== i))} className="text-slate-400 hover:text-rose-600" data-testid={`remove-file-${i}`}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {uploadErr && <div className="mt-2 text-[12px] text-rose-600 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> {uploadErr}</div>}
          <div className="mt-2 flex items-center justify-between">
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-[12.5px] font-medium text-slate-600 hover:text-emerald-700" data-testid="thread-attach-label">
              <Paperclip className="h-4 w-4" /> Attach file
              <input
                type="file"
                multiple
                className="hidden"
                data-testid="thread-attach-input"
                onChange={(e) => { setFiles([...files, ...Array.from(e.target.files || [])]); e.target.value = ''; }}
              />
            </label>
            <Button
              onClick={send}
              disabled={busy || (!reply.trim() && files.length === 0)}
              className="btn-primary rounded-full inline-flex items-center gap-2"
              data-testid="thread-send"
            >
              <Send className="h-4 w-4" /> {busy ? 'Sending…' : 'Send reply'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SupportPortal() {
  const { user } = useAuth() || {};
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    if (!user?.email) return;
    try {
      const headers = await authHeaders();
      const r = await fetch(`${API}/tickets`, { headers });
      if (!r.ok) return;
      const j = await r.json();
      setTickets(j.items || j.tickets || j || []);
    } catch (e) {
      console.warn('[support] list failed', e);
    }
  }, [user?.email]);

  useEffect(() => { load(); }, [load]);

  return (
    <div data-testid="support-portal">
      <Navbar />
      <section className="hero-gradient grain">
        <div className="max-w-[1200px] mx-auto px-5 lg:px-8 py-8 flex items-start gap-3">
          <LifeBuoy className="h-8 w-8 brand-emerald mt-1" />
          <div className="flex-1">
            <h1 className="font-display font-semibold text-slate-900" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)' }}>Support Portal</h1>
            <p className="text-slate-600 mt-1">Get help from our team — first-response SLA depends on your ticket priority.</p>
          </div>
          {!ticketId && (
            <Button onClick={() => setShowNew((v) => !v)} className="btn-primary rounded-full inline-flex items-center gap-2" data-testid="support-new-btn">
              <Plus className="h-4 w-4" /> New ticket
            </Button>
          )}
        </div>
      </section>

      <section className="py-8 bg-[#FFFCF5] min-h-[60vh]">
        <div className="max-w-[900px] mx-auto px-5 lg:px-8 space-y-5">
          {!user?.email && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 p-4 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <div>
                Please <Link to="/login" className="underline font-semibold">sign in</Link> to view and reply to your tickets.
              </div>
            </div>
          )}

          {ticketId ? (
            <TicketThread id={ticketId} onBack={() => navigate('/dashboard/support')} />
          ) : (
            <>
              {showNew && (
                <NewTicket onCreated={(newId) => { setShowNew(false); load(); navigate(`/dashboard/support/${newId}`); }} />
              )}
              <TicketList tickets={tickets} onOpen={(id) => navigate(`/dashboard/support/${id}`)} />
            </>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
