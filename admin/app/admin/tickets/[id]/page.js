'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Send, Clock, CheckCircle, XCircle, Circle,
  User, Shield, StickyNote, ChevronDown, Loader2, Paperclip, X, Sparkles, Image as ImageIcon,
} from 'lucide-react';

// ─── Config ──────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['open', 'pending', 'resolved', 'closed'];
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];

const STATUS_STYLES = {
  open:     'bg-blue-100 text-blue-700',
  pending:  'bg-amber-100 text-amber-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  closed:   'bg-slate-100 text-slate-500',
};

const PRIORITY_STYLES = {
  low:    'text-slate-500',
  medium: 'text-blue-600',
  high:   'text-amber-600',
  urgent: 'text-rose-600',
};

const STATUS_ICONS = {
  open:     <Circle className="w-3.5 h-3.5" />,
  pending:  <Clock className="w-3.5 h-3.5" />,
  resolved: <CheckCircle className="w-3.5 h-3.5" />,
  closed:   <XCircle className="w-3.5 h-3.5" />,
};

function fmt(date) {
  return new Date(date).toLocaleString('en-AE', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtSize(n) {
  const b = Number(n || 0);
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

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
      <button onClick={open} data-testid={`attachment-${att.path}`}
        className="relative block rounded-xl overflow-hidden border border-slate-200 hover:border-emerald-500 transition-colors">
        {url ? (
          <img src={url} alt={att.name || 'attachment'} className="h-24 w-32 object-cover" />
        ) : (
          <div className="h-24 w-32 grid place-items-center bg-slate-100 text-slate-400"><ImageIcon className="w-4 h-4" /></div>
        )}
        <span className="absolute bottom-1 right-1 rounded-md bg-slate-900/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {fmtSize(att.size) || 'image'}
        </span>
      </button>
    );
  }

  return (
    <button onClick={open} data-testid={`attachment-${att.path}`}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-emerald-500 hover:text-emerald-700">
      <Paperclip className="w-3 h-3" /> {att.name || 'file'}
      {att.size ? <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-semibold text-slate-500">{fmtSize(att.size)}</span> : null}
    </button>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TicketDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [tab, setTab] = useState('reply'); // 'reply' | 'note'
  const [files, setFiles] = useState([]);
  const [attErr, setAttErr] = useState('');
  const [staffList, setStaffList] = useState([]);
  const bottomRef = useRef(null);

  const fetchTicket = async () => {
    try {
      const r = await fetch(`/api/admin/tickets/${id}`, { credentials: 'include' });
      if (!r.ok) { router.push('/admin/tickets'); return; }
      const d = await r.json();
      setTicket(d.ticket);
    } catch {
      router.push('/admin/tickets');
    }
    setLoading(false);
  };

  const fetchStaff = async () => {
    try {
      const r = await fetch('/api/admin/staff', { credentials: 'include' });
      const d = await r.json();
      setStaffList(d.staff || []);
    } catch {}
  };

  useEffect(() => {
    fetchTicket();
    fetchStaff();
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages]);

  const signAttachment = async (objPath) => {
    try {
      const r = await fetch(`/api/admin/tickets/${id}/attachments/sign-download`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ path: objPath }),
      });
      const d = await r.json();
      return d.signed_url || '';
    } catch { return ''; }
  };

  const uploadOne = async (file) => {
    const signRes = await fetch(`/api/admin/tickets/${id}/attachments/sign-upload`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ filename: file.name, content_type: file.type || 'application/octet-stream', size: file.size }),
    });
    const sign = await signRes.json();
    if (!signRes.ok) throw new Error(sign.error || 'Upload rejected');
    const put = await fetch(sign.upload_url, {
      method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file,
    });
    if (!put.ok) throw new Error('File upload failed');
    return { path: sign.path, name: file.name, content_type: sign.content_type, size: file.size };
  };

  const useAiDraft = () => {
    if (ticket?.ai_suggestion) { setTab('reply'); setReply(ticket.ai_suggestion); }
  };

  const sendReply = async () => {
    if (!reply.trim() && files.length === 0) return;
    setSending(true); setAttErr('');
    try {
      const attachments = [];
      for (const f of files) {
        // eslint-disable-next-line no-await-in-loop
        attachments.push(await uploadOne(f));
      }
      await fetch(`/api/admin/tickets/${id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: reply || '(attachment)', sender: 'admin', attachments }),
      });
      setReply(''); setFiles([]);
      await fetchTicket();
    } catch (e) { setAttErr(String(e.message || e)); }
    setSending(false);
  };

  const sendNote = async () => {
    if (!note.trim()) return;
    setAddingNote(true);
    try {
      await fetch(`/api/admin/tickets/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ note }),
      });
      setNote('');
      await fetchTicket();
    } catch {}
    setAddingNote(false);
  };

  const changeStatus = async (status) => {
    await fetch(`/api/admin/tickets/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    await fetchTicket();
  };

  const assignTo = async (assignedTo) => {
    await fetch(`/api/admin/tickets/${id}/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ assignedTo }),
    });
    await fetchTicket();
  };

  if (loading) return (
    <div className="p-8 flex items-center gap-2 text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin" /> Loading ticket…
    </div>
  );

  if (!ticket) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <Link href="/admin/tickets" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-[#0A3D34] font-bold">{ticket.ticketId}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[ticket.status]}`}>
              {STATUS_ICONS[ticket.status]} {ticket.status}
            </span>
            <span className={`text-xs font-medium capitalize ${PRIORITY_STYLES[ticket.priority]}`}>
              ● {ticket.priority}
            </span>
          </div>
          <h1 className="text-base font-semibold text-slate-800 truncate mt-0.5">{ticket.subject}</h1>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 gap-0">
        {/* Thread */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {ticket.messages?.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.sender === 'admin' ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold
                  ${msg.sender === 'admin' ? 'bg-[#0A3D34] text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {msg.sender === 'admin' ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                {/* Bubble */}
                <div className={`max-w-[75%] ${msg.sender === 'admin' ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap
                    ${msg.sender === 'admin'
                      ? 'bg-[#0A3D34] text-white rounded-tr-sm'
                      : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm'
                    }`}>
                    {msg.message}
                  </div>
                  {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                    <div className={`mt-1.5 flex flex-wrap items-end gap-1.5 ${msg.sender === 'admin' ? 'justify-end' : ''}`}>
                      {msg.attachments.map((a, k) => (
                        <AttachmentChip key={k} att={a} sign={signAttachment} />
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-slate-400 mt-1 px-1">
                    {msg.sender === 'admin' ? 'Support Agent' : ticket.name} · {fmt(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))}

            {/* Internal notes */}
            {ticket.internalNotes?.length > 0 && (
              <div className="border-t border-amber-200 pt-4">
                <div className="flex items-center gap-1.5 text-xs text-amber-600 font-semibold mb-3">
                  <StickyNote className="w-3.5 h-3.5" /> Internal Notes (admin only)
                </div>
                {ticket.internalNotes.map((n, i) => (
                  <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-2">
                    <p className="text-sm text-amber-800 whitespace-pre-wrap">{n.note}</p>
                    <p className="text-xs text-amber-500 mt-1.5">{n.adminName || 'Admin'} · {fmt(n.timestamp)}</p>
                  </div>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Reply box */}
          <div className="border-t border-slate-200 bg-white p-4">
            {/* Tabs */}
            <div className="flex gap-1 mb-3">
              <button
                onClick={() => setTab('reply')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${tab === 'reply' ? 'bg-[#0A3D34] text-white' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                Reply to Customer
              </button>
              <button
                onClick={() => setTab('note')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition flex items-center gap-1 ${tab === 'note' ? 'bg-amber-500 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                <StickyNote className="w-3 h-3" /> Internal Note
              </button>
            </div>

            {tab === 'reply' ? (
              <div>
                {ticket.ai_suggestion && (
                  <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                    <div className="flex items-center gap-1.5 text-xs text-amber-800">
                      <Sparkles className="w-3.5 h-3.5" />
                      AI draft ready{ticket.ai_confidence != null ? ` · ${Math.round(ticket.ai_confidence * 100)}% confidence` : ''}
                    </div>
                    <button
                      onClick={useAiDraft}
                      data-testid="use-ai-draft"
                      className="px-3 py-1 rounded-md bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" /> Generate AI reply
                    </button>
                  </div>
                )}
                <div className="flex gap-3">
                  <textarea
                    rows={3}
                    placeholder="Type your reply… (customer will receive an email)"
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply(); }}
                    className="flex-1 resize-none border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    onClick={sendReply}
                    disabled={(!reply.trim() && files.length === 0) || sending}
                    className="self-end px-4 py-3 bg-[#0A3D34] text-white rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center gap-2"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Send
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-3 flex-wrap">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-500 hover:text-emerald-700">
                    <Paperclip className="w-3.5 h-3.5" /> Attach file
                    <input type="file" multiple className="hidden"
                      onChange={e => { setFiles([...files, ...Array.from(e.target.files || [])]); e.target.value = ''; }} />
                  </label>
                  {files.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 border border-slate-200 px-2 py-1 text-[11px] text-slate-700">
                      {f.name}
                      <span className="text-[10px] font-semibold text-slate-500">{fmtSize(f.size)}</span>
                      <button onClick={() => setFiles(files.filter((_, k) => k !== i))} className="text-slate-400 hover:text-rose-600"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                  {attErr && <span className="text-[11px] text-rose-600">{attErr}</span>}
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <textarea
                  rows={3}
                  placeholder="Add a private note for your team (not visible to customer)…"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="flex-1 resize-none border border-amber-200 bg-amber-50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  onClick={sendNote}
                  disabled={!note.trim() || addingNote}
                  className="self-end px-4 py-3 bg-amber-500 text-white rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {addingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <StickyNote className="w-4 h-4" />}
                  Add Note
                </button>
              </div>
            )}
            <p className="text-xs text-slate-400 mt-2">Ctrl+Enter to send reply</p>
          </div>
        </div>

        {/* Right sidebar */}
        <aside className="w-72 shrink-0 border-l border-slate-200 bg-white overflow-y-auto p-5 space-y-6">

          {/* Customer */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Customer</h3>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">
                {(ticket.name || '?')[0].toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-slate-800 text-sm">{ticket.name}</div>
                <div className="text-xs text-slate-400">{ticket.email}</div>
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-2 space-y-1">
              <div><span className="text-slate-400">Category:</span> <span className="capitalize">{ticket.category}</span></div>
              <div><span className="text-slate-400">Source:</span> <span className="capitalize">{ticket.source}</span></div>
              <div><span className="text-slate-400">Created:</span> {fmt(ticket.createdAt)}</div>
              {ticket.resolvedAt && <div><span className="text-slate-400">Resolved:</span> {fmt(ticket.resolvedAt)}</div>}
            </div>
          </section>

          {/* Status */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Status</h3>
            <div className="relative">
              <select
                value={ticket.status}
                onChange={e => changeStatus(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500 capitalize"
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </section>

          {/* Priority */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Priority</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {PRIORITY_OPTIONS.map(p => (
                <button
                  key={p}
                  onClick={async () => {
                    await fetch(`/api/admin/tickets/${id}/status`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ priority: p }),
                    });
                    fetchTicket();
                  }}
                  className={`px-2 py-1.5 rounded-md text-xs font-medium capitalize border transition
                    ${ticket.priority === p
                      ? 'bg-[#0A3D34] text-white border-[#0A3D34]'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </section>

          {/* Assign */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Assigned To</h3>
            <div className="relative">
              <select
                value={ticket.assignedTo || ''}
                onChange={e => assignTo(e.target.value || null)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Unassigned</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </section>

          {/* Quick actions */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Actions</h3>
            <div className="space-y-1.5">
              <button onClick={() => changeStatus('resolved')}
                className="w-full py-2 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200">
                ✓ Mark Resolved
              </button>
              <button onClick={() => changeStatus('closed')}
                className="w-full py-2 text-xs font-semibold rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200">
                ✕ Close Ticket
              </button>
              <button onClick={() => changeStatus('open')}
                className="w-full py-2 text-xs font-semibold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200">
                ↺ Reopen
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
