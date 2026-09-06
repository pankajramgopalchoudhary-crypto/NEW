import React, { Suspense, lazy, useEffect } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { I18nProvider } from './context/I18nContext';
import { Toaster } from './components/ui/toaster';
import { AriaChatbot, WhatsAppFloatingButton } from './components/AriaWidgets';
import ScratchCard from './components/ScratchCard';
import UniversalLeadEnquiry from './components/UniversalLeadEnquiry';
import { Privacy, Terms, Refund, DataDeletion } from './pages/Legal';
import ErrorBoundary from './components/ErrorBoundary';

const Home = lazy(() => import('./pages/Home'));
const FreeZones = lazy(() => import('./pages/FreeZones'));
const FreeZoneDetail = lazy(() => import('./pages/FreeZoneDetail'));
const Mainland = lazy(() => import('./pages/Mainland'));
const MainlandVsFreeZone = lazy(() => import('./pages/MainlandVsFreeZone'));
const VisaServices = lazy(() => import('./pages/VisaServices'));
const GoldenVisa = lazy(() => import('./pages/GoldenVisa'));
const CostCalculator = lazy(() => import('./pages/CostCalculator'));
const Checkout = lazy(() => import('./pages/Checkout'));
const CheckoutSuccess = lazy(() => import('./pages/CheckoutSuccess'));
const AISearchPage = lazy(() => import('./pages/AISearchPage'));
const Compare = lazy(() => import('./pages/Compare'));
const ServicePage = lazy(() => import('./pages/ServicePage'));
const FAQs = lazy(() => import('./pages/FAQs'));
const FounderClub = lazy(() => import('./pages/FounderClub'));
const Blog = lazy(() => import('./pages/Blog'));
const About = lazy(() => import('./pages/About'));
const Consultation = lazy(() => import('./pages/Consultation'));
const Careers = lazy(() => import('./pages/Careers'));
const Login = lazy(() => import('./pages/Login'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const SupportPortal = lazy(() => import('./pages/SupportPortal'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const Activities = lazy(() => import('./pages/Activities'));
const PhotoStudio = lazy(() => import('./pages/PhotoStudio'));
const HeroPreview = lazy(() => import('./pages/HeroPreview'));

function useRevealOnScroll() {
  const location = useLocation();

  useEffect(() => {
    let observer;
    const attach = () => {
      const elements = document.querySelectorAll('.reveal:not(.in)');
      if (!elements.length) return;

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('in');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1, rootMargin: '80px 0px' }
      );

      elements.forEach((element) => observer.observe(element));
    };

    const timer = window.setTimeout(attach, 80);
    return () => {
      window.clearTimeout(timer);
      if (observer) observer.disconnect();
    };
  }, [location.pathname]);
}

function Shell({ children }) {
  const location = useLocation();

  useRevealOnScroll();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return <>{children}</>;
}

function PageLoader() {
  return (
    <div className="min-h-[60vh] grid place-items-center" data-testid="page-loader">
      <div className="text-center px-6">
        <div className="relative mx-auto h-14 w-14">
          <div className="absolute inset-0 rounded-full border-2 border-emerald-700/15" />
          <div className="absolute inset-0 rounded-full border-t-2 border-emerald-700 animate-spin" />
          <div className="absolute inset-2.5 rounded-full bg-emerald-50 grid place-items-center brand-emerald font-display font-bold text-base">S</div>
        </div>
        <div className="mt-4 font-display text-lg font-semibold text-slate-800">Founders’ dreams are loading…</div>
        <div className="mt-1 text-xs text-slate-500">Be patient — good things take a moment.</div>
      </div>
    </div>
  );
}

function App() {
  useEffect(() => {
    const removeExternalBuilderWatermark = () => {
      const selectors = [
        '[id*="emergent" i]',
        '[class*="emergent" i]',
        '[href*="emergent" i]',
        '[src*="emergent" i]',
        '[aria-label*="emergent" i]',
        '[title*="emergent" i]',
        '[data-testid*="emergent" i]',
        '[data-emergent]',
        '[id*="watermark" i]',
        '[class*="watermark" i]',
        '[id*="made-with" i]',
        '[class*="made-with" i]',
        '[id*="built-with" i]',
        '[class*="built-with" i]',
        '#__webpack_dev_server_overlay__',
      ];

      document.querySelectorAll(selectors.join(',')).forEach((node) => {
        if (!node.closest('header,footer,[data-smartsetup-widget]')) {
          node.remove();
        }
      });

      // Brute-force: remove any position:fixed element in the page corners
      // that is NOT part of our app (we tag our own with data-smartsetup-widget).
      document.querySelectorAll('body > *').forEach((node) => {
        if (node.id === 'root') return;
        if (node.closest('[data-smartsetup-widget]')) return;
        const tag = (node.tagName || '').toLowerCase();
        if (['script', 'style', 'link', 'meta', 'noscript'].includes(tag)) return;
        try {
          const cs = window.getComputedStyle(node);
          if (cs.position === 'fixed') {
            const text = (node.textContent || '').toLowerCase();
            if (/emergent|made with|built with|powered by/.test(text) || node.querySelector('a[href*="emergent" i]')) {
              node.remove();
            }
          }
        } catch (_e) { /* noop */ }
      });

      document.querySelectorAll('a,button,div,span,iframe,img').forEach((node) => {
        const text = (
          node.textContent ||
          node.getAttribute('aria-label') ||
          node.getAttribute('title') ||
          node.getAttribute('src') ||
          node.getAttribute('alt') ||
          ''
        ).trim();

        if (/emergent|full stack website|built with|made with emergent|powered by emergent/i.test(text) && !node.closest('header,footer,[data-smartsetup-widget]')) {
          node.remove();
        }
      });

      if (/emergent|full stack website/i.test(document.title)) {
        document.title = 'SmartSetupUAE | AI Business Setup UAE';
      }
    };

    document.title = 'SmartSetupUAE | AI Business Setup UAE';
    removeExternalBuilderWatermark();

    const observer = new MutationObserver(removeExternalBuilderWatermark);
    observer.observe(document.documentElement, { childList: true, subtree: true });

    const timers = [120, 800, 1800].map((delay) => window.setTimeout(removeExternalBuilderWatermark, delay));

    return () => {
      observer.disconnect();
      timers.forEach(window.clearTimeout);
    };
  }, []);

  return (
    <div className="App">
      <I18nProvider>
        <AuthProvider>
          <BrowserRouter>
            <Shell>
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/free-zones" element={<FreeZones />} />
                  <Route path="/free-zones/:slug" element={<FreeZoneDetail />} />
                  <Route path="/mainland" element={<Mainland />} />
                  <Route path="/mainland-vs-freezone" element={<MainlandVsFreeZone />} />
                  <Route path="/visa-services" element={<VisaServices />} />
                  <Route path="/golden-visa" element={<GoldenVisa />} />
                  <Route path="/calculator" element={<CostCalculator />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/checkout/success" element={<CheckoutSuccess />} />
                  <Route path="/ai-search" element={<AISearchPage />} />
                  <Route path="/compare" element={<Compare />} />
                  <Route path="/services/:slug" element={<ServicePage />} />
                  <Route path="/faqs" element={<FAQs />} />
                  <Route path="/founder-club" element={<FounderClub />} />
                  <Route path="/activities" element={<Activities />} />
                  <Route path="/photo-studio" element={<PhotoStudio />} />
                  <Route path="/preview-hero" element={<HeroPreview />} />
                  <Route path="/blog" element={<Blog />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/consultation" element={<Consultation />} />
                  <Route path="/careers" element={<Careers />} />
                  <Route path="/career" element={<Careers />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/admin/login" element={<AdminLogin />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/dashboard/support" element={<SupportPortal />} />
                  <Route path="/dashboard/support/:ticketId" element={<SupportPortal />} />
                  <Route path="/admin" element={<AdminPanel />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/refund" element={<Refund />} />
                  <Route path="/data-deletion" element={<DataDeletion />} />
                </Routes>
              </Suspense>
              </ErrorBoundary>
              <WhatsAppFloatingButton />
              <AriaChatbot />
              <UniversalLeadEnquiry />
              <ScratchCard />
            </Shell>
          </BrowserRouter>
          <Toaster />
        </AuthProvider>
      </I18nProvider>
    </div>
  );
}

export default App;
