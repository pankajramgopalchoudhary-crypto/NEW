'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Eye } from 'lucide-react';

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);

  const fetchData = async (s = filter) => {
    setLoading(true);
    const url = s === 'all' ? '/api/admin/payments' : `/api/admin/payments?status=${s}`;
    const r = await fetch(url, { credentials: 'include' });
    const d = await r.json();
    setPayments(d.payments || []);
    setLoading(false);
  };

  useEffect(() => { fetchData('all'); }, []);

  const review = async (id, status) => {
    await fetch(`/api/admin/payments/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    setViewing(null);
    fetchData(filter);
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="mb-5"><div className="text-2xl font-bold text-slate-900">Payment Proofs</div><div className="text-sm text-slate-500">Bank-transfer receipts awaiting verification</div></div>
      <div className="flex gap-1 mb-3">
        {['all', 'pending', 'approved', 'rejected'].map(s => (
          <button key={s} onClick={() => { setFilter(s); fetchData(s); }} className={`px-3 py-1.5 text-xs rounded font-semibold capitalize ${filter === s ? 'bg-emerald-700 text-white' : 'bg-slate-100'}`}>{s}</button>
        ))}
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
            <tr><th className="text-left px-4 py-2.5">Order</th><th className="text-left px-4 py-2.5">Client</th><th className="text-left px-4 py-2.5">Amount</th><th className="text-left px-4 py-2.5">Method</th><th className="text-left px-4 py-2.5">Submitted</th><th className="text-left px-4 py-2.5">Status</th><th className="text-left px-4 py-2.5">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={7} className="text-center py-8 text-slate-400">Loading…</td></tr>}
            {!loading && payments.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate-400">No payment proofs yet</td></tr>}
            {payments.map(p => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-mono text-xs">{p.order_id?.slice(0, 8) || '—'}</td>
                <td className="px-4 py-2.5">{p.client_name || '—'}</td>
                <td className="px-4 py-2.5 font-bold">AED {Number(p.amount || 0).toLocaleString()}</td>
                <td className="px-4 py-2.5 text-xs">{p.method || 'bank_transfer'}</td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-2.5"><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${p.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : p.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{p.status || 'pending'}</span></td>
                <td className="px-4 py-2.5"><button onClick={() => setViewing(p)} className="text-emerald-700 text-xs font-semibold inline-flex items-center gap-1 hover:underline"><Eye className="w-3 h-3" /> View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {viewing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <div className="bg-white rounded-2xl max-w-xl w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="text-lg font-bold mb-1">Payment Proof</div>
            <div className="text-sm text-slate-500 mb-4">Order {viewing.order_id?.slice(0, 8)} · AED {viewing.amount}</div>
            {viewing.proof_url ? (<a href={viewing.proof_url} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline text-sm block mb-4">Open file →</a>) : (<div className="text-xs text-amber-700 bg-amber-50 p-3 rounded mb-4">No file URL on record.</div>)}
            <div className="flex gap-2">
              <button onClick={() => review(viewing.id, 'approved')} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Approve</button>
              <button onClick={() => review(viewing.id, 'rejected')} className="flex-1 py-2 bg-rose-500 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5"><XCircle className="w-4 h-4" /> Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
