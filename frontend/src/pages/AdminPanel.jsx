import React, { useCallback, useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';
import { FREE_ZONES } from '../mock';
import { supabaseRest } from '../lib/supabaseRest';
import { getToken } from '../lib/authTokenStorage';
import { loadFreezonePackages } from '../lib/pricingService';
import { adminApi } from '../lib/backendApi';
import {
  listCoupons, createCoupon, updateCoupon, deleteCoupon,
  updateOrderStatus, updateLeadStatus,
  listAllMemberships, setMembershipActive,
  listAllKyc, downloadCsv,
} from '../lib/adminSupabase';
import { listPaymentProofs, signProofUrl, updateProofStatus } from '../lib/paymentProofs';

const ADMIN_ROLES = ['founder', 'admin', 'manager', 'staff', 'reviewer'];

export default function AdminPanel() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tab, setTab] = useState('overview');
  const [leads, setLeads] = useState([]);
  const [localLeads, setLocalLeads] = useState([]);
  const [freezones, setFreezones] = useState(FREE_ZONES.map((z) => ({ ...z, active: true })));
  const [livePackages, setLivePackages] = useState([]);
  const [orders, setOrders] = useState([]);
  const [roleRows, setRoleRows] = useState([]);
  const [activities, setActivities] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [kycRows, setKycRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userEdit, setUserEdit] = useState({ new_password: '', new_role: 'staff', disable: false, full_name: '', assigned_manager: '' });
  const [savingUser, setSavingUser] = useState(false);
  const [newCoupon, setNewCoupon] = useState({ code: '', description: '', discount_type: 'percent', discount_value: 5, max_uses: 0 });
  const isAdmin = ADMIN_ROLES.includes(user?.role);

  useEffect(() => {
    if (!loading && !user) navigate('/login?redirect=/admin');
  }, [loading, user, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      loadLeads(); loadActivities(); loadPackages(); loadOrders(); loadRoles();
      loadUsers(); loadCoupons(); loadMemberships(); loadKyc();
    }
    // The callbacks below are useCallback-stable; intentionally excluded from deps
    // to avoid a temporal-dead-zone access during the initial render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin]);

  const loadCoupons = useCallback(async () => {
    const rows = await listCoupons();
    setCoupons(rows || []);
  }, []);
  const loadMemberships = useCallback(async () => {
    const rows = await listAllMemberships();
    setMemberships(rows || []);
  }, []);
  const loadKyc = useCallback(async () => {
    const rows = await listAllKyc();
    setKycRows(rows || []);
  }, []);

  const loadLeads = useCallback(async () => {
    const token = getToken();
    let pending = [];
    let consultations = [];
    try { pending = JSON.parse(localStorage.getItem('ssu_leads') || '[]'); } catch (err) { console.warn('[admin] failed to parse cached leads', err); }
    try { consultations = JSON.parse(localStorage.getItem('ssu_consultations') || '[]'); } catch (err) { console.warn('[admin] failed to parse cached consultations', err); }
    setLocalLeads([...pending, ...consultations]);
    try {
      const rows = await supabaseRest.select('leads', '?select=*&order=created_at.desc&limit=100', token);
      setLeads(rows || []);
      toast({ title: 'Leads loaded', description: `${rows?.length || 0} Supabase leads found.` });
    } catch (e) {
      console.warn('[admin] loadLeads failed', e);
      toast({ title: 'Could not load Supabase leads', description: e.message || 'Check SQL policies/admin role.' });
    }
  }, [toast]);


  const loadPackages = useCallback(async () => {
    try {
      const rows = await loadFreezonePackages();
      setLivePackages(rows || []);
    } catch (e) {
      setLivePackages([]);
      toast({ title: 'Could not load live packages', description: e.message || 'Check freezone_packages read policy.' });
    }
  }, [toast]);

  const loadOrders = useCallback(async () => {
    const token = getToken();
    try {
      const rows = await supabaseRest.select('checkout_orders', '?select=*&order=created_at.desc&limit=100', token);
      setOrders(rows || []);
    } catch (e) {
      console.warn('[admin] loadOrders failed', e);
      setOrders([]);
      toast({ title: 'Could not load orders', description: e.message || 'Check admin role or Supabase policies.' });
    }
  }, [toast]);

  const loadRoles = useCallback(async () => {
    const token = getToken();
    try {
      const profiles = await supabaseRest.select('profiles', '?select=id,email,full_name,name,role,is_active,created_at&order=created_at.desc&limit=100', token).catch(() => []);
      const admins = await supabaseRest.select('admin_profiles', '?select=*&order=created_at.desc&limit=100', token).catch(() => []);
      const normalized = [...(profiles || []), ...(admins || [])].filter((r) => ADMIN_ROLES.includes(r.role));
      setRoleRows(normalized);
    } catch (e) {
      console.warn('[admin] loadRoles failed', e);
      setRoleRows([]);
      toast({ title: 'Could not load roles', description: e.message || 'Check admin role / RLS.' });
    }
  }, [toast]);

  const loadUsers = useCallback(async () => {
    try {
      const response = await adminApi.listUsers();
      setUsers(response.users || []);
      if (!selectedUser && response.users?.length) {
        setSelectedUser(response.users[0]);
      }
    } catch (e) {
      console.warn('[admin] loadUsers failed', e);
      setUsers([]);
      toast({ title: 'Could not load team', description: e.message || 'Check admin role / backend.' });
    }
  }, [selectedUser, toast]);

  const chooseUser = (user) => {
    setSelectedUser(user);
    setUserEdit({
      new_password: '',
      new_role: user.role || 'staff',
      disable: user.is_active === false,
      full_name: user.full_name || '',
      assigned_manager: user.assigned_manager || '',
    });
  };

  const saveUserChanges = async () => {
    if (!selectedUser) return;
    setSavingUser(true);
    try {
      const payload = {
        target_id: selectedUser.id,
        new_role: userEdit.new_role,
        full_name: userEdit.full_name,
        disable: userEdit.disable,
      };
      if (userEdit.new_password) payload.new_password = userEdit.new_password;
      await adminApi.updateUser(payload);
      toast({ title: 'User updated', description: `${selectedUser.email} saved.` });
      await loadUsers();
    } catch (e) {
      toast({ title: 'Update failed', description: e.message || 'Review role permissions.' });
    } finally {
      setSavingUser(false);
    }
  };

  const loadActivities = useCallback(async () => {
    try {
      const rows = await supabaseRest.select('activities_master', '?select=id,freezone,activity_name,activity_code,industry_group,is_active&order=freezone.asc&limit=100');
      setActivities(rows || []);
    } catch (e) {
      // Admin can still use lead panel if activity policies are not open yet.
    }
  }, []);

  const updateFreezoneLocal = (id, key, value) => {
    setFreezones((prev) => prev.map((z) => (z.id === id ? { ...z, [key]: value } : z)));
    toast({ title: 'Local preview updated', description: 'For live pricing database edits, connect a pricing table later.' });
  };

  if (loading || !user) return null;

  if (!isAdmin) {
    return <div><Navbar /><section className="hero-gradient grain min-h-[60vh]"><div className="max-w-6xl mx-auto px-5 lg:px-8 py-20 text-center"><div className="text-2xl font-semibold text-slate-900">Admin access required</div><p className="mt-3 text-slate-600">You must be Admin, Manager, Staff or Reviewer.</p><Button onClick={() => navigate('/dashboard')} className="mt-6 rounded-full px-6 h-11">Go back</Button></div></section><Footer /></div>;
  }

  const allLeads = [...leads, ...localLeads.map((l, i) => ({ id: `local-${i}`, ...l, local_only: true }))];

  return (
    <div className="bg-[#0F172A] min-h-screen">
      <Navbar />
      {/* SIDEBAR + CONTENT shell — full viewport width, no max-width cap */}
      <div className="flex pt-[68px]" data-testid="admin-shell">
        {/* SIDEBAR */}
        <aside className="hidden lg:flex flex-col w-[248px] shrink-0 bg-[#0F2A2A] text-white border-r border-white/10 h-[calc(100vh-68px)] sticky top-[68px] overflow-y-auto">
          <div className="px-5 py-5 border-b border-white/10">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#F0C674] font-bold">Admin Console</div>
            <div className="mt-1 font-display text-lg font-semibold leading-tight">Control Tower</div>
            <div className="mt-1 text-[11px] text-white/55">{user.email}</div>
          </div>
          <nav className="flex-1 py-3 space-y-0.5">
            {[
              { k: 'overview',    label: 'Overview',      i: '◎', meta: 'KPIs · stats' },
              { k: 'support',     label: 'Support',       i: '☎', meta: 'Tickets · 30-min SLA' },
              { k: 'leads',       label: 'Leads',         i: '✿', meta: 'Captured enquiries' },
              { k: 'orders',      label: 'Orders',        i: '◈', meta: 'Stripe + bank' },
              { k: 'coupons',     label: 'Coupons',       i: '%',  meta: 'Promo codes' },
              { k: 'memberships', label: 'Memberships',   i: '★', meta: 'Founder club' },
              { k: 'kyc',         label: 'KYC',           i: '⛨', meta: 'Identity reviews' },
              { k: 'payments',    label: 'Payment Proofs',i: '◉', meta: 'Bank transfers' },
              { k: 'pricing',     label: 'Pricing',       i: '◧', meta: 'Freezone packages' },
              { k: 'activities',  label: 'Activities',    i: '☷', meta: '12K+ master list' },
              { k: 'roles',       label: 'Roles',         i: '◭', meta: 'RBAC matrix' },
              { k: 'team',        label: 'Team',          i: '◐', meta: 'Internal users' },
            ].map((item) => (
              <button
                key={item.k}
                onClick={() => setTab(item.k)}
                data-testid={`admin-tab-${item.k}`}
                className={`w-full text-left flex items-center gap-3 px-5 py-2.5 transition-colors border-l-2 ${
                  tab === item.k
                    ? 'bg-[#F0C674]/10 border-[#F0C674] text-white'
                    : 'border-transparent text-white/65 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className={`text-base ${tab === item.k ? 'text-[#F0C674]' : 'text-white/40'}`}>{item.i}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold">{item.label}</div>
                  <div className="text-[10.5px] text-white/40">{item.meta}</div>
                </div>
                {tab === item.k && <span className="text-[#F0C674]">›</span>}
              </button>
            ))}
          </nav>
          <div className="mt-auto p-4 border-t border-white/10">
            <div className="text-[10px] uppercase tracking-[0.22em] text-white/40 font-semibold">Logged in as</div>
            <div className="mt-1 text-sm font-semibold capitalize">{user.role}</div>
            <Button onClick={() => navigate('/dashboard')} variant="outline" className="mt-3 w-full h-9 text-xs rounded-full border-white/20 text-white hover:bg-white/10">← Go to dashboard</Button>
          </div>
        </aside>

        {/* CONTENT */}
        <main className="flex-1 min-w-0 bg-[#F4F6FB]">
          {/* Mobile tab strip (visible only < lg) */}
          <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 overflow-x-auto">
            <div className="flex gap-2 whitespace-nowrap">
              {['overview','support','leads','orders','coupons','memberships','kyc','payments','pricing','activities','roles','team'].map((k) => (
                <Button key={k} size="sm" onClick={() => setTab(k)} variant={tab === k ? 'default' : 'outline'} className="rounded-full px-3 h-8 text-[11px] capitalize">{k}</Button>
              ))}
            </div>
          </div>

          {/* Top header strip */}
          <header className="bg-white border-b border-slate-200 px-6 lg:px-10 py-5 flex items-center justify-between gap-4 flex-wrap" data-testid="admin-header">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-500">{tab.toUpperCase()}</div>
              <h1 className="mt-1 font-display text-2xl font-semibold text-slate-900">
                {tab === 'overview' && 'Platform overview'}
                {tab === 'support' && 'Support tickets — 30-minute SLA'}
                {tab === 'leads' && 'Captured leads'}
                {tab === 'orders' && 'Orders'}
                {tab === 'coupons' && 'Coupons & promos'}
                {tab === 'memberships' && 'Founder Club memberships'}
                {tab === 'kyc' && 'KYC reviews'}
                {tab === 'payments' && 'Bank-transfer payment proofs'}
                {tab === 'pricing' && 'Freezone pricing'}
                {tab === 'activities' && 'Activities master'}
                {tab === 'roles' && 'Role & permission matrix'}
                {tab === 'team' && 'Team & access'}
              </h1>
            </div>
            <div className="text-xs text-slate-500">Synced with Supabase · <span className="text-emerald-700 font-semibold">smrsaedmuaizlesehpee</span></div>
          </header>

          <div className="px-6 lg:px-10 py-6 space-y-6">
          {tab === 'overview' && <AdminOverview />}
          {tab === 'support' && <SupportTab />}
          {tab === 'leads' && (
            <div className="card-elevated rounded-3xl p-7">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div><div className="text-xs uppercase tracking-[0.22em] font-semibold text-slate-500">Captured Leads</div><div className="mt-2 text-lg font-semibold text-slate-900">{allLeads.length} total shown</div></div>
                <div className="flex gap-2">
                  <Button onClick={() => downloadCsv('leads.csv', allLeads)} variant="outline" className="rounded-full px-4 h-9 text-xs">Export CSV</Button>
                  <Button onClick={loadLeads} variant="outline" className="rounded-full px-4 h-9 text-xs">Reload</Button>
                </div>
              </div>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead><tr className="text-left text-slate-500 border-b"><th className="py-3">Date</th><th>Name</th><th>Phone</th><th>Email</th><th>Source</th><th>Activity / Message</th><th>Status</th></tr></thead>
                  <tbody>
                    {allLeads.map((l) => (
                      <tr key={l.id || `${l.name}-${l.phone_number}-${l.created_at}`} className="border-b border-slate-100">
                        <td className="py-3 text-slate-500">{l.created_at ? new Date(l.created_at).toLocaleString() : l.at ? new Date(l.at).toLocaleString() : '-'}</td>
                        <td className="font-medium text-slate-900">{l.name || '-'}</td>
                        <td>{[l.phone_country_code, l.phone_number || l.phone].filter(Boolean).join(' ') || '-'}</td>
                        <td>{l.email || '-'}</td>
                        <td>{l.source_page || l.source || '-'}</td>
                        <td className="max-w-[260px] truncate">{l.business_activity || l.activity || l.message || '-'}</td>
                        <td>{l.local_only ? (
                          <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-xs">local-only</span>
                        ) : (
                          <select
                            defaultValue={l.status || 'new'}
                            onChange={async (e) => {
                              try { await updateLeadStatus(l.id, e.target.value); toast({ title: 'Status updated' }); loadLeads(); }
                              catch { toast({ title: 'Update failed' }); }
                            }}
                            className="text-xs rounded-md border border-slate-300 px-2 py-1"
                            data-testid={`lead-status-${l.id}`}
                          >
                            {['new','contacted','qualified','converted','lost'].map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        )}</td>
                      </tr>
                    ))}
                    {allLeads.length === 0 && <tr><td colSpan="7" className="py-8 text-center text-slate-500">No leads yet. Submit any form and reload.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'pricing' && (
            <PricingEditor />
          )}

          {tab === 'orders' && (
            <div className="card-elevated rounded-3xl p-7">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div><div className="text-xs uppercase tracking-[0.22em] font-semibold text-slate-500">Checkout Orders</div><div className="mt-2 text-lg font-semibold text-slate-900">{orders.length} latest Supabase orders</div></div>
                <div className="flex gap-2">
                  <Button onClick={() => downloadCsv('orders.csv', orders)} variant="outline" className="rounded-full px-4 h-9 text-xs">Export CSV</Button>
                  <Button onClick={loadOrders} variant="outline" className="rounded-full px-4 h-9 text-xs">Reload</Button>
                </div>
              </div>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm min-w-[1100px]">
                  <thead><tr className="text-left text-slate-500 border-b"><th className="py-3">Created</th><th>Ref</th><th>Customer</th><th>Zone</th><th>Total</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id || o.reference} className="border-b border-slate-100">
                        <td className="py-3 text-slate-500">{o.created_at ? new Date(o.created_at).toLocaleString() : '-'}</td>
                        <td className="font-mono font-semibold">{o.order_ref || o.reference || o.id?.slice(0,8)}</td>
                        <td>{o.customer_name || o.customer_email || o.contact_name || o.contact_email || '-'}</td>
                        <td>{o.freezone || o.zone_name || '-'}{o.package_name ? ` · ${o.package_name}` : ''}</td>
                        <td>AED {Number(o.final_total ?? o.total_aed ?? 0).toLocaleString()}</td>
                        <td>
                          <select
                            defaultValue={o.status || 'new'}
                            onChange={async (e) => {
                              try { await updateOrderStatus(o.id, e.target.value); toast({ title: 'Status updated', description: `${o.reference} → ${e.target.value}` }); loadOrders(); }
                              catch { toast({ title: 'Update failed', description: 'Check admin role / RLS.' }); }
                            }}
                            className="text-xs rounded-md border border-slate-300 px-2 py-1"
                            data-testid={`order-status-${o.id}`}
                          >
                            {['new','payment_review','paid','docs_uploaded','submitted','issued','cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="text-xs text-slate-400">{o.notes ? '📝' : ''}</td>
                      </tr>
                    ))}
                    {orders.length === 0 && <tr><td colSpan="7" className="py-8 text-center text-slate-500">No orders.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'coupons' && (
            <div className="card-elevated rounded-3xl p-7" data-testid="admin-coupons">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div><div className="text-xs uppercase tracking-[0.22em] font-semibold text-slate-500">Coupons</div><div className="mt-2 text-lg font-semibold text-slate-900">{coupons.length} total</div></div>
                <Button onClick={() => downloadCsv('coupons.csv', coupons)} variant="outline" className="rounded-full px-4 h-9 text-xs">Export CSV</Button>
              </div>
              <div className="mt-6 grid lg:grid-cols-[1fr_320px] gap-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead><tr className="text-left text-slate-500 border-b"><th className="py-3">Code</th><th>Type</th><th>Value</th><th>Used / Max</th><th>Active</th><th></th></tr></thead>
                    <tbody>
                      {coupons.map((c) => (
                        <tr key={c.id} className="border-b border-slate-100" data-testid={`coupon-row-${c.code}`}>
                          <td className="py-3 font-mono font-bold text-slate-900">{c.code}</td>
                          <td className="text-xs">{c.discount_type}</td>
                          <td className="font-semibold">{c.discount_type === 'percent' ? `${c.discount_value}%` : `AED ${c.discount_value}`}</td>
                          <td className="text-xs text-slate-500">{c.used_count || 0} / {c.max_uses || '∞'}</td>
                          <td>
                            <button
                              onClick={async () => { await updateCoupon(c.id, { is_active: !c.is_active }); loadCoupons(); }}
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${c.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}
                              data-testid={`coupon-toggle-${c.code}`}
                            >
                              {c.is_active ? 'Active' : 'Off'}
                            </button>
                          </td>
                          <td>
                            <button
                              onClick={async () => {
                                if (window.confirm(`Delete coupon ${c.code}?`)) { await deleteCoupon(c.id); loadCoupons(); }
                              }}
                              className="text-rose-500 hover:text-rose-700 text-xs"
                              data-testid={`coupon-delete-${c.code}`}
                            >Delete</button>
                          </td>
                        </tr>
                      ))}
                      {coupons.length === 0 && <tr><td colSpan="6" className="py-8 text-center text-slate-500">No coupons. Run migration 0002 + create one →</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 h-fit" data-testid="coupon-create-form">
                  <div className="font-semibold text-slate-900 mb-3">New coupon</div>
                  <div className="space-y-2 text-xs">
                    <div><label className="text-slate-500">Code</label><Input value={newCoupon.code} onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })} className="h-9 mt-1 uppercase" data-testid="coupon-input-code" /></div>
                    <div><label className="text-slate-500">Description</label><Input value={newCoupon.description} onChange={(e) => setNewCoupon({ ...newCoupon, description: e.target.value })} className="h-9 mt-1" /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-500">Type</label>
                        <select value={newCoupon.discount_type} onChange={(e) => setNewCoupon({ ...newCoupon, discount_type: e.target.value })} className="w-full h-9 mt-1 rounded-md border border-slate-300 text-xs px-2">
                          <option value="percent">%</option><option value="flat">AED</option>
                        </select>
                      </div>
                      <div><label className="text-slate-500">Value</label><Input type="number" value={newCoupon.discount_value} onChange={(e) => setNewCoupon({ ...newCoupon, discount_value: Number(e.target.value) })} className="h-9 mt-1" /></div>
                    </div>
                    <div><label className="text-slate-500">Max uses (0 = ∞)</label><Input type="number" value={newCoupon.max_uses} onChange={(e) => setNewCoupon({ ...newCoupon, max_uses: Number(e.target.value) })} className="h-9 mt-1" /></div>
                    <Button
                      onClick={async () => {
                        if (!newCoupon.code) return toast({ title: 'Code required' });
                        try { await createCoupon(newCoupon); toast({ title: 'Coupon created', description: newCoupon.code }); setNewCoupon({ code: '', description: '', discount_type: 'percent', discount_value: 5, max_uses: 0 }); loadCoupons(); }
                        catch (e) { toast({ title: 'Create failed', description: e.message || 'Check admin role / RLS' }); }
                      }}
                      className="btn-primary rounded-full w-full h-10 mt-2"
                      data-testid="coupon-create-btn"
                    >Create coupon</Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'memberships' && (
            <div className="card-elevated rounded-3xl p-7" data-testid="admin-memberships">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div><div className="text-xs uppercase tracking-[0.22em] font-semibold text-slate-500">Founder Club Memberships</div><div className="mt-2 text-lg font-semibold text-slate-900">{memberships.filter((m) => m.active).length} active · {memberships.length} total</div></div>
                <div className="flex gap-2">
                  <Button onClick={() => downloadCsv('memberships.csv', memberships)} variant="outline" className="rounded-full px-4 h-9 text-xs">Export CSV</Button>
                  <Button onClick={loadMemberships} variant="outline" className="rounded-full px-4 h-9 text-xs">Reload</Button>
                </div>
              </div>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead><tr className="text-left text-slate-500 border-b"><th className="py-3">Email</th><th>Plan</th><th>Joined</th><th>Order Ref</th><th>Status</th></tr></thead>
                  <tbody>
                    {memberships.map((m) => (
                      <tr key={m.id} className="border-b border-slate-100">
                        <td className="py-3 font-medium text-slate-900">{m.user_email}</td>
                        <td className="text-xs">{m.plan}</td>
                        <td className="text-xs text-slate-500">{new Date(m.joined_at).toLocaleString()}</td>
                        <td className="font-mono text-xs">{m.order_reference || '-'}</td>
                        <td>
                          <button
                            onClick={async () => { await setMembershipActive(m.id, !m.active); loadMemberships(); }}
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${m.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}
                          >
                            {m.active ? 'Active' : 'Revoked'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {memberships.length === 0 && <tr><td colSpan="5" className="py-8 text-center text-slate-500">No memberships. Run migration 0001 + sell some founder club.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'kyc' && (
            <div className="card-elevated rounded-3xl p-7" data-testid="admin-kyc">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div><div className="text-xs uppercase tracking-[0.22em] font-semibold text-slate-500">KYC Submissions</div><div className="mt-2 text-lg font-semibold text-slate-900">{kycRows.length} documents across {new Set(kycRows.map((k) => k.user_email)).size} users</div></div>
                <div className="flex gap-2">
                  <Button onClick={() => downloadCsv('kyc.csv', kycRows)} variant="outline" className="rounded-full px-4 h-9 text-xs">Export CSV</Button>
                  <Button onClick={loadKyc} variant="outline" className="rounded-full px-4 h-9 text-xs">Reload</Button>
                </div>
              </div>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead><tr className="text-left text-slate-500 border-b"><th className="py-3">Uploaded</th><th>Email</th><th>Document</th><th>File</th><th>Size</th></tr></thead>
                  <tbody>
                    {kycRows.map((k) => (
                      <tr key={k.id} className="border-b border-slate-100">
                        <td className="py-3 text-slate-500 text-xs">{new Date(k.uploaded_at).toLocaleString()}</td>
                        <td className="font-medium text-slate-900">{k.user_email}</td>
                        <td className="text-xs uppercase tracking-wider font-semibold">{k.doc_key}</td>
                        <td className="text-xs truncate max-w-[260px]">{k.file_name}</td>
                        <td className="text-xs text-slate-500">{((k.file_size_bytes || 0) / 1024).toFixed(0)} KB</td>
                      </tr>
                    ))}
                    {kycRows.length === 0 && <tr><td colSpan="5" className="py-8 text-center text-slate-500">No KYC uploads yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}



          {tab === 'payments' && <PaymentProofsTab />}



          {tab === 'activities' && (
            <div className="card-elevated rounded-3xl p-7">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div><div className="text-xs uppercase tracking-[0.22em] font-semibold text-slate-500">Activities Master</div><div className="mt-2 text-lg font-semibold text-slate-900">{activities.length} latest activities shown</div></div>
                <Button onClick={loadActivities} variant="outline" className="rounded-full px-5 h-10">Reload Activities</Button>
              </div>
              <p className="mt-3 text-sm text-slate-600">This reads from Supabase table <b>activities_master</b>. Use this to confirm SPC, Mainland, RAKEZ, Meydan and other activity data is available before upload.</p>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead><tr className="text-left text-slate-500 border-b"><th className="py-3">Jurisdiction</th><th>Activity</th><th>Code</th><th>Industry</th><th>Active</th></tr></thead>
                  <tbody>
                    {activities.map((a) => (
                      <tr key={a.id || `${a.freezone}-${a.activity_code}-${a.activity_name}`} className="border-b border-slate-100">
                        <td className="py-3 font-medium text-slate-900">{a.freezone || '-'}</td>
                        <td>{a.activity_name || '-'}</td>
                        <td>{a.activity_code || '-'}</td>
                        <td>{a.industry_group || '-'}</td>
                        <td><span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs">{a.is_active === false ? 'No' : 'Yes'}</span></td>
                      </tr>
                    ))}
                    {activities.length === 0 && <tr><td colSpan="5" className="py-8 text-center text-slate-500">No activities loaded. Check RLS read policy for activities_master.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'roles' && (
            <div className="card-elevated rounded-3xl p-7">
              <div className="text-xs uppercase tracking-[0.22em] font-semibold text-slate-500">Roles</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">Admin / Manager / Staff / Reviewer</div>
              <p className="mt-3 text-slate-600">Roles are read from Supabase profiles/admin_profiles. Server-side RLS must still enforce permissions; the UI does not replace database policies.</p>
              <div className="mt-5 overflow-x-auto"><table className="w-full text-sm min-w-[700px]"><thead><tr className="text-left text-slate-500 border-b"><th className="py-3">Name</th><th>Email</th><th>Role</th><th>Active</th></tr></thead><tbody>{roleRows.map((r) => <tr key={r.id || r.user_id || r.email} className="border-b border-slate-100"><td className="py-3 font-medium text-slate-900">{r.full_name || r.name || '-'}</td><td>{r.email || '-'}</td><td>{r.role}</td><td>{r.is_active === false ? 'No' : 'Yes'}</td></tr>)}{roleRows.length === 0 && <tr><td colSpan="4" className="py-8 text-center text-slate-500">No admin role rows loaded. Check profiles/admin_profiles read policy.</td></tr>}</tbody></table></div>
            </div>
          )}

          {tab === 'team' && (
            <div className="card-elevated rounded-3xl p-7">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] font-semibold text-slate-500">Team management</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">Admin user operations</div>
                  <p className="mt-3 text-slate-600 max-w-3xl">View your active staff and reviewer team, update access, rotate passwords, and disable accounts without multiple systems.</p>
                </div>
                <Button onClick={loadUsers} variant="outline" className="rounded-full px-5 h-10">Refresh team</Button>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="text-left text-slate-500 border-b">
                        <th className="py-3">Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Manager</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className={`border-b border-slate-100 ${selectedUser?.id === u.id ? 'bg-slate-50' : ''}`}>
                          <td className="py-3 font-medium text-slate-900">{u.full_name || u.email.split('@')[0]}</td>
                          <td>{u.email}</td>
                          <td>{u.role}</td>
                          <td>{u.assigned_manager || '-'}</td>
                          <td><span className={`px-2 py-1 rounded-full text-xs ${u.is_active === false ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{u.is_active === false ? 'Disabled' : 'Active'}</span></td>
                          <td>
                            <button
                              onClick={() => chooseUser(u)}
                              className="text-[11px] text-slate-600 hover:text-slate-900"
                            >Manage</button>
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && (
                        <tr><td colSpan="6" className="py-8 text-center text-slate-500">No team members available. Ensure the backend /api/admin/users endpoint is accessible.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-3xl bg-slate-50 p-6">
                  <div className="font-semibold text-slate-900">Selected user</div>
                  {selectedUser ? (
                    <div className="space-y-4 mt-4">
                      <div className="text-sm text-slate-600">{selectedUser.full_name || selectedUser.email}</div>
                      <div className="space-y-3 text-sm text-slate-700">
                        <div>
                          <label className="text-[11px] uppercase tracking-wider text-slate-500">Full name</label>
                          <Input value={userEdit.full_name} onChange={(e) => setUserEdit({ ...userEdit, full_name: e.target.value })} className="mt-1 h-11 rounded-lg" />
                        </div>
                        <div>
                          <label className="text-[11px] uppercase tracking-wider text-slate-500">Role</label>
                          <select value={userEdit.new_role} onChange={(e) => setUserEdit({ ...userEdit, new_role: e.target.value })} className="w-full h-11 mt-1 rounded-lg border border-slate-300 px-3 text-sm">
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                            <option value="staff">Staff</option>
                            <option value="reviewer">Reviewer</option>
                            <option value="client">Client</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] uppercase tracking-wider text-slate-500">Assigned manager</label>
                          <Input value={userEdit.assigned_manager} onChange={(e) => setUserEdit({ ...userEdit, assigned_manager: e.target.value })} className="mt-1 h-11 rounded-lg" placeholder="Manager ID" />
                        </div>
                        <div>
                          <label className="text-[11px] uppercase tracking-wider text-slate-500">Reset password</label>
                          <Input type="password" value={userEdit.new_password} onChange={(e) => setUserEdit({ ...userEdit, new_password: e.target.value })} className="mt-1 h-11 rounded-lg" placeholder="New password" />
                        </div>
                        <div className="flex items-center gap-3">
                          <input id="disable-user" type="checkbox" checked={userEdit.disable} onChange={(e) => setUserEdit({ ...userEdit, disable: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                          <label htmlFor="disable-user" className="text-sm text-slate-700">Disable this account</label>
                        </div>
                      </div>
                      <Button onClick={saveUserChanges} disabled={savingUser} className="btn-primary rounded-full w-full h-12">
                        {savingUser ? 'Saving…' : 'Save user changes'}
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-6 text-slate-500">Select a team member to update their role, password or status.</div>
                  )}
                </div>
              </div>
            </div>
          )}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}

// --------- Admin Overview tab — KPI stats + seed/cleanup actions ---------
function AdminOverview() {
  const { toast } = useToast();
  const [stats, setStats] = React.useState(null);
  const [seeding, setSeeding] = React.useState(false);
  const load = React.useCallback(async () => {
    try { setStats(await adminApi.stats()); }
    catch (e) { toast({ title: 'Stats load failed', description: e.message || 'Check admin role.' }); }
  }, [toast]);
  React.useEffect(() => { load(); }, [load]);

  const seed = async () => {
    setSeeding(true);
    try {
      const r = await adminApi.seedDummy();
      toast({ title: 'Dummy data seeded', description: `${r.leads_inserted} leads · ${r.completed_companies} companies · ${r.founder_members} founder club · ${r.appointments} appointments` });
      await load();
    } catch (e) {
      toast({ title: 'Seed failed', description: e.message || 'Need admin role.' });
    } finally { setSeeding(false); }
  };
  const cleanup = async () => {
    if (!window.confirm('Delete all rows tagged TEST_DATA?')) return;
    try {
      await adminApi.cleanupDummy();
      toast({ title: 'Dummy data cleared' });
      await load();
    } catch (e) {
      toast({ title: 'Cleanup failed', description: e.message });
    }
  };

  const cards = stats ? [
    { l: 'Total Leads',           n: stats.leads.total, sub: `${stats.leads.new} new · ${stats.leads.converted} converted`, color: 'emerald', icon: '✿' },
    { l: 'Orders',                n: stats.orders.total, sub: `${stats.orders.paid} paid`, color: 'blue', icon: '◈' },
    { l: 'Founder Club',          n: stats.founder_club.active, sub: 'Active members', color: 'amber', icon: '★' },
    { l: 'Freezone Packages',     n: stats.freezone_packages, sub: 'Live · across 10 zones', color: 'violet', icon: '◧' },
    { l: 'Activities Master',     n: stats.activities, sub: 'Searchable', color: 'cyan', icon: '☷' },
    { l: 'Golden Visa Leads',     n: stats.golden_visa_leads, sub: 'Via /golden-visa form', color: 'rose', icon: '⛨' },
    { l: 'Appointments',          n: stats.appointments, sub: 'Medical · Bio · Stamping', color: 'teal', icon: '◐' },
  ] : [];

  const colorClasses = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue:    'bg-blue-50    text-blue-700    border-blue-200',
    amber:   'bg-amber-50   text-amber-700   border-amber-200',
    violet:  'bg-violet-50  text-violet-700  border-violet-200',
    cyan:    'bg-cyan-50    text-cyan-700    border-cyan-200',
    rose:    'bg-rose-50    text-rose-700    border-rose-200',
    teal:    'bg-teal-50    text-teal-700    border-teal-200',
  };

  return (
    <div className="space-y-6" data-testid="admin-overview">
      {/* TOP STATS RIBBON */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3" data-testid="admin-kpi-grid">
        {cards.map((c) => (
          <div key={c.l} className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <div className="flex items-start justify-between">
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{c.l}</div>
              <span className={`h-7 w-7 rounded-lg grid place-items-center text-sm border ${colorClasses[c.color]}`}>{c.icon}</span>
            </div>
            <div className="font-display text-[1.75rem] font-bold text-slate-900 mt-2 leading-none">{Number(c.n).toLocaleString()}</div>
            <div className="text-[11px] text-slate-500 mt-1.5 truncate">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ACTIONS BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-500">Platform actions</div>
          <div className="mt-1 text-sm text-slate-700">Quickly seed test data or refresh KPIs. All Supabase rows tagged <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">TEST_DATA</code>.</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={seed} disabled={seeding} className="rounded-full px-4 h-9 text-xs bg-emerald-700 text-white hover:bg-emerald-800" data-testid="admin-seed-dummy">{seeding ? 'Seeding…' : 'Seed 50 dummy leads'}</Button>
          <Button onClick={cleanup} variant="outline" className="rounded-full px-4 h-9 text-xs" data-testid="admin-cleanup-dummy">Delete TEST_DATA</Button>
          <Button onClick={load} variant="outline" className="rounded-full px-4 h-9 text-xs">↻ Refresh</Button>
        </div>
      </div>

      {/* SHORTCUTS */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { l: 'Add freezone package', d: 'Insert a new package row into Supabase pricing master.', cta: 'Pricing tab →', click: () => null },
          { l: 'Approve KYC',          d: `${stats?.leads?.new || 0} new identity reviews pending.`, cta: 'KYC tab →', click: () => null },
          { l: 'Review payment proofs', d: 'Manually verify any bank-transfer screenshots.', cta: 'Payment Proofs →', click: () => null },
        ].map((s) => (
          <div key={s.l} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="font-semibold text-slate-900">{s.l}</div>
            <div className="mt-1.5 text-xs text-slate-600 leading-relaxed">{s.d}</div>
            <div className="mt-3 text-[12px] font-semibold text-emerald-700">{s.cta}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Payment Proofs admin tab — reviews bank-transfer proof uploads from
   /payment-proof public page. Approve / reject sets payment_proofs.status
   in Supabase which the audit table monitors via RLS.
   ────────────────────────────────────────────────────────────────────── */
function PaymentProofsTab() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [viewing, setViewing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listPaymentProofs(filter === 'all' ? {} : { status: filter });
      setItems(rows || []);
    } catch (e) {
      toast({ title: 'Failed to load proofs', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => { load(); }, [load]);

  const view = async (row) => {
    try {
      const url = await signProofUrl({ path: row.file_path });
      setViewing({ ...row, signedUrl: url });
    } catch (e) {
      toast({ title: 'Cannot open file', description: e.message, variant: 'destructive' });
    }
  };

  const setStatus = async (row, status) => {
    try {
      await updateProofStatus({ id: row.id, status, reviewer: 'admin' });
      toast({ title: `Proof ${status}` });
      load();
    } catch (e) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="card-elevated rounded-3xl p-7" data-testid="admin-payment-proofs">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] font-semibold text-slate-500">Bank Transfer Proofs</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{items.length} proof{items.length === 1 ? '' : 's'} {filter !== 'all' ? `(${filter})` : ''}</div>
        </div>
        <div className="flex gap-2">
          {['pending', 'approved', 'rejected', 'all'].map((s) => (
            <Button key={s} variant={filter === s ? 'default' : 'outline'} className="rounded-full px-3 h-9 text-xs capitalize" onClick={() => setFilter(s)} data-testid={`payment-proof-filter-${s}`}>{s}</Button>
          ))}
          <Button variant="outline" className="rounded-full px-4 h-9 text-xs" onClick={load} data-testid="payment-proof-refresh">{loading ? 'Loading…' : 'Refresh'}</Button>
        </div>
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-3">Uploaded</th>
              <th>Order ref</th>
              <th>Amount</th>
              <th>Currency</th>
              <th>Customer</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b border-slate-100">
                <td className="py-3 text-slate-500">{p.uploaded_at ? new Date(p.uploaded_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}</td>
                <td className="font-mono text-xs">{p.order_ref || p.order_id || '-'}</td>
                <td className="font-semibold">{Number(p.amount || 0).toLocaleString()}</td>
                <td>{p.currency || 'AED'}</td>
                <td className="text-slate-700">{p.customer_email || p.customer_name || '-'}</td>
                <td>
                  <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${p.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : p.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{p.status || 'pending'}</span>
                </td>
                <td className="text-right">
                  <div className="inline-flex gap-1.5">
                    <Button variant="outline" className="rounded-full h-8 px-3 text-xs" onClick={() => view(p)}>View</Button>
                    {p.status !== 'approved' && (
                      <Button className="rounded-full h-8 px-3 text-xs bg-emerald-700 text-white hover:bg-emerald-800" onClick={() => setStatus(p, 'approved')}>Approve</Button>
                    )}
                    {p.status !== 'rejected' && (
                      <Button variant="outline" className="rounded-full h-8 px-3 text-xs border-red-400 text-red-700 hover:bg-red-50" onClick={() => setStatus(p, 'rejected')}>Reject</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && !loading && (
              <tr><td colSpan={7} className="py-10 text-center text-slate-400">No proofs in this view</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {viewing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm grid place-items-center p-6" onClick={() => setViewing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-slate-900">Proof · {viewing.order_ref || viewing.id}</div>
              <Button variant="outline" className="rounded-full h-8 px-3 text-xs" onClick={() => setViewing(null)}>Close</Button>
            </div>
            {viewing.signedUrl?.match(/\.(png|jpe?g|webp)$/i) ? (
              <img src={viewing.signedUrl} alt="Payment proof" className="max-h-[70vh] mx-auto rounded-xl border border-slate-200" />
            ) : (
              <iframe src={viewing.signedUrl} title="proof" className="w-full h-[70vh] rounded-xl border border-slate-200" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Pricing Editor — live CRUD on Supabase `freezone_packages`.
   Public site reads from the SAME table, so changes here are reflected
   on /free-zones, /compare and /ai-search within seconds (no rebuild).
   ────────────────────────────────────────────────────────────────────── */
function PricingEditor() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ freezone: '', name: '', base_price: '', visas_included: 0, activities_included: 1, office_type: '', duration_years: 1, notes: '', currency: 'AED' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/packages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setRows(await r.json());
    } catch (e) {
      toast({ title: 'Could not load packages', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((p) => {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return [p.freezone, p.name, p.office_type, p.notes].filter(Boolean).some((s) => String(s).toLowerCase().includes(f));
  });

  const startEdit = (row) => {
    setEditing(row.id);
    setDraft({
      freezone: row.freezone || '',
      name: row.name || '',
      base_price: row.base_price ?? '',
      visas_included: row.visas_included ?? 0,
      activities_included: row.activities_included ?? 1,
      office_type: row.office_type || '',
      duration_years: row.duration_years ?? 1,
      notes: row.notes || '',
      currency: row.currency || 'AED',
      is_active: row.is_active !== false,
    });
  };

  const cancel = () => { setEditing(null); setCreating(false); };

  const save = async () => {
    const token = getToken();
    const body = { ...draft, base_price: Number(draft.base_price) || 0 };
    const url = creating
      ? `${process.env.REACT_APP_BACKEND_URL}/api/admin/packages`
      : `${process.env.REACT_APP_BACKEND_URL}/api/admin/packages/${editing}`;
    try {
      const r = await fetch(url, {
        method: creating ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: creating ? 'Package created' : 'Package updated', description: `Live on the website in seconds.` });
      cancel();
      load();
    } catch (e) {
      toast({ title: 'Save failed', description: String(e.message || e).slice(0, 200), variant: 'destructive' });
    }
  };

  const softDelete = async (id) => {
    if (!window.confirm('Mark this package inactive? (Public site will hide it.)')) return;
    const token = getToken();
    try {
      const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/packages/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast({ title: 'Package hidden' });
      load();
    } catch (e) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    }
  };

  const renderCell = (children, className = '') => <td className={`py-3 px-2 ${className}`}>{children}</td>;
  const renderInput = (k, type = 'text', placeholder = '', w = 'w-full') => (
    <Input value={draft[k] ?? ''} type={type} placeholder={placeholder} className={`h-9 ${w}`} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
  );

  return (
    <div className="space-y-4" data-testid="admin-pricing-editor">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-500">Live pricing editor</div>
          <div className="mt-1 text-sm text-slate-700">{rows.length} package rows · edits PATCH Supabase directly · public site reflects within seconds</div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by zone, package, notes…" className="h-9 w-72" data-testid="pricing-filter" />
          <Button onClick={() => { setCreating(true); setEditing(null); setDraft({ freezone: '', name: '', base_price: '', visas_included: 0, activities_included: 1, office_type: '', duration_years: 1, notes: '', currency: 'AED', is_active: true }); }} className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white h-9 text-xs px-4" data-testid="pricing-add">+ Add package</Button>
          <Button onClick={load} variant="outline" className="rounded-full h-9 text-xs px-4">↻ Refresh</Button>
        </div>
      </div>

      {creating && (
        <div className="bg-emerald-50/50 rounded-2xl border-2 border-emerald-200 p-5" data-testid="pricing-create-form">
          <div className="font-semibold text-slate-900 mb-3">New package</div>
          <div className="grid sm:grid-cols-4 gap-2">
            {renderInput('freezone', 'text', 'Free zone (e.g. IFZA)')}
            {renderInput('name', 'text', 'Package name')}
            {renderInput('base_price', 'number', 'Base price AED')}
            {renderInput('visas_included', 'number', 'Visas')}
            {renderInput('activities_included', 'number', 'Activities')}
            {renderInput('office_type', 'text', 'Workspace (Flexi / Office)')}
            {renderInput('duration_years', 'number', 'Duration yrs')}
            {renderInput('notes', 'text', 'Internal notes')}
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={save} className="rounded-full bg-emerald-700 text-white h-9 px-5 text-xs">Save new package</Button>
            <Button onClick={cancel} variant="outline" className="rounded-full h-9 px-5 text-xs">Cancel</Button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="text-left text-slate-500 border-b bg-slate-50">
              <th className="py-3 px-3">Free Zone</th>
              <th>Package</th>
              <th>Base AED</th>
              <th>Visas</th>
              <th>Activities</th>
              <th>Workspace</th>
              <th>Years</th>
              <th>Active</th>
              <th className="text-right pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="py-8 text-center text-slate-400">Loading…</td></tr>}
            {!loading && filtered.map((p) => (
              editing === p.id ? (
                <tr key={p.id} className="border-b bg-emerald-50/40">
                  {renderCell(renderInput('freezone'))}
                  {renderCell(renderInput('name'))}
                  {renderCell(renderInput('base_price', 'number'))}
                  {renderCell(renderInput('visas_included', 'number'))}
                  {renderCell(renderInput('activities_included', 'number'))}
                  {renderCell(renderInput('office_type'))}
                  {renderCell(renderInput('duration_years', 'number'))}
                  {renderCell(
                    <select value={draft.is_active ? 'yes' : 'no'} onChange={(e) => setDraft({ ...draft, is_active: e.target.value === 'yes' })} className="h-9 rounded-md border border-slate-300 px-2 text-sm">
                      <option value="yes">Active</option>
                      <option value="no">Hidden</option>
                    </select>
                  )}
                  <td className="py-3 pr-3 text-right whitespace-nowrap">
                    <Button onClick={save} className="rounded-full bg-emerald-700 text-white h-8 px-3 text-xs mr-1">Save</Button>
                    <Button onClick={cancel} variant="outline" className="rounded-full h-8 px-3 text-xs">Cancel</Button>
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  {renderCell(p.freezone, 'font-semibold text-slate-900 pl-3')}
                  {renderCell(p.name || '-')}
                  {renderCell(`AED ${Number(p.base_price || 0).toLocaleString()}`, 'tabular-nums')}
                  {renderCell(p.visas_included ?? 0)}
                  {renderCell(p.activities_included ?? 1)}
                  {renderCell(p.office_type || '-')}
                  {renderCell(p.duration_years ?? 1)}
                  {renderCell(
                    <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${p.is_active === false ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>{p.is_active === false ? 'Hidden' : 'Active'}</span>
                  )}
                  <td className="py-3 pr-3 text-right whitespace-nowrap">
                    <Button onClick={() => startEdit(p)} variant="outline" className="rounded-full h-8 px-3 text-xs mr-1" data-testid={`pricing-edit-${p.id}`}>Edit</Button>
                    <Button onClick={() => softDelete(p.id)} variant="outline" className="rounded-full h-8 px-3 text-xs border-red-300 text-red-700 hover:bg-red-50">Hide</Button>
                  </td>
                </tr>
              )
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={9} className="py-10 text-center text-slate-400">No packages match your filter</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


/* ──────────────────────────────────────────────────────────────────────
   Support Tickets admin tab — see all tickets, claim, reply, resolve.
   Aria-first reply is created automatically when a ticket is opened.
   ────────────────────────────────────────────────────────────────────── */
function SupportTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState('open');
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const API = process.env.REACT_APP_BACKEND_URL;
  const authHdr = useCallback(() => ({ Authorization: `Bearer ${getToken()}` }), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter === 'mine' ? `${API}/api/support/tickets?mine=true` : filter === 'all' ? `${API}/api/support/tickets` : `${API}/api/support/tickets?status=${filter}`;
      const r = await fetch(url, { headers: authHdr() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setTickets(await r.json());
    } catch (e) {
      toast({ title: 'Could not load tickets', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [API, authHdr, filter, toast]);

  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  const openTicket = async (t) => {
    setActive(t);
    setMessages([]);
    try {
      const r = await fetch(`${API}/api/support/tickets/${t._id}`, { headers: authHdr() });
      if (r.ok) {
        const d = await r.json();
        setActive(d.ticket);
        setMessages(d.messages || []);
      }
    } catch (e) { console.warn('[admin] support ticket fetch failed', e); }
  };

  const claim = async () => {
    if (!active) return;
    try {
      const r = await fetch(`${API}/api/support/tickets/${active._id}/claim`, { method: 'POST', headers: authHdr() });
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      setActive(d.ticket);
      toast({ title: 'Ticket assigned to you' });
      load();
    } catch (e) { toast({ title: 'Claim failed', description: e.message, variant: 'destructive' }); }
  };

  const send = async () => {
    if (!reply.trim() || !active) return;
    setSending(true);
    try {
      const r = await fetch(`${API}/api/support/tickets/${active._id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHdr() },
        body: JSON.stringify({ body: reply }),
      });
      if (!r.ok) throw new Error(await r.text());
      setReply('');
      openTicket(active);
      load();
    } catch (e) { toast({ title: 'Send failed', description: e.message, variant: 'destructive' }); }
    finally { setSending(false); }
  };

  const setStatus = async (status) => {
    if (!active) return;
    try {
      const r = await fetch(`${API}/api/support/tickets/${active._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHdr() },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      setActive(d.ticket);
      toast({ title: `Ticket ${status}` });
      load();
    } catch (e) { toast({ title: 'Update failed', description: e.message, variant: 'destructive' }); }
  };

  const minsAgo = (iso) => {
    if (!iso) return '-';
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const slaBadge = (t) => {
    if (t.status === 'resolved' || t.status === 'closed') return null;
    if (!t.first_response_at) {
      const minsSince = Math.floor((Date.now() - new Date(t.created_at).getTime()) / 60000);
      const ok = minsSince <= 30;
      return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{ok ? `SLA ${30 - minsSince}m left` : `SLA breached ${minsSince - 30}m`}</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">First reply sent</span>;
  };

  return (
    <div className="grid lg:grid-cols-[400px_1fr] gap-4" data-testid="admin-support">
      {/* LEFT — ticket list */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col h-[70vh]">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2 flex-wrap">
          <div className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-500">{tickets.length} tickets</div>
          <div className="ml-auto flex gap-1">
            {[
              { k: 'open', l: 'Open' },
              { k: 'in_progress', l: 'In progress' },
              { k: 'mine', l: 'Mine' },
              { k: 'resolved', l: 'Resolved' },
              { k: 'all', l: 'All' },
            ].map((f) => (
              <button key={f.k} onClick={() => setFilter(f.k)} className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${filter === f.k ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} data-testid={`support-filter-${f.k}`}>{f.l}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loading && <div className="p-6 text-center text-slate-400">Loading…</div>}
          {!loading && tickets.length === 0 && <div className="p-8 text-center text-slate-400 text-sm">No tickets in this view.</div>}
          {tickets.map((t) => (
            <button key={t._id} onClick={() => openTicket(t)} className={`w-full text-left p-3 hover:bg-slate-50 transition-colors ${active?._id === t._id ? 'bg-emerald-50' : ''}`} data-testid={`support-ticket-${t._id}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-[11px] text-slate-500">{t.reference}</div>
                {slaBadge(t)}
              </div>
              <div className="mt-1 font-semibold text-slate-900 text-[13px] truncate">{t.subject || '(no subject)'}</div>
              <div className="mt-0.5 text-[11.5px] text-slate-500 truncate">{t.customer_email || 'anonymous'}</div>
              <div className="mt-1 flex items-center justify-between text-[10.5px]">
                <span className={`px-1.5 py-0.5 rounded-full font-semibold ${t.status === 'open' ? 'bg-amber-100 text-amber-700' : t.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : t.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{t.status}</span>
                <span className="text-slate-400">{minsAgo(t.created_at)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT — thread */}
      <div className="bg-white rounded-2xl border border-slate-200 flex flex-col h-[70vh]">
        {!active && <div className="flex-1 grid place-items-center text-slate-400">Pick a ticket to start chatting</div>}
        {active && (
          <>
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="font-mono text-[11px] text-slate-500">{active.reference} · {active.channel}</div>
                <div className="font-semibold text-slate-900">{active.subject}</div>
                <div className="text-[11.5px] text-slate-500">{active.customer_name} · {active.customer_email} · {active.phone || '—'}</div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {!active.assigned_to && <Button onClick={claim} className="rounded-full bg-emerald-700 text-white h-8 px-4 text-xs">Claim ticket</Button>}
                {active.assigned_to && <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold">Assigned: {active.assigned_to}</span>}
                {active.status !== 'resolved' && <Button onClick={() => setStatus('resolved')} variant="outline" className="rounded-full h-8 px-4 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50">Mark resolved</Button>}
                {active.status === 'resolved' && <Button onClick={() => setStatus('open')} variant="outline" className="rounded-full h-8 px-4 text-xs">Reopen</Button>}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/40" data-testid="support-thread">
              {messages.map((m, i) => (
                <div key={i} className={`max-w-[80%] ${m.from_role === 'customer' ? 'ml-0' : 'ml-auto'}`}>
                  <div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line ${m.from_role === 'customer' ? 'bg-white border border-slate-200' : m.from_role === 'aria' ? 'bg-emerald-50 border border-emerald-200' : m.from_role === 'internal' ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-700 text-white'}`}>
                    {m.body}
                  </div>
                  <div className="text-[10.5px] text-slate-500 mt-1">{m.from_role} · {m.from_email} · {minsAgo(m.created_at)}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 p-3 flex gap-2">
              <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type your reply to the customer…" className="h-10" onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()} data-testid="support-reply-input" />
              <Button onClick={send} disabled={!reply.trim() || sending} className="rounded-full bg-emerald-700 text-white h-10 px-5 text-xs">{sending ? 'Sending…' : 'Send'}</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

