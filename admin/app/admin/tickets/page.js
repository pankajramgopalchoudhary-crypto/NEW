'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Search, Plus, RefreshCw, Filter,
  Clock, CheckCircle, XCircle, AlertCircle, Circle,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

// ─── Config ──────────────────────────────────────────────────────────────────

const STATUSES = ['all', 'open', 'pending', 'resolved', 'closed'];
const PRIORITIES = ['all', 'low', 'medium', 'high', 'urgent'];
const CATEGORIES = ['all', 'general', 'visa', 'payment', 'technical', 'compliance', 'other'];

const STATUS_STYLES = {
  open:     'bg-blue-100 text-blue-700 border border-blue-200',
  pending:  'bg-amber-100 text-amber-700 border border-amber-200',
  resolved: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  closed:   'bg-slate-100 text-slate-500 border border-slate-200',
};

const PRIORITY_STYLES = {
  low:    'bg-slate-100 text-slate-500',
  medium: 'bg-blue-100 text-blue-600',
  high:   'bg-amber-100 text-amber-700',
  urgent: 'bg-rose-100 text-rose-700',
};

const STATUS_ICONS = {
  open:     <Circle className="w-3 h-3" />,
  pending:  <Clock className="w-3 h-3" />,
  resolved: <CheckCircle className="w-3 h-3" />,
  closed:   <XCircle className="w-3 h-3" />,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date) {
  const d = new Date(date);
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [status, setStatus]     = useState('all');
  const [priority, setPriority] = useState('all');
  const [category, setCategory] = useState('all');
  const [search, setSearch]     = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [stats, setStats] = useState({ open: 0, pending: 0, resolved: 0, closed: 0, total: 0 });

  const fetchStats = async () => {
    try {
      const r = await fetch('/api/admin/tickets/stats', { credentials: 'include' });
      const d = await r.json();
      setStats(d);
    } catch {}
  };

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 25 });
    if (status !== 'all') params.set('status', status);
    if (priority !== 'all') params.set('priority', priority);
    if (category !== 'all') params.set('category', category);
    if (search) params.set('search', search);

    try {
      const r = await fetch(`/api/admin/tickets?${params}`, { credentials: 'include' });
      const d = await r.json();
      setTickets(d.tickets || []);
      setTotal(d.total || 0);
      setPages(d.pages || 1);
    } catch {}
    setLoading(false);
  }, [page, status, priority, category, search]);

  useEffect(() => { fetchStats(); }, []);
  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Support Tickets</h1>
          <p className="text-slate-500 text-sm mt-0.5">{total} total tickets</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { fetchTickets(); fetchStats(); }}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <Link
            href="/admin/tickets/new"
            className="flex items-center gap-1.5 px-4 py-2 bg-[#0A3D34] text-white rounded-lg text-sm font-semibold hover:bg-[#062A24]"
          >
            <Plus className="w-4 h-4" /> New Ticket
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Open',     key: 'open',     color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-100' },
          { label: 'Pending',  key: 'pending',  color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100' },
          { label: 'Resolved', key: 'resolved', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Closed',   key: 'closed',   color: 'text-slate-500',   bg: 'bg-slate-50',   border: 'border-slate-100' },
          { label: 'Total',    key: 'total',    color: 'text-slate-700',   bg: 'bg-white',      border: 'border-slate-200' },
        ].map(({ label, key, color, bg, border }) => (
          <button
            key={key}
            onClick={() => { setStatus(key === 'total' ? 'all' : key); setPage(1); }}
            className={`${bg} border ${border} rounded-xl p-4 text-left hover:shadow-sm transition cursor-pointer`}
          >
            <div className={`text-2xl font-bold ${color}`}>{stats[key] ?? 0}</div>
            <div className="text-xs text-slate-500 mt-0.5 font-medium">{label}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-center">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search tickets…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button type="submit" className="px-3 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium">
            Search
          </button>
        </form>

        <div className="flex gap-2 flex-wrap">
          {/* Status */}
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500">
            {STATUSES.map(s => <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>

          {/* Priority */}
          <select value={priority} onChange={e => { setPriority(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500">
            {PRIORITIES.map(p => <option key={p} value={p}>{p === 'all' ? 'All Priorities' : p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>

          {/* Category */}
          <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500">
            {CATEGORIES.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading tickets…</div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No tickets found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Ticket', 'Subject', 'From', 'Status', 'Priority', 'Category', 'Updated'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map(t => (
                <tr key={t.ticketId} className="hover:bg-slate-50 cursor-pointer transition">
                  <td className="px-4 py-3">
                    <Link href={`/admin/tickets/${t.ticketId}`} className="font-mono text-xs text-[#0A3D34] font-semibold hover:underline">
                      {t.ticketId}
                    </Link>
                  </td>
                  <td className="px-4 py-3 max-w-[260px]">
                    <Link href={`/admin/tickets/${t.ticketId}`} className="text-slate-800 hover:text-[#0A3D34] font-medium truncate block">
                      {t.subject}
                    </Link>
                    <div className="text-xs text-slate-400 mt-0.5">{(t.messages?.length || 0)} messages</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-700 font-medium">{t.name}</div>
                    <div className="text-xs text-slate-400">{t.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[t.status] || 'bg-slate-100 text-slate-500'}`}>
                      {STATUS_ICONS[t.status]}
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium capitalize ${PRIORITY_STYLES[t.priority] || ''}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs capitalize text-slate-500">{t.category}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                    {timeAgo(t.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="border-t border-slate-200 px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">Page {page} of {pages}</span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
