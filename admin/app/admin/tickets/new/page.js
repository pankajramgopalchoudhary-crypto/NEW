'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';

const CATEGORIES = ['general', 'visa', 'payment', 'technical', 'compliance', 'other'];
const PRIORITIES  = ['low', 'medium', 'high', 'urgent'];

export default function NewTicketPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '', email: '', subject: '', message: '',
    category: 'general', priority: 'medium',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name || !form.email || !form.subject || !form.message) {
      setError('All fields are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/admin/tickets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...form, source: 'manual' }),
      });
      const d = await r.json();
      if (d.ok) {
        router.push(`/admin/tickets/${d.ticket.ticketId}`);
      } else {
        setError(d.error || 'Failed to create ticket');
      }
    } catch (e) {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/tickets" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Create Ticket</h1>
          <p className="text-slate-500 text-sm">Open a support ticket manually</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name *</label>
            <input
              type="text" value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="Customer name"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email *</label>
            <input
              type="email" value={form.email} onChange={e => set('email', e.target.value)}
              placeholder="customer@email.com"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Subject *</label>
          <input
            type="text" value={form.subject} onChange={e => set('subject', e.target.value)}
            placeholder="Brief description of the issue"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Category</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 capitalize">
              {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Priority</label>
            <select value={form.priority} onChange={e => set('priority', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 capitalize">
              {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Message *</label>
          <textarea
            rows={5} value={form.message} onChange={e => set('message', e.target.value)}
            placeholder="Describe the issue in detail…"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Link href="/admin/tickets"
            className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 text-center">
            Cancel
          </Link>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 py-2.5 bg-[#0A3D34] text-white rounded-lg text-sm font-semibold hover:bg-[#062A24] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Create Ticket
          </button>
        </div>
      </div>
    </div>
  );
}
