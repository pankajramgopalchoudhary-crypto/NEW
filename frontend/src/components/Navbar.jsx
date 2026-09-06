import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ChevronDown, ShieldCheck, LogOut, User, LayoutDashboard, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../context/AuthContext';
import { LanguageSelector } from './AriaWidgets';
import BrandLogo from './BrandLogo';

const NAV = [
  {
    label: 'AI Search',
    href: '/ai-search',
    accent: true,
  },
  {
    label: 'Business Setup',
    children: [
      { label: 'Free Zone Finder', href: '/free-zones' },
      { label: 'Mainland Setup', href: '/mainland' },
      { label: 'Compare Jurisdictions', href: '/compare' },
      { label: 'Activity Search', href: '/ai-search' },
      { label: 'Cost Calculator', href: '/calculator' },
    ],
  },
  {
    label: 'Visa Services',
    children: [
      { label: 'Golden Visa', href: '/golden-visa' },
      { label: 'Investor Visa', href: '/services/investor-visa' },
      { label: 'Employment Visa', href: '/services/employment-visa' },
      { label: 'Family Visa', href: '/services/family-visa' },
    ],
  },
  {
    label: 'Corporate Services',
    children: [
      { label: 'VAT Registration', href: '/services/vat-registration' },
      { label: 'Corporate Tax', href: '/services/corporate-tax' },
      { label: 'Accounting', href: '/services/accounting' },
      { label: 'PRO Services', href: '/services/pro-services' },
      { label: 'Compliance', href: '/services/compliance' },
    ],
  },
  {
    label: 'Resources',
    children: [
      { label: 'Blog', href: '/blog' },
      { label: 'FAQs', href: '/faqs' },
      { label: 'Career', href: '/careers' },
      { label: 'Founder Club', href: '/founder-club' },
    ],
  },
  {
    label: 'Company',
    children: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/consultation' },
      { label: 'Consultation', href: '/consultation' },
    ],
  },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState('');
  const [acct, setAcct] = useState(false);
  const acctRef = useRef(null);
  const navRef = useRef(null);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (acctRef.current && !acctRef.current.contains(e.target)) setAcct(false);
      if (navRef.current && !navRef.current.contains(e.target)) setOpenMenu('');
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => { setOpen(false); setOpenMenu(''); setAcct(false); }, [location.pathname]);

  const isActive = (href) => location.pathname === href;

  return (
    <header className={`sticky top-0 z-40 transition-all ${scrolled ? 'backdrop-blur-md bg-[#FFFCF5]/95 border-b border-emerald-900/10 shadow-sm' : 'bg-[#FFFCF5]/80 backdrop-blur-sm'}`}>
      <div className="max-w-[1480px] mx-auto px-4 lg:px-6">
        <div className="flex items-center h-[64px] gap-3">
          {/* LEFT: Logo */}
          <Link to="/" className="flex items-center group shrink-0 mr-auto notranslate" translate="no" data-testid="nav-logo-home">
            <BrandLogo variant="cream" className="h-7 lg:h-8 transition-transform group-hover:scale-[1.03]" />
          </Link>

          {/* CENTER: Navigation */}
          <nav ref={navRef} className="hidden lg:flex items-center gap-4 xl:gap-5 mx-2">
            {NAV.map((n) =>
              n.children ? (
                <div key={n.label} className="relative">
                  <button onClick={() => setOpenMenu((menu) => (menu === n.label ? '' : n.label))} className="text-sm font-medium text-slate-700 hover:text-slate-900 flex items-center gap-1 whitespace-nowrap link-underline">
                    {n.label} <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openMenu === n.label ? 'rotate-180' : ''}`} />
                  </button>
                  {openMenu === n.label && (
                    <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 w-60 bg-white rounded-2xl shadow-2xl border border-emerald-900/10 p-2 fade-up">
                      {n.children.map((c) => (
                        <Link key={c.href} to={c.href} className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${isActive(c.href) ? 'bg-emerald-50 brand-emerald' : 'text-slate-700 hover:bg-emerald-50 hover:brand-emerald'}`}>{c.label}</Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : n.accent ? (
                <Link
                  key={n.href}
                  to={n.href}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors ${
                    isActive(n.href)
                      ? 'bg-emerald-700 text-white shadow-md'
                      : 'bg-emerald-50 border border-emerald-700/25 text-emerald-800 hover:bg-emerald-100'
                  }`}
                  data-testid="nav-ai-search-link"
                >
                  <Sparkles className="h-3.5 w-3.5" /> {n.label}
                </Link>
              ) : (
                <Link key={n.href} to={n.href} className={`text-sm font-medium link-underline whitespace-nowrap ${isActive(n.href) ? 'brand-emerald' : 'text-slate-700 hover:text-slate-900'}`}>
                  {n.label}
                </Link>
              )
            )}
          </nav>

          {/* RIGHT: Account / CTA */}
          <div className="hidden lg:flex items-center gap-2 shrink-0 ml-auto">
            <LanguageSelector />
            {user && ['admin','founder','manager','staff','reviewer'].includes(user?.role) ? (
              // Admin user — show ONE "Admin" pill that doubles as account menu trigger
              <div className="relative" ref={acctRef}>
                <button onClick={() => setAcct((a) => !a)} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-full border border-amber-400 bg-amber-50 text-amber-900 text-[12.5px] font-semibold hover:bg-amber-100" data-testid="nav-admin-link">
                  <ShieldCheck className="h-3.5 w-3.5" /> Admin
                  <ChevronDown className={`h-3 w-3 transition-transform ${acct ? 'rotate-180' : ''}`} />
                </button>
                {acct && (
                  <div className="absolute top-full mt-2 right-0 w-56 bg-white rounded-2xl shadow-2xl border border-emerald-900/10 p-2 fade-up">
                    <Link to="/admin" className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:brand-emerald"><ShieldCheck className="h-4 w-4" /> Admin Panel</Link>
                    <Link to="/dashboard" className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:brand-emerald"><LayoutDashboard className="h-4 w-4" /> Dashboard</Link>
                    <Link to="/dashboard?tab=profile" className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:brand-emerald"><User className="h-4 w-4" /> Edit Profile</Link>
                    <button onClick={() => { logout(); navigate('/'); }} className="w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-red-50 hover:text-red-600"><LogOut className="h-4 w-4" /> Logout</button>
                  </div>
                )}
              </div>
            ) : user ? (
              <div className="relative" ref={acctRef}>
                <button onClick={() => setAcct((a) => !a)} className="flex items-center gap-2 px-3 py-2 rounded-full border border-slate-200 hover:border-emerald-700/30 bg-white transition-colors">
                  <div className="h-7 w-7 rounded-full bg-emerald-100 grid place-items-center brand-emerald font-bold text-xs">{(user.name || 'U').charAt(0).toUpperCase()}</div>
                  <span className="text-sm font-medium text-slate-700">{user.name?.split(' ')[0] || 'Account'}</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${acct ? 'rotate-180' : ''}`} />
                </button>
                {acct && (
                  <div className="absolute top-full mt-2 right-0 w-56 bg-white rounded-2xl shadow-2xl border border-emerald-900/10 p-2 fade-up">
                    <Link to="/dashboard" className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:brand-emerald"><LayoutDashboard className="h-4 w-4" /> Dashboard</Link>
                    <Link to="/dashboard?tab=profile" className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:brand-emerald"><User className="h-4 w-4" /> Edit Profile</Link>
                    <button onClick={() => { logout(); navigate('/'); }} className="w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-red-50 hover:text-red-600"><LogOut className="h-4 w-4" /> Logout</button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className="text-sm font-medium text-slate-700 hover:text-slate-900">Client Login</Link>
            )}
            <Button onClick={() => navigate('/consultation')} className="btn-primary rounded-full px-4 h-9 text-[13px] whitespace-nowrap" data-testid="nav-book-call">Book Free Call</Button>
          </div>

          {/* MOBILE TOGGLE + lang */}
          <div className="lg:hidden ml-auto flex items-center gap-2">
            <LanguageSelector idSuffix="-mobile" />
            <button className="p-2 -mr-2" onClick={() => setOpen(!open)} aria-label="Menu" data-testid="nav-mobile-toggle">
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE PANEL */}
      {open && (
        <div className="lg:hidden bg-[#FFFCF5] border-t border-emerald-900/10 max-h-[calc(100vh-72px)] overflow-y-auto">
          <div className="px-5 py-4 flex flex-col gap-1">
            <Link to="/ai-search" onClick={() => setOpen(false)} className="inline-flex items-center justify-center gap-2 py-3 mb-2 rounded-full bg-emerald-700 text-white font-semibold" data-testid="nav-mobile-ai-search">
              <Sparkles className="h-4 w-4" /> AI Search
            </Link>
            {NAV.map((n) => n.children ? (
              <div key={n.label} className="py-1">
                <div className="text-[11px] uppercase tracking-[0.2em] font-semibold text-slate-500 mt-2 mb-1 px-2">{n.label}</div>
                {n.children.map((c) => (
                  <Link key={c.href} to={c.href} className="block py-2 px-2 font-medium text-slate-800">{c.label}</Link>
                ))}
              </div>
            ) : (
              <Link key={n.href} to={n.href} className="py-2 px-2 font-medium text-slate-800">{n.label}</Link>
            ))}
            <div className="border-t border-emerald-900/10 my-2" />
            {user ? (
              <>
                <Link to="/dashboard" className="py-2 px-2 font-medium text-slate-800">Dashboard</Link>
                <button onClick={() => { logout(); navigate('/'); }} className="text-left py-2 px-2 font-medium text-red-600">Logout</button>
              </>
            ) : (
              <Link to="/login" className="py-2 px-2 font-medium text-slate-800">Client Login</Link>
            )}
            <Button onClick={() => navigate('/consultation')} className="btn-primary rounded-full mt-3">Book Free Consultation</Button>
          </div>
        </div>
      )}
    </header>
  );
}
