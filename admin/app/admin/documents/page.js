'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Eye, AlertCircle } from 'lucide-react';

export default function DocumentsPage() {
  const [docs, setDocs] = useState([]);
  const [counts, setCounts] = useState({});
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchDocs = async (s = filter) => {
    setLoading(true);
    const url = s === 'all' ? '/api/admin/documents' : `/api/admin/documents?status=${s}`;
    const r = await fetch(url, { credentials: 'include' });
    const d = await r.json();
    setDocs(d.documents || []);
    setCounts(d.counts || {});
    setLoading(false);
  };

  useEffect(() => { fetchDocs('all'); }, []);

  const review = async (id, status, reason = '') => {
    await fetch(`/api/admin/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status, ...(reason ? { rejection_reason: reason } : {}) }),
    });
    setReviewing(null);
    setRejectReason('');
    fetchDocs(filter);
  };

  const STATUS_COLOR = {
    pending: 'bg-amber-100 text-amber-700',
    in_review: 'bg-blue-100 text-blue-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-rose-100 text-rose-700',
    resubmit_req: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="mb-5">
        <div className="text-2xl font-bold text-slate-900">Document Verification</div>
        <div className="text-sm text-slate-500">Review incoming KYC documents for UAE business setup clients</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { key: 'pending', label: 'Pending Review', color: 'bg-amber-500' },
          { key: 'in_review', label: 'In Review', color: 'bg-blue-500' },
          { key: 'approved', label: 'Approved', color: 'bg-emerald-500' },
          { key: 'rejected', label: 'Rejected', color: 'bg-rose-500' },
        ].map(s => (
          <div key={s.key} className="bg-white border border-slate-200 rounded-xl p-4 relative overflow-hidden cursor-pointer" onClick={() => { setFilter(s.key); fetchDocs(s.key); }}>
            <div className={`absolute top-0 left-0 w-1 h-full ${s.color}`} />
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold pl-2">{s.label}</div>
            <div className="text-3xl font-bold pl-2 mt-1">{counts[s.key] || 0}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-3">
        {['all', 'pending', 'in_review', 'approved', 'rejected'].map(s => (
          <button key={s} onClick={() => { setFilter(s); fetchDocs(s); }} className={`px-3 py-1.5 text-xs rounded font-semibold capitalize ${filter === s ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{s.replace('_', ' ')}</button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5">Client Ref</th>
              <th className="text-left px-4 py-2.5">Client Name</th>
              <th className="text-left px-4 py-2.5">Document Type</th>
              <th className="text-left px-4 py-2.5">Submitted</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-left px-4 py-2.5">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={6} className="text-center py-8 text-slate-400">Loading…</td></tr>}
            {!loading && docs.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">No documents in this category</td></tr>}
            {docs.map(d => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 text-xs font-mono text-emerald-700">{d.client_ref || d.order_id?.slice(0, 8) || '—'}</td>
                <td className="px-4 py-2.5">{d.client_name || d.customer_name || '—'}</td>
                <td className="px-4 py-2.5">{d.document_type || d.doc_type || 'Unknown'}</td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-2.5"><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${STATUS_COLOR[d.status] || 'bg-slate-100 text-slate-700'}`}>{(d.status || 'pending').replace('_', ' ')}</span></td>
                <td className="px-4 py-2.5">
                  <button onClick={() => setReviewing(d)} className="text-emerald-700 text-xs font-semibold hover:underline inline-flex items-center gap-1"><Eye className="w-3 h-3" /> Review</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {reviewing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setReviewing(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="text-lg font-bold mb-1">Review Document</div>
            <div className="text-sm text-slate-500 mb-4">{reviewing.client_name || reviewing.customer_name} · {reviewing.document_type || 'Document'}</div>
            {reviewing.file_url ? (
              <div className="bg-slate-50 rounded-lg p-3 mb-4">
                <a href={reviewing.file_url} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline text-sm">Open document →</a>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs flex items-center gap-2 text-amber-800">
                <AlertCircle className="w-4 h-4" /> No file URL on record. View original submission via client portal.
              </div>
            )}
            <div className="text-xs text-slate-600 mb-4">Current status: <span className="font-bold">{(reviewing.status || 'pending').replace('_', ' ')}</span></div>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason (required for rejection / resubmit)" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-4" rows={2} />
            <div className="flex gap-2">
              <button onClick={() => review(reviewing.id, 'approved')} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Approve</button>
              <button onClick={() => review(reviewing.id, 'resubmit_req', rejectReason || 'Please resubmit')} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold">Resubmit</button>
              <button onClick={() => review(reviewing.id, 'rejected', rejectReason || 'Rejected')} className="flex-1 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5"><XCircle className="w-4 h-4" /> Reject</button>
            </div>
            <button onClick={() => setReviewing(null)} className="mt-2 w-full py-2 text-xs text-slate-500 hover:text-slate-700">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
