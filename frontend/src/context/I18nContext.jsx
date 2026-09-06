// SmartSetupUAE i18n — hybrid approach
//  • Curated DICT for hero/nav/chatbot copy (instant, no flicker, perfect quality)
//  • Google Translate Element drives full-website translation for everything else
//    (every page, every dynamic component, every Supabase-loaded text).
//  • Aria the chatbot ALSO replies in the user's chosen language via backend prompt.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// 30 languages — covers ~95% of UAE business-setup market
// `gt` = Google Translate code (mapped to en if missing → no-op)
// `iso` = ISO country code for flagcdn.com (renders reliably on every OS, unlike emojis)
export const LANGUAGES = [
  { code: 'en',    gt: 'en',    label: 'English',     iso: 'gb', rtl: false },
  { code: 'ar',    gt: 'ar',    label: 'العربية',     iso: 'ae', rtl: true  },
  { code: 'hi',    gt: 'hi',    label: 'हिन्दी',       iso: 'in', rtl: false },
  { code: 'ur',    gt: 'ur',    label: 'اردو',        iso: 'pk', rtl: true  },
  { code: 'zh',    gt: 'zh-CN', label: '中文 (简体)',  iso: 'cn', rtl: false },
  { code: 'ja',    gt: 'ja',    label: '日本語',       iso: 'jp', rtl: false },
  { code: 'ko',    gt: 'ko',    label: '한국어',       iso: 'kr', rtl: false },
  { code: 'ru',    gt: 'ru',    label: 'Русский',     iso: 'ru', rtl: false },
  { code: 'uk',    gt: 'uk',    label: 'Українська',  iso: 'ua', rtl: false },
  { code: 'fr',    gt: 'fr',    label: 'Français',    iso: 'fr', rtl: false },
  { code: 'es',    gt: 'es',    label: 'Español',     iso: 'es', rtl: false },
  { code: 'pt',    gt: 'pt',    label: 'Português',   iso: 'pt', rtl: false },
  { code: 'de',    gt: 'de',    label: 'Deutsch',     iso: 'de', rtl: false },
  { code: 'nl',    gt: 'nl',    label: 'Nederlands',  iso: 'nl', rtl: false },
  { code: 'it',    gt: 'it',    label: 'Italiano',    iso: 'it', rtl: false },
  { code: 'pl',    gt: 'pl',    label: 'Polski',      iso: 'pl', rtl: false },
  { code: 'tr',    gt: 'tr',    label: 'Türkçe',      iso: 'tr', rtl: false },
  { code: 'fa',    gt: 'fa',    label: 'فارسی',       iso: 'ir', rtl: true  },
  { code: 'sw',    gt: 'sw',    label: 'Kiswahili',   iso: 'ke', rtl: false },
  { code: 'id',    gt: 'id',    label: 'Bahasa Indonesia', iso: 'id', rtl: false },
  { code: 'ms',    gt: 'ms',    label: 'Bahasa Melayu',    iso: 'my', rtl: false },
  { code: 'fil',   gt: 'fil',   label: 'Filipino',    iso: 'ph', rtl: false },
  { code: 'th',    gt: 'th',    label: 'ไทย',         iso: 'th', rtl: false },
  { code: 'vi',    gt: 'vi',    label: 'Tiếng Việt',  iso: 'vn', rtl: false },
  { code: 'bn',    gt: 'bn',    label: 'বাংলা',        iso: 'bd', rtl: false },
  { code: 'ta',    gt: 'ta',    label: 'தமிழ்',        iso: 'in', rtl: false },
  { code: 'te',    gt: 'te',    label: 'తెలుగు',       iso: 'in', rtl: false },
  { code: 'ml',    gt: 'ml',    label: 'മലയാളം',      iso: 'in', rtl: false },
  { code: 'mr',    gt: 'mr',    label: 'मराठी',        iso: 'in', rtl: false },
  { code: 'pa',    gt: 'pa',    label: 'ਪੰਜਾਬੀ',        iso: 'in', rtl: false },
];

export const flagUrl = (iso) => `https://flagcdn.com/h20/${iso || 'gb'}.png`;

// Curated dictionary for the most-visible strings (hero / nav / chatbot).
// Everything not in this dictionary is auto-translated by Google Translate Element
// (which we drive via the goog cookie). This makes language switching truly site-wide.
const DICT = {
  en: { aiSearch: 'AI Search', startApp: 'Start Application', bookCall: 'Book Free Call', clientLogin: 'Client Login', findMatch: 'Find My Best Match — Free', poweredBy: 'POWERED BY OFFICIAL UAE GOVERNMENT DATA + AI', heroTitle: 'Compare 40+ UAE Free Zones & Find Your Best Match.', heroSub: "Launch a startup or scale your company — our AI compares every jurisdiction on cost, speed and visas to find your perfect match in 2 minutes.", chatGreeting: "Hi! I'm Aria, your SmartSetupUAE concierge. Tell me about your business — in any language — and I'll find your perfect UAE setup." },
  ar: { aiSearch: 'بحث الذكاء الاصطناعي', startApp: 'ابدأ التطبيق', bookCall: 'احجز مكالمة مجانية', clientLogin: 'تسجيل دخول', findMatch: 'اعثر على أفضل تطابق — مجاناً', poweredBy: 'مدعوم بالبيانات الرسمية لحكومة الإمارات + الذكاء الاصطناعي', heroTitle: 'قارن بين أكثر من 40 منطقة حرة في الإمارات واعثر على الأنسب لك.', heroSub: 'أطلق شركتك الناشئة أو وسّع نشاطك — يقارن الذكاء الاصطناعي لدينا كل اختصاص قضائي من حيث التكلفة والسرعة والتأشيرات للعثور على الأنسب لك خلال دقيقتين.', chatGreeting: 'مرحباً! أنا أريا، مستشارك في SmartSetupUAE. أخبرني عن عملك بأي لغة وسأجد لك الإعداد المثالي في الإمارات.' },
  hi: { aiSearch: 'AI खोज', startApp: 'आवेदन शुरू करें', bookCall: 'मुफ्त कॉल बुक करें', clientLogin: 'क्लाइंट लॉगिन', findMatch: 'मेरा बेस्ट मैच ढूँढें — मुफ्त', poweredBy: 'आधिकारिक यूएई सरकारी डेटा + AI द्वारा संचालित', heroTitle: '40+ यूएई फ्री ज़ोन की तुलना करें और अपना बेस्ट मैच पाएं।', heroSub: 'स्टार्टअप शुरू करें या अपनी कंपनी का विस्तार करें — हमारा AI लागत, गति और वीज़ा के आधार पर हर अधिकार क्षेत्र की तुलना करता है ताकि 2 मिनट में आपका सही मैच मिल सके।', chatGreeting: 'नमस्ते! मैं आरिया हूँ, SmartSetupUAE की कंसीयज। मुझे अपने व्यवसाय के बारे में किसी भी भाषा में बताएं — मैं आपके लिए सही यूएई सेटअप ढूँढूंगी।' },
};

// ---------------------------------------------------------------------------
// Google Translate driver — flips the `googtrans` cookie + dispatches a change
// so the (hidden) Google Translate Element re-renders the page in `code`.
// ---------------------------------------------------------------------------
function setGoogleTranslate(targetGT) {
  const value = !targetGT || targetGT === 'en' ? '/en/en' : `/en/${targetGT}`;
  // root + apex domain cookies for max compatibility
  try {
    const host = window.location.hostname;
    document.cookie = `googtrans=${value}; path=/`;
    document.cookie = `googtrans=${value}; path=/; domain=${host}`;
    // For preview subdomains we also try the parent host
    const parent = host.split('.').slice(-2).join('.');
    if (parent && parent !== host) {
      document.cookie = `googtrans=${value}; path=/; domain=.${parent}`;
    }
  } catch { /* noop */ }
  // Trigger Google's combo to actually swap text without a hard reload
  const tryApply = () => {
    const sel = document.querySelector('select.goog-te-combo');
    if (sel) {
      sel.value = targetGT === 'en' ? '' : targetGT;
      sel.dispatchEvent(new Event('change'));
      return true;
    }
    return false;
  };
  if (!tryApply()) {
    // Widget not ready yet → poll briefly
    let n = 0;
    const t = setInterval(() => { if (tryApply() || ++n > 25) clearInterval(t); }, 200);
  }
}

const Ctx = createContext({ lang: 'en', t: (k) => k, setLang: () => {} });

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('ssu_lang') || 'en');

  const applyLang = useCallback((next) => {
    const meta = LANGUAGES.find((l) => l.code === next) || LANGUAGES[0];
    document.documentElement.lang = next;
    document.documentElement.dir = meta.rtl ? 'rtl' : 'ltr';
    setGoogleTranslate(meta.gt || 'en');
  }, []);

  const setLang = useCallback((next) => {
    const prev = localStorage.getItem('ssu_lang') || 'en';
    setLangState(next);
    localStorage.setItem('ssu_lang', next);
    applyLang(next);
    // Hard refresh whenever switching to / from a non-English language —
    // Google Translate occasionally fails to swap text on SPA route changes,
    // so we reload once to guarantee the new language renders everywhere.
    if (prev !== next) {
      window.setTimeout(() => { window.location.reload(); }, 120);
    }
  }, [applyLang]);

  // Apply on first mount (after Google Translate has injected its select)
  useEffect(() => { applyLang(lang); }, [lang, applyLang]);

  const t = useCallback((key) => (DICT[lang] && DICT[lang][key]) || DICT.en[key] || key, [lang]);

  const value = useMemo(() => ({
    lang, t, setLang,
    langMeta: LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0],
  }), [lang, t, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
