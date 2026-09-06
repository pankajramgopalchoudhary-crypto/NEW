import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone, ShieldCheck, Linkedin, Instagram, Twitter, Facebook } from 'lucide-react';
import { COMPANY_INFO } from '../data/zones';
import BrandLogo from './BrandLogo';

export default function Footer() {
  return (
    <footer className="bg-[#0F2A2A] text-[#E7EEEC] mt-24">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-10">
          <div className="lg:col-span-2">
            <BrandLogo variant="dark" className="h-16 ml-1.5" />
            <div className="mt-3 text-xs uppercase tracking-[0.2em] text-[#9DB5B0] flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Lic {COMPANY_INFO.license}</div>
            <p className="mt-4 text-sm text-[#A9C0BB] leading-relaxed max-w-md">
              Operated by <span className="text-[#F0C674] font-semibold">{COMPANY_INFO.legalName}</span>. SmartSetupUAE.ae is a private consultancy and not a government body. Founder: {COMPANY_INFO.founder}.
            </p>
            <div className="mt-5 flex items-center gap-3">
              {[Linkedin, Instagram, Twitter, Facebook].map((Icon, i) => (
                <a key={i} href="#" className="h-9 w-9 rounded-full grid place-items-center border border-white/15 hover:border-[#F0C674] hover:text-[#F0C674] transition-colors">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-white mb-4">Services</div>
            <ul className="space-y-2 text-sm text-[#A9C0BB]">
              <li><Link to="/free-zones" className="hover:text-white link-underline">Free Zone Finder</Link></li>
              <li><Link to="/mainland" className="hover:text-white link-underline">Mainland Formation</Link></li>
              <li><Link to="/visa-services" className="hover:text-white link-underline">Visa Services</Link></li>
              <li><Link to="/golden-visa" className="hover:text-white link-underline">Golden Visa</Link></li>
              <li><Link to="/calculator" className="hover:text-white link-underline">Cost Calculator</Link></li>
            </ul>
          </div>

          <div>
            <div className="text-sm font-semibold text-white mb-4">Resources</div>
            <ul className="space-y-2 text-sm text-[#A9C0BB]">
              <li><Link to="/blog" className="hover:text-white link-underline">Blog</Link></li>
              <li><Link to="/about" className="hover:text-white link-underline">About Us</Link></li>
              <li><Link to="/ai-search" className="hover:text-white link-underline">AI Activity Search</Link></li>
              <li><Link to="/consultation" className="hover:text-white link-underline">Book Consultation</Link></li>
              <li><Link to="/login" className="hover:text-white link-underline">Client Login</Link></li>
            </ul>
          </div>

          <div>
            <div className="text-sm font-semibold text-white mb-4">Contact</div>
            <ul className="space-y-3 text-sm text-[#A9C0BB]">
              <li className="flex gap-2"><MapPin className="h-4 w-4 mt-0.5 text-[#F0C674] shrink-0" /> {COMPANY_INFO.address}</li>
              <li className="flex gap-2"><Phone className="h-4 w-4 mt-0.5 text-[#F0C674]" /> {COMPANY_INFO.phone}</li>
              <li className="flex gap-2"><Mail className="h-4 w-4 mt-0.5 text-[#F0C674]" /> {COMPANY_INFO.email}</li>
            </ul>
          </div>
        </div>

        {/* Google Map for company address */}
        <div className="mt-12 rounded-2xl overflow-hidden border border-white/10 bg-white/5" data-testid="footer-map">
          <div className="px-5 pt-5 pb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#F0C674]" />
            <span className="text-sm font-semibold text-white">Visit our office</span>
            <span className="text-xs text-[#A9C0BB] hidden sm:inline">— {COMPANY_INFO.address}</span>
          </div>
          <iframe
            title="SmartSetupUAE office location"
            src={`https://www.google.com/maps?q=${encodeURIComponent(COMPANY_INFO.address)}&output=embed`}
            width="100%"
            height="260"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-[#7F9994]">
          <div>© {new Date().getFullYear()} {COMPANY_INFO.legalName}. All rights reserved.</div>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/privacy" className="hover:text-white">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-white">Terms</Link>
            <Link to="/refund" className="hover:text-white">Refund Policy</Link>
            <Link to="/data-deletion" className="hover:text-white">Data Deletion</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
