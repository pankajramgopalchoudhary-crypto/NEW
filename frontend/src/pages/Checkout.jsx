import React, { useEffect, useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';
import { COMPANY_INFO } from '../data/zones';
import { createCheckoutOrder, loadCheckoutPricing, markBankTransferSubmitted, getPrebookingAmount, getVisaPrice, getDefaultServiceFee } from '../lib/checkoutSupabase';
import { searchActivities } from '../lib/activitySearchService';
import { CheckCircle2, ChevronLeft, ChevronRight, CreditCard, Landmark, Upload, ShieldCheck, Sparkles, Building2, FileText, Tag, X } from 'lucide-react';
import PaymentProofUpload from '../components/PaymentProofUpload';
import CurrencySwitcher from '../components/CurrencySwitcher';

const COUNTRY_CODES = [
  { code: '+971', label: 'AE +971' },
  { code: '+91', label: 'IN +91' },
  { code: '+92', label: 'PK +92' },
  { code: '+966', label: 'SA +966' },
  { code: '+974', label: 'QA +974' },
  { code: '+965', label: 'KW +965' },
  { code: '+968', label: 'OM +968' },
  { code: '+973', label: 'BH +973' },
  { code: '+44', label: 'UK +44' },
  { code: '+1', label: 'US +1' },
];

const COUPONS = [
  { code: 'FIRST500', label: '100% off SmartSetupUAE service fee', percent: 100, appliesTo: 'service' },
  { code: 'SMARTSAVE12', label: '12% scratch-card discount', percent: 12, appliesTo: 'package' },
  { code: 'FOUNDER5', label: '5% Founder Club discount', percent: 5, appliesTo: 'package' },
];

const STEPS = [
  { id: 1, label: 'Package' },
  { id: 2, label: 'Details' },
  { id: 3, label: 'Payment' },
  { id: 4, label: 'Confirmed' },
];

function defaultDraft() {
  return {
    zone_slug: '',
    zone_name: '',
    mode: 'freezone',
    visa_count: 1,
    office_type: 'Virtual Desk',
    addons: [],
    package_id: null,
    package_name: '',
    total_aed: 0,
    contact: { name: '', email: '', phone_code: '+971', phone: '', residence_country: '', uae_address: '' },
    business: { activity: '', activities: [], company_names: ['', '', ''], shareholders: 1 },
  };
}

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [availableZones, setAvailableZones] = useState([]);
  const [availableAddons, setAvailableAddons] = useState([]);
  const [pricingLoaded, setPricingLoaded] = useState(false);
  const [pricingError, setPricingError] = useState('');
  const [activitySuggestions, setActivitySuggestions] = useState([]);
  const [activityCategory, setActivityCategory] = useState('All');
  const [couponCode, setCouponCode] = useState(() => localStorage.getItem('ssu_scratch_coupon_code') || 'FIRST500');

  const incoming = location.state?.order;
  const [draft, setDraft] = useState(() => ({ ...defaultDraft(), ...(incoming || {}) }));
  const [step, setStep] = useState(1);
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [payTab, setPayTab] = useState('card'); // 'card' | 'bank'
  const [payChoice, setPayChoice] = useState('full'); // 'reserve' | 'full'
  const [activityQuery, setActivityQuery] = useState('');
  const [bankProof, setBankProof] = useState({ file_base64: '', file_name: '', content_type: '', amount_aed: getPrebookingAmount(), reference: '', payer_name: '' });

  // Prefill contact from auth
  useEffect(() => {
    if (user && !draft.contact.email) {
      const t = setTimeout(() => {
        setDraft((d) => ({ ...d, contact: { ...d.contact, name: user.name || user.full_name || '', email: user.email || '', phone: user.phone || '' } }));
      }, 0);
      return () => clearTimeout(t);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle cancelled return
  useEffect(() => {
    if (params.get('cancelled')) {
      const t = setTimeout(() => {
        toast({ title: 'Payment cancelled', description: 'You can try again or pay via bank transfer.' });
      }, 0);
      return () => clearTimeout(t);
    }
  }, [params, toast]);

  const isFounderClubMember = user?.role === 'founder';
  const scratchReward = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('ssu_scratch_coupon') || 'null'); } catch { return null; }
  }, []);
  const dynamicCoupons = useMemo(() => {
    const allowedCoupons = COUPONS.filter((coupon) => coupon.code !== 'FOUNDER5' || isFounderClubMember);
    if (!scratchReward?.code || allowedCoupons.some((coupon) => coupon.code === scratchReward.code)) return allowedCoupons;
    return [...allowedCoupons, { code: scratchReward.code, label: `${scratchReward.discount}% scratch-card discount`, percent: Number(scratchReward.discount) || 0, appliesTo: 'package' }];
  }, [scratchReward, isFounderClubMember]);
  const selectedCoupon = dynamicCoupons.find((coupon) => coupon.code === couponCode) || dynamicCoupons[0];

  useEffect(() => {
    const coupon = params.get('coupon')?.toUpperCase();
    if (coupon && dynamicCoupons.some((c) => c.code === coupon)) {
      setCouponCode(coupon);
    }
    // Auto-add addon when ?addon=... is in URL (used by Dashboard "Join Founder Club" CTA)
    const requestedAddon = params.get('addon');
    if (requestedAddon === 'founder-club') {
      setDraft((d) => {
        if (d.addons.some((x) => x.id === 'founder-club')) return d;
        return { ...d, addons: [...d.addons, { id: 'founder-club', label: 'Founder Club Membership', price: 999 }] };
      });
    }
  }, [params, dynamicCoupons]);

  useEffect(() => {
    let cancelled = false;
    async function loadPricing() {
      try {
        const pricing = await loadCheckoutPricing();
        if (cancelled) return;
        setAvailableZones(pricing.zones);
        setAvailableAddons(pricing.addons);
        setPricingLoaded(true);
        setPricingError('');
      } catch (e) {
        if (cancelled) return;
        setPricingLoaded(false);
        setPricingError(e.message || 'Could not load live Supabase checkout pricing.');
        toast({ title: 'Could not load live pricing', description: e.message || 'Check Supabase checkout tables and policies.' });
      }
    }
    loadPricing();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    if (!availableZones.length) return;
    setDraft((d) => {
      const requestedFreezone = (params.get('freezone') || '').trim().toLowerCase();
      const requestedSlug = (params.get('zone') || params.get('slug') || '').trim().toLowerCase();
      const requestedPkg = (params.get('package') || params.get('pkg') || params.get('package_id') || '').trim();

      // Priority match order:
      // 1. Exact package_id from URL (if user clicked a specific package on FreeZoneDetail)
      // 2. Existing draft.package_id (preserve user's earlier selection)
      // 3. zone slug from URL (e.g., ?freezone=ifza or ?zone=ifza)
      // 4. Existing draft.zone_slug
      // 5. NEVER fall back to availableZones[0] if a freezone hint was provided —
      //    instead, return d unchanged and surface a warning. This was the source
      //    of the "selected IFZA but checkout shows ANCFZ" loop hole.
      const candidateKeys = [
        requestedPkg,
        d.package_id,
        requestedFreezone,
        requestedSlug,
        d.zone_slug,
      ].filter(Boolean).map((k) => String(k).toLowerCase());

      let matched = null;
      for (const key of candidateKeys) {
        matched = availableZones.find((z) => {
          const ids = [z.package_id, z.selection_id, z.slug, z.id].filter(Boolean).map((v) => String(v).toLowerCase());
          if (ids.includes(key)) return true;
          // Loose match on zone name (handles "ifza" vs "IFZA Dubai")
          const name = String(z.name || z.zone_name || '').toLowerCase();
          if (key && name.includes(key)) return true;
          return false;
        });
        if (matched) break;
      }

      // Only fall back to availableZones[0] if NO freezone hint was provided at all
      // (i.e. user came directly to /checkout without selecting anything).
      if (!matched) {
        if (requestedFreezone || requestedSlug || requestedPkg || d.zone_slug) {
          // User picked something but we couldn't find it → keep their old selection
          // (don't silently swap to ANCFZ). Log a warning for debugging.
          if (typeof console !== 'undefined') {
            console.warn('[Checkout] No match for requested freezone:', { requestedFreezone, requestedSlug, requestedPkg, available: availableZones.map((z) => z.slug) });
          }
          return d; // no change → caller can show a "freezone not found" message
        }
        matched = availableZones[0];
      }

      return {
        ...d,
        zone_slug: matched.slug,
        zone_name: matched.name,
        package_id: matched.package_id || matched.selection_id || null,
        package_name: matched.package_name || matched.name,
        visa_count: Math.min(Number(d.visa_count || 0), Math.max(0, Number(matched.visa_quota || 0))),
        contact: {
          ...d.contact,
          name: d.contact.name || params.get('name') || '',
          email: d.contact.email || params.get('email') || '',
          phone_code: d.contact.phone_code || params.get('phone_code') || '+971',
          phone: d.contact.phone || params.get('phone') || '',
        },
        business: {
          ...d.business,
          activity: d.business.activity || params.get('activity') || '',
        },
        addons: d.addons.map((a) => {
          const live = availableAddons.find((x) => x.id === a.id || x.addon_id === a.addon_id);
          return live ? { id: live.id, addon_id: live.addon_id, label: live.label, price: live.price } : a;
        }),
      };
    });
  }, [availableZones, availableAddons, params]);

  const zones = availableZones;
  const addonsData = availableAddons;
  const selectedPackageKey = draft.package_id || draft.zone_slug;
  const hasLockedSelection = Boolean(
    params.get('freezone') || params.get('zone') || params.get('slug') || params.get('package') || params.get('pkg') || params.get('package_id')
  );
  const currentZone = zones.find((z) => (z.package_id || z.selection_id || z.slug) === selectedPackageKey)
    || (hasLockedSelection ? null : zones[0])
    || null;
  const selectableZones = hasLockedSelection && currentZone ? [currentZone] : zones;
  const originalServiceFee = currentZone?.svc || getDefaultServiceFee();
  const serviceFeeAfterDiscount = selectedCoupon.appliesTo === 'service' ? 0 : originalServiceFee;
  const packageDiscount = selectedCoupon.appliesTo === 'package' ? Math.round((currentZone?.gov || 0) * (selectedCoupon.percent / 100)) : 0;

  // ----- Name Reservation fee logic (Phase 10) -----
  // UAE-style rules:
  //   • Base reservation fee per package (default AED 620 free zone / AED 220 mainland).
  //   • Premium / restricted words ("Global", "International", "Group", "Holding",
  //     "Industries", "Universal", "Emirates", "National", "Middle East") add AED 2,000.
  //   • Each additional preferred name (beyond the first) adds AED 100.
  //   • Free for Founder Club members on first name only.
  const PREMIUM_NAME_WORDS = /\b(global|international|industries|holding|holdings|group|universal|emirates|middle\s*east|national|gulf|arabian|royal|imperial)\b/i;
  const nameReservation = useMemo(() => {
    const list = (draft.business.company_names || []).filter((n) => String(n || '').trim().length > 1);
    if (list.length === 0) return { fee: 0, breakdown: [] };
    const base = draft.mode === 'mainland' ? 220 : 620;
    const items = [{ label: 'Trade name reservation (1st choice)', amount: isFounderClubMember ? 0 : base }];
    list.slice(1).forEach((n, i) => {
      items.push({ label: `Backup name #${i + 2} (${n})`, amount: 100 });
    });
    list.forEach((n) => {
      if (PREMIUM_NAME_WORDS.test(n)) {
        items.push({ label: `Premium-word surcharge ("${n}")`, amount: 2000 });
      }
    });
    const fee = items.reduce((s, x) => s + x.amount, 0);
    return { fee, breakdown: items };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.business.company_names, draft.mode, isFounderClubMember]);
  const hasNameViolation = (draft.business.company_names || []).some(
    (n) => n && n.length > 0 && n.length < 3
  );

  const breakdown = useMemo(() => {
    const items = [
      { l: `${draft.zone_name || currentZone?.name || 'Selected package'} — Trade Licence (Year 1)`, v: currentZone?.gov || 0, type: 'zone', slug: currentZone?.slug },
      ...(draft.visa_count > 0 ? [{ l: `Investor visa x ${draft.visa_count}`, v: getVisaPrice(draft.zone_name) * draft.visa_count, type: 'visa', count: draft.visa_count }] : []),
      ...draft.addons.map((a) => ({ l: a.label, v: a.price, type: 'addon', id: a.id })),
      ...(packageDiscount > 0 ? [{ l: `${selectedCoupon.code} discount`, v: -packageDiscount, type: 'discount' }] : []),
      ...(nameReservation.fee > 0
        ? [{ l: `Trade name reservation (${nameReservation.breakdown.length} item${nameReservation.breakdown.length > 1 ? 's' : ''})`, v: nameReservation.fee, type: 'name_reservation', details: nameReservation.breakdown }]
        : []),
      { l: 'SmartSetupUAE service & advisory', v: serviceFeeAfterDiscount, original: originalServiceFee, type: 'service' },
    ];
    const total = items.reduce((s, x) => s + x.v, 0);

    // Savings: pre-discount total (original service fee + no package discount) vs current
    const grossTotal = items.reduce((s, x) => {
      if (x.type === 'discount') return s; // exclude negative line
      if (x.type === 'service') return s + (x.original || x.v);
      return s + x.v;
    }, 0);
    const totalSaved = Math.max(0, grossTotal - total);
    const savedPct = grossTotal > 0 ? Math.round((totalSaved / grossTotal) * 100) : 0;
    return { items, total, grossTotal, totalSaved, savedPct };
  }, [draft, currentZone, packageDiscount, selectedCoupon, serviceFeeAfterDiscount, originalServiceFee, nameReservation]);

  const payAmount = payChoice === 'full' ? breakdown.total : getPrebookingAmount();

  // ----- Activity-limit enforcement (Phase 6) -----
  // from package tier / visa quota (UAE free-zone norm: Basic 3, Growth 5, Premium 7+).
  function deriveActivityLimit(zone) {
    if (!zone) return 3;
    const explicit = Number(zone.activities_allowed ?? zone.raw?.activities_allowed);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const pkgName = String(zone.package_name || '').toLowerCase();
    if (/(premium|elite|platinum|industrial)/.test(pkgName)) return 7;
    if (/(growth|standard|business)/.test(pkgName)) return 5;
    if (/(basic|starter|essential|virtual)/.test(pkgName)) return 3;
    const visas = Number(zone.visa_quota || 0);
    if (visas >= 3) return 7;
    if (visas >= 1) return 5;
    return 3;
  }
  const activityLimit = deriveActivityLimit(currentZone);
  const selectedActivities = draft.business.activities || [];
  const selectedActivityMeta = draft.business.activity_meta || {};
  const selectedGroups = Array.from(
    new Set(Object.values(selectedActivityMeta).map((m) => m?.industry_group).filter(Boolean))
  );
  const primaryGroup = selectedGroups[0] || null;
  const groupMixed = selectedGroups.length > 1;

  // Accept either a raw activity object (preferred) or a plain string.
  const addActivity = (activity) => {
    const isString = typeof activity === 'string';
    const name = isString ? activity : activity?.activity_name;
    if (!name) return;
    const industryGroup = isString ? null : (activity?.industry_group || null);
    const activityCode = isString ? null : (activity?.activity_code || null);

    setActivityQuery('');
    setActivitySuggestions([]);
    setDraft((d) => {
      const list = d.business.activities || [];
      const meta = { ...(d.business.activity_meta || {}) };
      if (list.includes(name)) return d;
      if (list.length >= activityLimit) {
        toast({
          title: 'Activity limit reached',
          description: `This package allows ${activityLimit} activities. Upgrade your package to add more.`,
        });
        return d;
      }
      // Soft warning when mixing industry groups (DED restriction on most packages) — once per session only
      const currentGroups = Array.from(
        new Set(Object.values(meta).map((m) => m?.industry_group).filter(Boolean))
      );
      if (industryGroup && currentGroups.length && !currentGroups.includes(industryGroup)) {
        if (!sessionStorage.getItem('ssu_industry_warned')) {
          toast({
            title: 'Industry group mismatch',
            description: `Most UAE packages only allow activities from one industry group. You already picked from "${currentGroups[0]}". Adding "${industryGroup}" may require a multi-group licence.`,
          });
          sessionStorage.setItem('ssu_industry_warned', '1');
        }
      }
      const activities = [...list, name];
      meta[name] = { industry_group: industryGroup, activity_code: activityCode };
      return {
        ...d,
        business: { ...d.business, activities, activity: activities[0], activity_meta: meta },
      };
    });
  };

  const removeActivity = (name) => {
    setDraft((d) => {
      const activities = (d.business.activities || []).filter((a) => a !== name);
      const meta = { ...(d.business.activity_meta || {}) };
      delete meta[name];
      return {
        ...d,
        business: { ...d.business, activities, activity: activities[0] || '', activity_meta: meta },
      };
    });
  };

  // Quick way to jump the user to a higher-tier package when they hit the limit.
  const upgradePackage = () => {
    if (!zones.length) return;
    const idxNow = zones.findIndex((z) => (z.package_id || z.selection_id || z.slug) === selectedPackageKey);
    // Find the next zone with a higher activity allowance
    const next = zones
      .map((z, i) => ({ z, i, lim: deriveActivityLimit(z) }))
      .filter((x) => x.i !== idxNow && x.lim > activityLimit)
      .sort((a, b) => a.lim - b.lim)[0];
    if (!next) {
      toast({ title: 'No higher package available', description: 'Request a custom quote for more activities.' });
      return;
    }
    setDraft((d) => ({
      ...d,
      zone_slug: next.z.slug,
      zone_name: next.z.name,
      package_id: next.z.package_id || next.z.selection_id || null,
      package_name: next.z.package_name || next.z.name,
    }));
    toast({
      title: 'Package upgraded',
      description: `Switched to ${next.z.name}${next.z.package_name ? ' · ' + next.z.package_name : ''} (up to ${next.lim} activities).`,
    });
  };

  useEffect(() => {
    const term = activityQuery.trim();
    const categoryTerm = activityCategory !== 'All' ? activityCategory : '';
    const finalTerm = term.length >= 2 ? term : categoryTerm;
    if (!finalTerm) {
      setActivitySuggestions([]);
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      try {
        setActivitySuggestions(await searchActivities(finalTerm, { limit: 12 }));
      } catch (err) {
        console.warn('[checkout] searchActivities failed', err);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [activityQuery, activityCategory]);

  // ----- Step 1 actions -----
  const upd = (path, value) => {
    setDraft((d) => {
      const next = { ...d };
      const keys = path.split('.');
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = { ...obj[keys[i]] };
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const next = async () => {
    if (step === 2) {
      const { name, email, phone } = draft.contact;
      if (!name || !email || !phone) return toast({ title: 'Add name, email and phone' });
      if (name.trim().split(/\s+/).length < 2) {
        return toast({
          title: 'Use your full passport name',
          description: 'Enter first + last name (and middle if applicable). Rejections due to incomplete names are non-refundable.',
        });
      }
      if (!draft.business.activities || draft.business.activities.length === 0) return toast({ title: 'Add at least one business activity' });
    }
    if (step === 2) {
      // Create the order now
      setBusy(true);
      try {
        const data = await createCheckoutOrder({ ...draft, total_aed: breakdown.total }, breakdown.total, user);
        setOrder(data);
        if (data?.claim_token) {
          try { sessionStorage.setItem(`ssu_order_${data.id}`, data.claim_token); } catch (err) { console.warn('[checkout] could not cache order claim token', err); }
        }
        setStep(3);
      } catch (e) {
        toast({ title: 'Could not create order', description: e.message || 'Please try again.' });
      } finally {
        setBusy(false);
      }
      return;
    }
    setStep((s) => Math.min(4, s + 1));
  };

  const back = () => setStep((s) => Math.max(1, s - 1));

  // ----- Stripe pay -----
  const payCard = async () => {
    if (!order) return;
    toast({
      title: 'Card payment not enabled yet',
      description: 'This build now saves the order in Supabase. Use bank transfer until a Stripe Edge Function is connected.',
    });
    setPayTab('bank');
  };

  // ----- Bank proof -----
  const onProofFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) return toast({ title: 'File too large (max 4MB)' });
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const b64 = result.split(',')[1] || '';
      setBankProof((p) => ({ ...p, file_base64: b64, file_name: f.name, content_type: f.type || 'application/octet-stream' }));
    };
    reader.readAsDataURL(f);
  };

  const submitBankProof = async () => {
    if (!order) return;
    if (!bankProof.file_base64) return toast({ title: 'Please attach the bank transfer receipt' });
    if (!bankProof.payer_name) return toast({ title: 'Add the payer name' });
    setBusy(true);
    try {
      const amount = payChoice === 'full' ? breakdown.total : getPrebookingAmount();
      await markBankTransferSubmitted(order, { ...bankProof, reference: order.reference, amount_aed: amount, payment_choice: payChoice });
      toast({ title: 'Proof received', description: 'We will verify within 24 hours.' });
      // Founder Club: persist membership in Supabase (RLS-protected) — falls back gracefully if tables aren't migrated.
      if (draft.addons?.some((x) => x.id === 'founder-club') && draft.contact?.email) {
        try {
          const { activateMembership } = await import('../lib/dashboardSupabase');
          await activateMembership(draft.contact.email, 'founder_club', order.reference);
        } catch (err) {
          console.warn('[checkout] activateMembership fallback failed', err);
        }
        try { localStorage.setItem(`ssu_founder_${draft.contact.email.toLowerCase()}`, '1'); } catch (err) { console.warn('[checkout] could not persist founder flag', err); }
      }
      const queryParams = new URLSearchParams({
        reference: order.reference,
        amount: String(amount),
        zone: draft.zone_name || '',
        package: draft.package_name || '',
        name: draft.contact?.name || '',
        bank: 'true',
      });
      navigate(`/checkout/success?${queryParams.toString()}`);
    } catch (e) {
      toast({ title: 'Upload failed', description: e.message || 'Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const handleBreakdownClick = (item) => {
    if (item.type === 'zone' && item.slug) {
      const zone = zones.find((z) => z.slug === item.slug);
      if (zone) {
        setDraft((d) => ({ ...d, zone_slug: zone.slug, zone_name: zone.name }));
      }
      setStep(1);
      return;
    }

    if (item.type === 'addon' && item.id) {
      const addon = addonsData.find((a) => a.id === item.id);
      if (!addon) return;
      setDraft((d) => {
        const has = d.addons.some((x) => x.id === addon.id);
        return {
          ...d,
          addons: has
            ? d.addons.filter((x) => x.id !== addon.id)
            : [...d.addons, { id: addon.id, label: addon.label, price: addon.price }],
        };
      });
      setStep(1);
      return;
    }

    if (item.type === 'visa') {
      setStep(1);
      return;
    }

    if (item.type === 'service') {
      return;
    }
  };

  return (
    <div>
      <Navbar />
      <section className="hero-gradient grain">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 pt-10 pb-6">
          <div className="flex items-center gap-2 fade-up"><Sparkles className="h-4 w-4 brand-bronze" /><span className="text-xs uppercase tracking-[0.22em] text-slate-600 font-semibold">Secure Checkout</span></div>
          <h1 className="mt-3 font-display text-4xl lg:text-5xl font-semibold leading-[1.02] text-slate-900 fade-up delay-100">Simple setup<br /><span className="shine-text">in just three steps.</span></h1>

          {/* Stepper */}
          <div className="mt-8 flex items-center gap-2 lg:gap-4 fade-up delay-200" data-testid="checkout-stepper">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.id}>
                <div className={`flex items-center gap-2 ${s.id <= step ? 'opacity-100' : 'opacity-50'}`}>
                  <div className={`h-9 w-9 rounded-full grid place-items-center text-sm font-bold ${s.id < step ? 'bg-brand-emerald text-white' : s.id === step ? 'bg-amber-100 brand-bronze ring-2 ring-amber-300' : 'bg-white border border-slate-200 text-slate-500'}`}>
                    {s.id < step ? <CheckCircle2 className="h-4 w-4" /> : s.id}
                  </div>
                  <div className="hidden sm:block text-xs font-semibold text-slate-700">{s.label}</div>
                </div>
                {i < STEPS.length - 1 && <div className={`flex-1 h-px ${s.id < step ? 'bg-brand-emerald' : 'bg-slate-200'}`} />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 py-10 grid lg:grid-cols-3 gap-8">
          {/* MAIN */}
          <div className="lg:col-span-2 card-elevated rounded-3xl p-7 lg:p-9" data-testid="checkout-main">
            {!pricingLoaded && !pricingError && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">Loading live Supabase checkout pricing…</div>
            )}
            {pricingError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{pricingError}</div>
            )}

            {pricingLoaded && (<>
            {/* Step 1 — Package review */}
            {step === 1 && (
              <div className="space-y-5 fade-up" data-testid="step-1">
                <div className="flex items-center gap-2 text-brand-emerald font-semibold"><Building2 className="h-4 w-4" /> Select your free zone & package</div>

                {/* 1a) Free-zone card picker */}
                <div data-testid="zone-picker">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Free Zone or Jurisdiction</label>
                  {(() => {
                    // Group packages by zone_slug + zone_name
                    const byZone = new Map();
                    selectableZones.forEach((z) => {
                      const key = z.slug || z.zone_slug || z.name;
                      if (!byZone.has(key)) byZone.set(key, { name: z.name, slug: key, items: [] });
                      byZone.get(key).items.push(z);
                    });
                    const zoneList = Array.from(byZone.values());
                    const currentZoneKey = currentZone?.slug || currentZone?.zone_slug;
                    return (
                      <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[280px] overflow-y-auto pr-1" data-testid="zone-card-grid">
                        {zoneList.map((zg) => {
                          const cheapest = zg.items.reduce(
                            (min, x) => ((x.gov || Infinity) < (min.gov || Infinity) ? x : min),
                            zg.items[0]
                          );
                          const isSelected = zg.slug === currentZoneKey;
                          return (
                            <button
                              key={zg.slug}
                              type="button"
                              onClick={() => {
                                setDraft((d) => ({
                                  ...d,
                                  zone_slug: cheapest.slug,
                                  zone_name: cheapest.name,
                                  package_id: cheapest.package_id || cheapest.selection_id || null,
                                  package_name: cheapest.package_name || cheapest.name,
                                  visa_count: Math.min(Number(d.visa_count || 0), Math.max(0, Number(cheapest.visa_quota || 0))),
                                }));
                              }}
                              data-testid={`zone-card-${zg.slug}`}
                              className={`relative text-left p-3 rounded-xl border-2 transition-all ${
                                isSelected
                                  ? 'border-emerald-700 bg-emerald-50 ring-2 ring-emerald-700/15'
                                  : 'border-slate-200 bg-white hover:border-emerald-400'
                              }`}
                            >
                              {cheapest.tag && (
                                <span className="absolute -top-2 right-2 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">{cheapest.tag}</span>
                              )}
                              <div className="font-display text-sm font-semibold text-slate-900 truncate">{zg.name}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                                {cheapest.processing_time && <span>⏱ {cheapest.processing_time}</span>}
                                {cheapest.visa_quota ? <span>👥 {cheapest.visa_quota}v</span> : null}
                              </div>
                              <div className="mt-1.5 text-[11px] text-slate-600">From <span className="font-bold text-slate-900">AED {(cheapest.gov || 0).toLocaleString()}</span></div>
                              <div className="text-[9px] text-slate-400">{zg.items.length} package{zg.items.length > 1 ? 's' : ''}</div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* 1b) Package within selected zone */}
                {(() => {
                  const same = zones.filter((z) => z.slug === currentZone?.slug);
                  if (same.length <= 1) return null;
                  return (
                    <div data-testid="package-picker">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{currentZone?.name} package</label>
                      <Select value={selectedPackageKey} onValueChange={(key) => {
                        const z = zones.find((x) => (x.package_id || x.selection_id || x.slug) === key);
                        if (z) setDraft((d) => ({
                          ...d,
                          zone_slug: z.slug,
                          zone_name: z.name,
                          package_id: z.package_id || null,
                          package_name: z.package_name || z.name,
                          visa_count: Math.min(Number(d.visa_count || 0), Math.max(0, Number(z.visa_quota || 0))),
                        }));
                      }}>
                        <SelectTrigger className="mt-1 h-11 rounded-lg" data-testid="package-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {same.map((z) => (
                            <SelectItem key={z.package_id || z.selection_id || z.slug} value={z.package_id || z.selection_id || z.slug}>
                              {z.package_name || z.name} — AED {(z.gov || 0).toLocaleString()}
                              {z.visa_quota ? ` · ${z.visa_quota} visa${z.visa_quota > 1 ? 's' : ''}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })()}

                {/* Quick Options */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Visas</label>
                    <Select value={String(draft.visa_count)} onValueChange={(v) => upd('visa_count', Number(v))}>
                      <SelectTrigger className="mt-1 h-11 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const cap = Number(currentZone?.visa_quota || 0);
                          return Array.from({ length: cap + 1 }, (_, n) => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                    {currentZone?.visa_quota ? (
                      <p className="text-[10px] text-slate-400 mt-1">Package includes up to {currentZone.visa_quota}</p>
                    ) : null}
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Office Space</label>
                    <Select value={draft.office_type} onValueChange={(v) => upd('office_type', v)}>
                      <SelectTrigger className="mt-1 h-11 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{['Virtual Desk','Flexi Desk','Private Office'].map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Coupon</label>
                    <Select value={couponCode} onValueChange={setCouponCode}>
                      <SelectTrigger className="mt-1 h-11 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{dynamicCoupons.map((coupon) => <SelectItem key={coupon.code} value={coupon.code}>{coupon.code}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Add-ons */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 block mb-3">Optional Services (Click to Add)</label>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {addonsData
                      .filter((a) => Number(a.price) > 0)
                      .filter((a) => !/(retail package|pay as you go|branch registration)/i.test(a.label))
                      .slice(0, 6)
                      .map((a) => {
                      const checked = draft.addons.some((x) => x.id === a.id);
                      const unit = (a.unit && a.unit.toLowerCase() !== 'flat') ? `/${a.unit}` : '';
                      return (
                        <label key={a.id} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-sm transition ${checked ? 'border-emerald-500 bg-emerald-50 font-medium' : 'border-slate-300 bg-white hover:border-emerald-300'}`} data-testid={`addon-${a.id}`}>
                          <input type="checkbox" checked={checked} onChange={(e) => {
                            setDraft((d) => ({
                              ...d,
                              addons: e.target.checked
                                ? [...d.addons, { id: a.id, label: a.label, price: a.price }]
                                : d.addons.filter((x) => x.id !== a.id),
                            }));
                          }} className="accent-emerald-600" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-800 truncate">{a.label}</div>
                            <div className="text-xs text-slate-500">AED {a.price.toLocaleString()}{unit}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 — Contact & Business Details */}
            {step === 2 && (
              <div className="space-y-6 fade-up" data-testid="step-2">
                {/* Contact Section */}
                <div>
                  <div className="flex items-center gap-2 text-brand-emerald font-semibold mb-4"><ShieldCheck className="h-4 w-4" /> Your Information</div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Full Name (as per passport — first + middle + last) *</label>
                      <Input data-testid="contact-name" value={draft.contact.name} onChange={(e) => upd('contact.name', e.target.value)} className="mt-1 h-11 rounded-lg" placeholder="e.g. John Michael Smith" />
                      {draft.contact.name && draft.contact.name.trim().split(/\s+/).length < 2 && (
                        <p className="mt-1 text-[11px] text-rose-600" data-testid="contact-name-warning">
                          Enter your full name exactly as on passport (first + last minimum). Rejection due to incomplete names is non-refundable.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Email</label>
                      <Input data-testid="contact-email" type="email" value={draft.contact.email} onChange={(e) => upd('contact.email', e.target.value)} className="mt-1 h-11 rounded-lg" placeholder="you@company.com" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Phone / WhatsApp</label>
                      <div className="mt-1 grid grid-cols-[100px_1fr] gap-2">
                        <Select value={draft.contact.phone_code || '+971'} onValueChange={(v) => upd('contact.phone_code', v)}>
                          <SelectTrigger className="h-11 rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent>{COUNTRY_CODES.map((c) => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Input data-testid="contact-phone" value={draft.contact.phone} onChange={(e) => upd('contact.phone', e.target.value.replace(/[^0-9 ]/g, ''))} className="h-11 rounded-lg" placeholder="50 123 4567" />
                      </div>
                    </div>

                    {/* Residency — drives whether we capture UAE address for company registration */}
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Where do you currently reside?</label>
                      <Select value={draft.contact.residence_country || ''} onValueChange={(v) => upd('contact.residence_country', v)}>
                        <SelectTrigger className="mt-1 h-11 rounded-lg" data-testid="contact-residence-select"><SelectValue placeholder="Select country (optional)" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UAE">United Arab Emirates (resident)</SelectItem>
                          <SelectItem value="IN">India</SelectItem>
                          <SelectItem value="PK">Pakistan</SelectItem>
                          <SelectItem value="SA">Saudi Arabia</SelectItem>
                          <SelectItem value="QA">Qatar</SelectItem>
                          <SelectItem value="GB">United Kingdom</SelectItem>
                          <SelectItem value="US">United States</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* UAE address — shown only for UAE residents; OPTIONAL.
                        Used by the registrar for serving notices to local partners /
                        Emirates ID renewal mailers. Founders outside UAE skip this. */}
                    {draft.contact.residence_country === 'UAE' && (
                      <div data-testid="uae-address-block">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          UAE address for company registration <span className="brand-bronze">(optional — can be added later)</span>
                        </label>
                        <Input
                          data-testid="contact-uae-address"
                          value={draft.contact.uae_address || ''}
                          onChange={(e) => upd('contact.uae_address', e.target.value)}
                          className="mt-1 h-11 rounded-lg"
                          placeholder="Flat / Villa, Building, Area, Emirate (e.g. Apt 1203, Marina Heights, Dubai Marina, Dubai)"
                        />
                        <p className="mt-1 text-[10.5px] text-slate-500">
                          Optional — used by the registrar for postal notices. You can complete this from your dashboard once your trade name is approved.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Business Section */}
                <div className="pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-brand-emerald font-semibold"><FileText className="h-4 w-4" /> Business Activities</div>
                    <span data-testid="activity-counter" className={`text-xs font-bold px-2.5 py-1 rounded-full ${selectedActivities.length >= activityLimit ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 brand-emerald'}`}>
                      {selectedActivities.length} / {activityLimit} Activities Used
                    </span>
                  </div>

                  <div className="space-y-3">
                    {/* Category tabs */}
                    <div className="flex flex-wrap gap-1.5" data-testid="activity-category-tabs">
                      {['All', 'Publishing & Media', 'Services & Consulting', 'E-Commerce & Digital', 'Trading & Retail'].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setActivityCategory(cat)}
                          data-testid={`activity-cat-${cat.replace(/\W+/g, '-').toLowerCase()}`}
                          className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border transition ${
                            activityCategory === cat
                              ? 'bg-emerald-700 text-white border-emerald-700'
                              : 'bg-white text-slate-700 border-slate-300 hover:border-emerald-500'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    {/* Popular activities for this zone — quick add */}
                    {(() => {
                      const POPULAR = [
                        { name: 'General Trading', group: 'Trading & Retail', restrictedZones: ['shams', 'spc-free-zone', 'twofour54', 'dhcc'] },
                        { name: 'E-Commerce', group: 'E-Commerce & Digital', restrictedZones: [] },
                        { name: 'Management Consultancies', group: 'Services & Consulting', restrictedZones: [] },
                        { name: 'IT Services', group: 'E-Commerce & Digital', restrictedZones: [] },
                        { name: 'Real Estate Brokerage', group: 'Trading & Retail', restrictedZones: ['shams', 'spc-free-zone', 'twofour54', 'dhcc', 'difc'] },
                        { name: 'Logistics Services', group: 'Trading & Retail', restrictedZones: ['shams', 'twofour54', 'difc', 'dhcc'] },
                        { name: 'Tourism Services', group: 'Services & Consulting', restrictedZones: ['difc', 'twofour54'] },
                        { name: 'Marketing & Advertising', group: 'Publishing & Media', restrictedZones: [] },
                      ];
                      const zoneSlug = (currentZone?.slug || '').toLowerCase();
                      const popular = POPULAR.filter((p) => !p.restrictedZones.includes(zoneSlug));
                      const atLimit = selectedActivities.length >= activityLimit;
                      return (
                        <div data-testid="popular-activities">
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">
                            Popular activities for {currentZone?.name || 'this zone'}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {popular.map((p) => {
                              const already = selectedActivities.includes(p.name);
                              return (
                                <button
                                  key={p.name}
                                  type="button"
                                  disabled={already || atLimit}
                                  onClick={() => addActivity({ activity_name: p.name, industry_group: p.group, activity_code: '' })}
                                  data-testid={`popular-act-${p.name.replace(/\W+/g, '-').toLowerCase()}`}
                                  className={`text-[11px] font-medium px-3 py-1.5 rounded-full border transition ${
                                    already
                                      ? 'bg-emerald-700 text-white border-emerald-700 cursor-default'
                                      : atLimit
                                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                      : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                  }`}
                                >
                                  {already ? '✓ ' : '+ '}{p.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    <div className="relative">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Search & add activities (DED list)</label>
                      <Input
                        data-testid="business-activity"
                        value={activityQuery}
                        onChange={(e) => setActivityQuery(e.target.value)}
                        disabled={selectedActivities.length >= activityLimit}
                        className="mt-1 h-11 rounded-lg"
                        placeholder={selectedActivities.length >= activityLimit ? `Limit of ${activityLimit} reached` : 'e.g., E-Commerce, Consultancy, Trading'}
                      />
                      {activitySuggestions.length > 0 && (
                        <div className="absolute z-30 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                          {activitySuggestions.map((activity) => (
                            <button
                              key={activity.id}
                              type="button"
                              data-testid={`activity-suggestion-${activity.id}`}
                              onClick={() => addActivity(activity)}
                              className="block w-full px-4 py-2 text-left text-sm hover:bg-emerald-50 border-b border-slate-100 last:border-0"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-900 truncate">{activity.activity_name}</div>
                                  {activity.industry_group && (
                                    <div className="text-[10px] text-slate-500 truncate">{activity.industry_group}</div>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400 shrink-0">{activity.activity_code}</span>
                                {primaryGroup && activity.industry_group && activity.industry_group !== primaryGroup && (
                                  <span
                                    title="Different industry group"
                                    className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0"
                                  >
                                    Mixed
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {selectedActivities.length > 0 && (
                      <div className="flex flex-wrap gap-2" data-testid="selected-activities">
                        {selectedActivities.map((a) => (
                          <span key={a} className="inline-flex items-center gap-1.5 text-xs font-medium bg-emerald-600 text-white pl-3 pr-2 py-1.5 rounded-full">
                            {a}
                            <button type="button" onClick={() => removeActivity(a)} data-testid={`remove-activity-${a}`} className="hover:bg-white/20 rounded-full p-0.5"><X className="h-3 w-3" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] text-slate-500">
                        This package allows up to <span className="font-semibold text-slate-700">{activityLimit}</span> activit{activityLimit === 1 ? 'y' : 'ies'}.{' '}
                        {groupMixed && <span className="text-amber-700 font-semibold">Mixed industry groups — may need multi-group licence.</span>}
                      </p>
                      {selectedActivities.length >= activityLimit && (
                        <button
                          type="button"
                          onClick={upgradePackage}
                          data-testid="upgrade-package-btn"
                          className="text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200 ring-1 ring-amber-200 transition shrink-0"
                        >
                          Upgrade Package →
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-4">
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Number of Shareholders</label>
                      <Select value={String(draft.business.shareholders)} onValueChange={(v) => upd('business.shareholders', Number(v))}>
                        <SelectTrigger className="mt-1 h-11 rounded-lg"><SelectValue /></SelectTrigger>
                        <SelectContent>{[1,2,3,4,5].map((n) => (<SelectItem key={n} value={String(n)}>{n}</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Phase 10 — Trade Name Preferences with live reservation fee */}
                  <div className="mt-5" data-testid="name-reservation-section">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Trade Name Preferences (1st, 2nd, 3rd)</label>
                      {nameReservation.fee > 0 && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800" data-testid="name-fee-pill">
                          + AED {nameReservation.fee.toLocaleString()} reservation
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      {[0, 1, 2].map((i) => {
                        const value = (draft.business.company_names || [])[i] || '';
                        const isPremium = value && /\b(global|international|industries|holding|holdings|group|universal|emirates|middle\s*east|national|gulf|arabian|royal|imperial)\b/i.test(value);
                        return (
                          <div key={i} className="relative">
                            <Input
                              data-testid={`company-name-${i}`}
                              value={value}
                              onChange={(e) => {
                                const next = [...(draft.business.company_names || ['', '', ''])];
                                next[i] = e.target.value;
                                upd('business.company_names', next);
                              }}
                              placeholder={i === 0 ? 'e.g. Bluepeak Trading LLC' : `Backup name #${i + 1}`}
                              className="h-11 rounded-lg pr-24"
                            />
                            {isPremium && (
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800" title="Premium word — +AED 2,000">
                                Premium +2K
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {hasNameViolation && (
                      <p className="mt-1 text-[11px] text-rose-600">Each trade name needs to be at least 3 characters.</p>
                    )}
                    {nameReservation.breakdown.length > 0 && (
                      <ul className="mt-2 text-[11px] text-slate-500 space-y-0.5" data-testid="name-fee-breakdown">
                        {nameReservation.breakdown.map((b) => (
                          <li key={b.label || b.amount || Math.random()} className="flex items-center justify-between">
                            <span>· {b.label}</span>
                            <span className="font-mono">{b.amount === 0 ? 'FREE' : `AED ${b.amount.toLocaleString()}`}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Refund disclaimer + passport-name nudge */}
                    <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-snug" data-testid="name-refund-disclaimer">
                      <div className="font-bold uppercase tracking-wider text-[10px] mb-1">Refund policy — please read</div>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>The AED 999 pre-booking deposit is <span className="font-semibold">refundable only if none of your 3 preferred names are available</span> with the authority.</li>
                        <li>Once any one name is confirmed by the authority, the deposit is <span className="font-semibold">non-refundable</span>.</li>
                        <li>Use the names <span className="font-semibold">exactly as on your passport</span> (first + middle + last). Any rejection due to incorrect / partial names will not be refunded.</li>
                      </ul>
                    </div>
                    <p className="mt-2 text-[10px] text-slate-400">
                      We reserve the first available name with the authority. {isFounderClubMember ? 'First-name reservation is free for Founder Club members.' : null} Avoid premium words to save AED 2,000.
                    </p>
                  </div>
                </div>

                {!user && (
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900">
                    Continue as guest or <button type="button" onClick={() => navigate(`/login?redirect=${encodeURIComponent('/checkout')}`)} className="underline font-semibold">sign in</button> to track your order.
                  </div>
                )}
              </div>
            )}

            {/* Step 3 — Payment */}
            {step === 3 && order && (
              <div className="space-y-5 fade-up" data-testid="step-3">
                <div className="flex items-center gap-2 text-brand-emerald font-semibold"><CreditCard className="h-4 w-4" /> Complete your payment</div>

                {/* Payment choice: Full vs Reserve */}
                <CurrencySwitcher aedAmount={breakdown.total} />
                <div className="grid grid-cols-2 gap-3" data-testid="pay-choice">
                  <button
                    type="button"
                    data-testid="pay-choice-full"
                    onClick={() => setPayChoice('full')}
                    className={`text-left rounded-2xl border-2 p-4 transition ${payChoice === 'full' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-300'}`}
                  >
                    <div className="text-[11px] uppercase tracking-[0.18em] font-bold brand-emerald">Pay Full Amount</div>
                    <div className="font-display text-2xl font-bold text-slate-900 mt-1">AED {breakdown.total.toLocaleString()}</div>
                    <div className="text-[11px] text-slate-500 mt-1">Pay the complete package now</div>
                  </button>
                  <button
                    type="button"
                    data-testid="pay-choice-reserve"
                    onClick={() => setPayChoice('reserve')}
                    className={`text-left rounded-2xl border-2 p-4 transition ${payChoice === 'reserve' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white hover:border-amber-300'}`}
                  >
                    <div className="text-[11px] uppercase tracking-[0.18em] font-bold brand-bronze">Pay Deposit</div>
                    <div className="font-display text-2xl font-bold text-slate-900 mt-1">AED {getPrebookingAmount().toLocaleString()}</div>
                    <div className="text-[11px] text-slate-500 mt-1">Refundable hold · pay balance later</div>
                  </button>
                </div>

                <div className="rounded-2xl bg-emerald-50 border border-emerald-900/10 p-4 text-sm">
                    Order reference <span className="font-mono font-bold brand-emerald">{order.reference}</span>. {payChoice === 'full' ? <>Paying the full amount of <span className="font-semibold">AED {breakdown.total.toLocaleString()}</span>.</> : <>Pay the AED {getPrebookingAmount()} deposit to lock your slot. Refundable before licence application.</>}
                </div>

                <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-full text-xs font-semibold">
                  <button data-testid="pay-tab-card" onClick={() => setPayTab('card')} className={`py-2.5 rounded-full transition ${payTab === 'card' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}>Pay by Card</button>
                  <button data-testid="pay-tab-bank" onClick={() => setPayTab('bank')} className={`py-2.5 rounded-full transition ${payTab === 'bank' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}>Bank Transfer</button>
                  <button data-testid="pay-tab-link" onClick={() => setPayTab('link')} className={`py-2.5 rounded-full transition ${payTab === 'link' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}>Pay by Link</button>
                </div>

                {payTab === 'card' && (
                  <div className="space-y-3" data-testid="pay-card-panel">
                    <div className="text-sm text-slate-600 leading-relaxed">
                      You&apos;ll be redirected to Stripe&apos;s secure checkout. We never see your card details. <span className="font-semibold text-emerald-700">Confirmation is instant</span> — your dashboard opens right after.
                    </div>
                    <Button data-testid="pay-card-btn" disabled={busy} onClick={payCard} className="btn-primary rounded-full w-full h-12">
                      {busy ? 'Redirecting…' : <>Pay AED {payAmount.toLocaleString()} securely <ChevronRight className="h-4 w-4 ml-1" /></>}
                    </Button>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> Card payments require a Stripe Edge Function; bank transfer is active in this build.</div>
                  </div>
                )}

                {payTab === 'bank' && (
                  <div className="space-y-3" data-testid="pay-bank-panel">
                    {/* Multi-currency Mashreq accounts */}
                    {(COMPANY_INFO.bank.accounts || [{ currency: 'AED', iban: COMPANY_INFO.bank.iban, note: '' }]).map((acct) => (
                      <div key={acct.currency} className="rounded-xl bg-white border border-slate-200 p-4 text-sm space-y-1" data-testid={`bank-acct-${acct.currency.toLowerCase()}`}>
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] uppercase tracking-[0.22em] brand-bronze font-bold flex items-center gap-1.5">
                            <Landmark className="h-3.5 w-3.5" /> {acct.currency} Account
                          </div>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">{acct.currency}</span>
                        </div>
                        <div><span className="text-slate-500">Beneficiary:</span> <span className="font-semibold">{COMPANY_INFO.bank.accountName}</span></div>
                        <div><span className="text-slate-500">Bank:</span> {COMPANY_INFO.bank.name}{COMPANY_INFO.bank.branch ? ` · ${COMPANY_INFO.bank.branch}` : ''}</div>
                        <div><span className="text-slate-500">SWIFT/BIC:</span> {COMPANY_INFO.bank.swift}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">{acct.currency} IBAN:</span>
                          <span className="font-mono flex-1 truncate">{acct.iban}</span>
                          <button type="button" onClick={() => navigator.clipboard?.writeText(acct.iban)} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100" data-testid={`bank-copy-${acct.currency.toLowerCase()}`}>Copy</button>
                        </div>
                        <div><span className="text-slate-500">Reference:</span> <span className="font-mono">{order.reference}</span></div>
                        {acct.note ? <div className="text-[11px] text-amber-700 pt-1">⚠ {acct.note}</div> : null}
                      </div>
                    ))}
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-900">
                      Once you transfer, upload the receipt below. <span className="font-semibold">Order is marked &quot;Pending bank credit&quot; until funds are confirmed (usually within 24 hours).</span>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Payer Name (as on bank account)</label>
                      <Input data-testid="bank-payer-input" value={bankProof.payer_name} onChange={(e) => setBankProof((p) => ({ ...p, payer_name: e.target.value }))} className="mt-1 h-11 rounded-lg" placeholder="As on bank account" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Receipt / Screenshot (PDF or image, max 4MB)</label>
                      <label className="mt-1 flex items-center gap-2 h-11 rounded-lg border-2 border-dashed border-slate-300 px-3 cursor-pointer hover:border-emerald-500">
                        <Upload className="h-4 w-4 brand-emerald" />
                        <span className="text-sm text-slate-700 truncate">{bankProof.file_name || 'Click to attach receipt / screenshot'}</span>
                        <input data-testid="bank-file-input" type="file" accept="image/*,application/pdf" className="hidden" onChange={onProofFile} />
                      </label>
                    </div>
                    <Button data-testid="bank-submit-btn" disabled={busy} onClick={submitBankProof} className="btn-primary rounded-full w-full h-12">
                      {busy ? 'Uploading…' : <>Submit proof <ChevronRight className="h-4 w-4 ml-1" /></>}
                    </Button>
                  </div>
                )}

                {payTab === 'link' && (
                  <div className="space-y-3" data-testid="pay-link-panel">
                    <div className="rounded-xl bg-white border border-slate-200 p-4 text-sm space-y-2">
                      <div className="text-[10px] uppercase tracking-[0.22em] brand-bronze font-bold flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Pay-by-Link</div>
                      <p className="text-slate-600 leading-relaxed text-[13px]">
                        Get a single secure Stripe payment link you can share, save, or use from any device. Confirmation is <span className="font-semibold text-emerald-700">instant</span>; your client dashboard opens automatically.
                      </p>
                      <div className="flex items-center gap-2 mt-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                        <span className="font-mono text-[11px] truncate flex-1" data-testid="pay-link-url">
                          {`https://pay.smartsetupuae.ae/${order.reference}-${payAmount}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const link = `https://pay.smartsetupuae.ae/${order.reference}-${payAmount}`;
                            navigator.clipboard?.writeText(link);
                            toast({ title: 'Pay link copied', description: link });
                          }}
                          className="text-[11px] font-semibold px-3 py-1 rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
                          data-testid="pay-link-copy"
                        >
                          Copy
                        </button>
                      </div>
                      <a
                        href={`https://wa.me/${COMPANY_INFO.whatsappNumber}?text=${encodeURIComponent(`Hi, please send me the pay link for order ${order.reference} (AED ${payAmount}).`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-[12px] text-emerald-700 hover:underline mt-1"
                        data-testid="pay-link-whatsapp"
                      >
                        Or get the link via WhatsApp →
                      </a>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> The actual link is generated by our advisor team and sent to you within minutes during business hours.</div>
                  </div>
                )}
              </div>
            )}

            {/* Step 4 — Confirmation */}
            {step === 4 && (
              <div className="space-y-5 fade-up" data-testid="step-4">
                <div className="text-center">
                  <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 grid place-items-center"><CheckCircle2 className="h-8 w-8 brand-emerald" /></div>
                  <h2 className="font-display text-3xl font-semibold text-slate-900 mt-3">Order confirmed!</h2>
                  <p className="text-slate-600 mt-2">Your reference is <span className="font-mono font-bold brand-emerald">{order?.reference}</span>. Our team will WhatsApp you within minutes to begin documentation.</p>
                </div>

                <PaymentProofUpload
                  orderRef={order?.reference}
                  customer={{ name: draft?.contact?.name, email: draft?.contact?.email, phone: `${draft?.contact?.phone_code || ''} ${draft?.contact?.phone || ''}`.trim() }}
                  amount={draft?.total_aed}
                />

                <div className="grid sm:grid-cols-2 gap-3 max-w-md mx-auto pt-3">
                  <Button onClick={() => navigate('/dashboard')} className="btn-primary rounded-full h-11">Go to dashboard</Button>
                  <Button onClick={() => navigate('/')} variant="outline" className="rounded-full h-11 border-slate-300">Back home</Button>
                </div>
              </div>
            )}

            {/* Nav buttons */}
            {step < 3 && (
              <div className="mt-8 flex items-center justify-between">
                <Button onClick={back} disabled={step === 1} variant="outline" className="rounded-full px-5 h-11 border-slate-300" data-testid="step-back-btn">
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button onClick={next} disabled={busy || !pricingLoaded || !currentZone} className="btn-primary rounded-full px-7 h-11" data-testid="step-next-btn">
                  {busy ? 'Saving…' : <>Continue <ChevronRight className="h-4 w-4 ml-1" /></>}
                </Button>
              </div>
            )}
            {step === 3 && (
              <div className="mt-6 flex items-center justify-between">
                <Button onClick={back} variant="outline" className="rounded-full px-5 h-11 border-slate-300">
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <div className="text-xs text-slate-500">Order ref: <span className="font-mono">{order?.reference}</span></div>
              </div>
            )}
            </>)}
          </div>

          {/* SUMMARY */}
          <div className="card-elevated rounded-3xl p-6 sticky top-24 h-fit" data-testid="checkout-summary">
            <div className="text-[10px] uppercase tracking-[0.22em] brand-bronze font-bold">Order Summary</div>

            {/* Zone header card — like reference */}
            {currentZone && (
              <div className="mt-3 p-4 rounded-2xl border border-emerald-900/15 bg-gradient-to-br from-emerald-50 to-amber-50/40" data-testid="summary-zone-header">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-display text-base font-semibold text-slate-900 truncate">{currentZone.name}</div>
                    {currentZone.package_name && <div className="text-[11px] text-slate-600 truncate">{currentZone.package_name}</div>}
                  </div>
                  {currentZone.tag && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0">{currentZone.tag}</span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-700">
                  {currentZone.processing_time && <span className="inline-flex items-center gap-1"><span className="opacity-60">⏱</span> {currentZone.processing_time}</span>}
                  {currentZone.visa_quota ? <span className="inline-flex items-center gap-1"><span className="opacity-60">👥</span> {currentZone.visa_quota} visa{currentZone.visa_quota > 1 ? 's' : ''}</span> : null}
                  {currentZone.workspace && <span className="inline-flex items-center gap-1"><span className="opacity-60">🏢</span> {currentZone.workspace.split(' / ')[0]}</span>}
                </div>
              </div>
            )}

            {/* Line items */}
            <div className="mt-3 font-display text-sm" data-testid="summary-line-items">
              {breakdown.items.map((it) => (
                <button
                  type="button"
                  key={it.l || it.type || Math.random()}
                  onClick={() => handleBreakdownClick(it)}
                  disabled={it.type === 'service'}
                  className={`w-full rounded-xl px-2.5 py-1.5 text-left transition ${it.type !== 'service' ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'} ${it.type === 'service' ? 'opacity-80' : ''}`}
                >
                  <div className="flex justify-between text-slate-700 text-[13px]">
                    <span className="truncate pr-2">{it.l}</span>
                    <span className="font-semibold shrink-0">
                      {it.original ? <span className="mr-2 text-slate-400 line-through">AED {it.original.toLocaleString()}</span> : null}
                      AED {it.v.toLocaleString()}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Founder Club popular suggestion */}
            {!isFounderClubMember && (() => {
              const founderInCart = draft.addons.some((x) => x.id === 'founder-club');
              return (
                <div className={`mt-3 p-3 rounded-2xl border ${founderInCart ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`} data-testid="summary-founder-suggestion">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-900">Popular</span>
                        <span className="font-display text-[13px] font-semibold text-slate-900">Founder Club Membership</span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        AED 999 lifetime · free name reservation · priority advisor · 10% renewal off · 15% service-fee discounts.
                      </div>
                    </div>
                    {founderInCart ? (
                      <button
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, addons: d.addons.filter((x) => x.id !== 'founder-club') }))}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white border border-emerald-700 text-emerald-700 hover:bg-emerald-50 shrink-0"
                        data-testid="summary-founder-remove"
                      >
                        Added ✓
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDraft((d) => ({
                          ...d,
                          addons: [...d.addons, { id: 'founder-club', label: 'Founder Club Membership', price: 999 }],
                        }))}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-700 text-white hover:bg-amber-800 shrink-0"
                        data-testid="summary-founder-add"
                      >
                        Add +
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* AI Website Bundle — FREE on orders ≥ AED 10,000 */}
            {breakdown.total >= 10000 && (
              <div className="mt-2 p-3 rounded-2xl bg-emerald-50 border border-emerald-200" data-testid="summary-website-bundle">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-700 text-white">Free</span>
                      <span className="font-display text-[13px] font-semibold text-slate-900">AI Website Bundle</span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">Free 1-page site + domain on orders above AED 10,000.</div>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 shrink-0">Included ✓</span>
                </div>
              </div>
            )}

            {/* Savings panel — shows benefit (% + amount) when discounts applied */}
            {breakdown.totalSaved > 0 && (
              <div className="mt-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200" data-testid="summary-savings">
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-emerald-700">Your savings</div>
                <div className="mt-1 space-y-0.5 text-[12px]">
                  <div className="flex justify-between text-slate-600">
                    <span>Without discount</span>
                    <span className="line-through">AED {breakdown.grossTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>With discount</span>
                    <span className="font-semibold">AED {breakdown.total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-bold pt-1 border-t border-emerald-200">
                    <span>You saved</span>
                    <span data-testid="summary-saved-amount">AED {breakdown.totalSaved.toLocaleString()} <span className="font-normal text-[10px]">({breakdown.savedPct}%)</span></span>
                  </div>
                </div>
              </div>
            )}

            {/* Grand total */}
            <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-baseline">
              <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Total (Year 1)</span>
              <span className="font-display text-3xl font-bold text-slate-900" data-testid="summary-total">AED {breakdown.total.toLocaleString()}</span>
            </div>

            {/* Payment-mode toggle (Pay Full vs Reserve AED 999) */}
            <div className="mt-4" data-testid="summary-pay-toggle">
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-semibold mb-2">Pay today</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPayChoice('full')}
                  data-testid="summary-pay-full"
                  className={`text-left rounded-2xl border-2 p-3 transition ${payChoice === 'full' ? 'border-emerald-700 bg-emerald-50 ring-2 ring-emerald-700/15' : 'border-slate-200 bg-white hover:border-emerald-400'}`}
                >
                  <div className="text-[10px] uppercase tracking-wider font-bold brand-emerald">Pay Now</div>
                  <div className="font-display text-base font-bold text-slate-900 mt-0.5">AED {breakdown.total.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-500">Full payment · fastest start</div>
                </button>
                <button
                  type="button"
                  onClick={() => setPayChoice('reserve')}
                  data-testid="summary-pay-reserve"
                  className={`text-left rounded-2xl border-2 p-3 transition ${payChoice === 'reserve' ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-500/15' : 'border-slate-200 bg-white hover:border-amber-300'}`}
                >
                  <div className="text-[10px] uppercase tracking-wider font-bold brand-bronze">Reserve</div>
                  <div className="font-display text-base font-bold text-slate-900 mt-0.5">AED {getPrebookingAmount()}</div>
                  <div className="text-[10px] text-slate-500">Refundable slot · pay rest later</div>
                </button>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                {payChoice === 'full'
                  ? 'You will be charged the full amount today and processing starts immediately.'
                  : `Lock your slot with AED ${getPrebookingAmount()} today. Refundable before licence submission.`}
              </p>
            </div>

            <div className="mt-4 text-[11px] text-slate-500 flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 brand-emerald" /> Lic {COMPANY_INFO.license} · UAE Consultancy</div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
