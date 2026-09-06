'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutGrid, LineChart, Users, UserCircle, FileText, Receipt, CreditCard,
  Tag, Package as PackageIcon, Ticket, MessageSquare, Map, Scale, Search, UsersRound, Crown, Settings, LogOut,
  Mail, Sparkles
} from 'lucide-react';
import BrandMark from '@/components/BrandMark';

const NAV = [
  { group: 'Overview', items: [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutGrid, perm: 'dashboard' },
    { href: '/admin/analytics', label: 'Analytics', icon: LineChart, perm: 'analytics' },
  ]},
  { group: 'Business', items: [
    { href: '/admin/leads', label: 'Leads & Orders', icon: Users, perm: 'leads' },
    { href: '/admin/tickets', label: 'Support Tickets', icon: MessageSquare, perm: 'tickets' },
    { href: '/admin/support-analytics', label: 'Support Analytics', icon: LineChart, perm: 'support-analytics', roles: ['founder', 'manager'] },
    { href: '/admin/ai-support', label: 'AI Support', icon: Sparkles, perm: 'ai-support', roles: ['founder', 'manager'] },
    { href: '/admin/email-health', label: 'Email Health', icon: Mail, perm: 'email-health', roles: ['founder', 'manager'] },
    { href: '/admin/clients', label: 'Clients', icon: UserCircle, perm: 'clients' },
    { href: '/admin/documents', label: 'Documents (KYC)', icon: FileText, perm: 'documents' },
    { href: '/admin/invoices', label: 'Invoices', icon: Receipt, perm: 'invoices' },
    { href: '/admin/payments', label: 'Payments', icon: CreditCard, perm: 'payments' },
  ]},
  { group: 'Configure', items: [
    { href: '/admin/pricing', label: 'Pricing & Packages', icon: Tag, perm: 'pricing', roles: ['founder'] },
    { href: '/admin/packages', label: 'Packages & Visas', icon: PackageIcon, perm: 'packages', roles: ['founder'] },
    { href: '/admin/coupons', label: 'Coupons', icon: Ticket, perm: 'coupons' },
    { href: '/admin/founders-club', label: 'Founders Club', icon: Crown, perm: 'founders-club' },
    { href: '/admin/jurisdictions', label: 'Jurisdictions', icon: Map, perm: 'jurisdictions', roles: ['founder'] },
  ]},
  { group: 'System', items: [
    { href: '/admin/legal', label: 'Legal & Footer', icon: Scale, perm: 'legal', roles: ['founder'] },
    { href: '/admin/seo', label: 'SEO Manager', icon: Search, perm: 'seo', roles: ['founder'] },
    { href: '/admin/staff', label: 'Staff & Access', icon: UsersRound, perm: 'staff', roles: ['founder', 'manager'] },
    { href: '/admin/settings', label: 'Settings', icon: Settings, perm: 'settings', roles: ['founder'] },
  ]},
];

function canSee(item, role) {
  if (role === 'founder') return true;
  if (item.roles && !item.roles.includes(role)) return false;
  if (role === 'reviewer') return ['/admin/documents'].includes(item.href);
  if (role === 'manager') return !item.roles || item.roles.includes('manager');
  if (role === 'staff') return !['pricing', 'packages', 'coupons', 'founders-club', 'jurisdictions', 'legal', 'seo', 'staff', 'settings', 'analytics'].includes(item.perm) || item.perm === 'analytics';
  return true;
}

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (pathname === '/admin/login') {
      setLoading(false);
      return;
    }
    fetch('/api/admin/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(d => { setUser(d.user); setLoading(false); })
      .catch(() => { router.replace('/admin/login'); });
  }, [pathname, router]);

  const logout = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'include' });
    try { localStorage.removeItem('ss_admin_token'); localStorage.removeItem('ss_admin_user'); } catch {}
    router.replace('/admin/login');
  };

  if (pathname === '/admin/login') return children;
  if (loading) return <div className="min-h-screen flex items-center justify-center text-emerald-700">Loading…</div>;
  if (!user) return null;

  const initials = (user.name || user.email || '?').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-[#0A3D34] text-white flex flex-col shrink-0 sticky top-0 h-screen overflow-y-auto">
        <div className="p-4 border-b border-white/10">
          <BrandMark size={40} variant="dark" showWordmark={true} />
          <div className="text-[9px] uppercase tracking-[0.25em] text-[#D4AF37]/80 font-semibold mt-1.5 pl-1">Admin Portal</div>
        </div>

        <div className="p-3 mb-2">
          <div className="bg-white/5 rounded-lg p-3 flex items-center gap-2.5 border border-white/10">
            <div className="w-9 h-9 rounded-full bg-[#D4AF37] text-[#0A3D34] flex items-center justify-center text-xs font-bold">{initials}</div>
            <div>
              <div className="text-sm font-semibold text-white leading-tight">{user.name || user.email}</div>
              <div className="text-[10px] capitalize text-[#D4AF37]">{user.role}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 pb-4 space-y-3">
          {NAV.map(grp => {
            const visible = grp.items.filter(it => canSee(it, user.role));
            if (!visible.length) return null;
            return (
              <div key={grp.group}>
                <div className="text-[10px] uppercase tracking-widest text-emerald-400/80 font-bold px-2 mb-1">{grp.group}</div>
                {visible.map(it => {
                  const Icon = it.icon;
                  const active = pathname === it.href || pathname.startsWith(it.href + '/');
                  return (
                    <Link key={it.href} href={it.href} data-testid={`nav-${it.perm}`}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition ${active ? 'bg-[#D4AF37]/15 text-[#D4AF37] border-l-2 border-[#D4AF37] font-semibold' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}>
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{it.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-emerald-900/50 space-y-2">
          <button onClick={logout} data-testid="logout-btn"
            className="w-full py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5">
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
          <div className="text-[9px] text-emerald-400/60 text-center">Lic: 262843696888</div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
