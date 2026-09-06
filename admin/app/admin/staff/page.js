'use client';
import { useEffect, useState } from 'react';
import { Plus, KeyRound, Lock, Unlock, Trash2 } from 'lucide-react';

export default function StaffPage() {
  const [staff, setStaff] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', username: '', role: 'staff', pin: '', password: '' });
  const [resetting, setResetting] = useState(null);
  const [newPin, setNewPin] = useState('');
  const [createdInfo, setCreatedInfo] = useState(null);
  const [user, setUser] = useState(null);

  const load = async () => {
    const r = await fetch('/api/admin/staff', { credentials: 'include' });
    const d = await r.json();
    setStaff(d.staff || []);
  };
  useEffect(() => { load(); fetch('/api/admin/auth/me', { credentials: 'include' }).then(r => r.json()).then(d => setUser(d.user)); }, []);

  const create = async () => {
    const r = await fetch('/api/admin/staff', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const d = await r.json();
    if (d.ok) {
      setCreatedInfo({ ...d.user, plain_pin: form.pin, plain_password: form.password });
      setCreating(false);
      setForm({ full_name: '', email: '', username: '', role: 'staff', pin: '', password: '' });
      load();
    } else alert(d.error || 'Failed');
  };
  const toggleActive = async (id, current) => {
    await fetch(`/api/admin/staff/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !current }) });
    load();
  };
  const resetPin = async () => {
    await fetch(`/api/admin/staff/${resetting.id}/reset-pin`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: newPin }) });
    setResetting(null);
    setNewPin('');
    load();
  };
  const remove = async (id) => {
    if (!confirm('Remove this user permanently?')) return;
    await fetch(`/api/admin/staff/${id}`, { method: 'DELETE', credentials: 'include' });
    load();
  };

  const ROLE_DESC = {
    founder: { color: 'bg-emerald-700 text-white', label: 'Full access' },
    manager: { color: 'bg-blue-100 text-blue-700', label: 'Leads, clients, KYC, payments, coupons' },
    staff: { color: 'bg-purple-100 text-purple-700', label: 'Leads, clients, invoices' },
    reviewer: { color: 'bg-amber-100 text-amber-700', label: 'KYC approve / reject only' },
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div><div className="text-2xl font-bold text-slate-900">Staff & Access</div><div className="text-sm text-slate-500">Manage admin users, their roles, PINs, and access</div></div>
        <button onClick={() => setCreating(!creating)} className="text-xs bg-emerald-700 text-white px-3 py-2 rounded-lg flex items-center gap-1.5"><Plus className="w-3 h-3" /> Add Staff Member</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {['founder', 'manager', 'staff', 'reviewer'].map(r => (
          <div key={r} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className={`text-[10px] uppercase font-bold tracking-wider inline-block px-2 py-0.5 rounded ${ROLE_DESC[r].color} mb-2`}>{r}</div>
            <div className="text-xs text-slate-500">{ROLE_DESC[r].label}</div>
          </div>
        ))}
      </div>

      {creating && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-4">
          <div className="text-sm font-bold mb-3">Add New Team Member</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input placeholder="Full Name" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="px-2 py-1.5 border rounded text-sm" />
            <input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="px-2 py-1.5 border rounded text-sm" />
            <input placeholder="Username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="px-2 py-1.5 border rounded text-sm" />
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="px-2 py-1.5 border rounded text-sm">
              {user?.role === 'founder' && <option value="manager">Manager</option>}
              <option value="staff">Staff</option>
              <option value="reviewer">Reviewer</option>
            </select>
            {['staff', 'reviewer'].includes(form.role) ? (
              <input placeholder="PIN (4-6 digits)" value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) })} className="px-2 py-1.5 border rounded text-sm" />
            ) : (
              <input type="password" placeholder="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="px-2 py-1.5 border rounded text-sm" />
            )}
            <button onClick={create} className="bg-emerald-700 text-white py-1.5 rounded text-xs font-semibold">Create & Send Credentials</button>
          </div>
        </div>
      )}

      {createdInfo && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
          <div className="font-bold text-amber-900 mb-2">✅ User created. Share these credentials securely:</div>
          <div className="text-sm font-mono space-y-1">
            <div>Username: <span className="font-bold">{createdInfo.username}</span></div>
            <div>Email: <span className="font-bold">{createdInfo.email}</span></div>
            {createdInfo.plain_pin && <div>PIN: <span className="font-bold">{createdInfo.plain_pin}</span></div>}
            {createdInfo.plain_password && <div>Password: <span className="font-bold">{createdInfo.plain_password}</span></div>}
          </div>
          <button onClick={() => setCreatedInfo(null)} className="mt-3 text-xs text-amber-900 underline">Close</button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="text-left px-4 py-2.5">Name</th><th className="text-left px-4 py-2.5">Username</th><th className="text-left px-4 py-2.5">Email</th><th className="text-left px-4 py-2.5">Role</th><th className="text-left px-4 py-2.5">Status</th><th className="text-left px-4 py-2.5">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {staff.map(u => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-semibold">{u.full_name}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{u.username}</td>
                <td className="px-4 py-2.5 text-xs">{u.email}</td>
                <td className="px-4 py-2.5"><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${ROLE_DESC[u.role]?.color}`}>{u.role}</span></td>
                <td className="px-4 py-2.5"><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{u.is_active ? 'Active' : 'Locked'}</span></td>
                <td className="px-4 py-2.5 flex gap-1.5">
                  {['staff', 'reviewer'].includes(u.role) && <button onClick={() => { setResetting(u); setNewPin(''); }} className="text-blue-600 text-xs hover:bg-blue-50 px-2 py-1 rounded inline-flex items-center gap-1"><KeyRound className="w-3 h-3" /> Reset PIN</button>}
                  <button onClick={() => toggleActive(u.id, u.is_active)} className={`text-xs px-2 py-1 rounded inline-flex items-center gap-1 ${u.is_active ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'}`}>{u.is_active ? <><Lock className="w-3 h-3" /> Lock</> : <><Unlock className="w-3 h-3" /> Unlock</>}</button>
                  {user?.role === 'founder' && u.role !== 'founder' && <button onClick={() => remove(u.id)} className="text-rose-500 text-xs hover:bg-rose-50 px-2 py-1 rounded inline-flex items-center gap-1"><Trash2 className="w-3 h-3" /> Remove</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resetting && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setResetting(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="text-lg font-bold mb-1">Reset PIN</div>
            <div className="text-sm text-slate-500 mb-4">For {resetting.full_name} ({resetting.username})</div>
            <input value={newPin} onChange={e => setNewPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="New PIN (4-6 digits)" className="w-full px-3 py-2 border rounded text-lg tracking-[0.4em] text-center font-mono" />
            <div className="flex gap-2 mt-4">
              <button onClick={resetPin} disabled={newPin.length < 4} className="flex-1 py-2 bg-emerald-700 text-white rounded text-sm font-semibold disabled:opacity-50">Save New PIN</button>
              <button onClick={() => setResetting(null)} className="flex-1 py-2 border rounded text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
