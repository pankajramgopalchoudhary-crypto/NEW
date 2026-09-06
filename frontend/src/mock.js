// Mock data for SmartSetup UAE clone

export const NAV_LINKS = [
  {
    label: 'Services',
    href: '#services',
    children: [
      { label: 'Free Zone Setup', href: '/free-zones' },
      { label: 'Mainland Formation', href: '/mainland' },
      { label: 'Visa Services', href: '/visa-services' },
      { label: 'Bank Account Assistance', href: '/consultation' },
      { label: 'Trade License Cost', href: '/free-zones' },
    ],
  },
  { label: 'Free Zones', href: '/free-zones' },
  { label: 'Mainland', href: '/mainland' },
  { label: 'Visa Services', href: '/visa-services' },
  { label: 'Blog', href: '/blog' },
  { label: 'About', href: '/about' },
];

export const FREE_ZONES = [
  {
    id: 'ancfz',
    name: 'ANCFZ Ajman',
    location: 'Ajman',
    badge: 'MOST AFFORDABLE',
    activities: '500+',
    visas: 'Up to 3 visas',
    timeline: 'Express 24hr',
    price: 4888,
    earlyBird: 4643,
    note: '5% early bird pricing available',
    color: 'emerald',
  },
  {
    id: 'ifza',
    name: 'IFZA Dubai',
    location: 'Dubai Silicon Oasis',
    badge: 'TOP RATED',
    activities: '3,000+',
    visas: '15 visas',
    timeline: '5–7 days',
    price: 12900,
    earlyBird: null,
    note: 'Instalment plans available',
    color: 'bronze',
  },
  {
    id: 'meydan',
    name: 'Meydan FZ',
    location: 'Dubai · Nad Al Sheba',
    badge: 'DIGITAL FIRST',
    activities: '2,500+',
    visas: '9 visas',
    timeline: '3–5 days',
    price: 12500,
    earlyBird: null,
    note: 'Instalment plans available',
    color: 'emerald',
  },
  {
    id: 'shams',
    name: 'SHAMS',
    location: 'Sharjah',
    badge: 'MEDIA SPECIALIST',
    activities: '1,500+',
    visas: '5 visas',
    timeline: '4–6 days',
    price: 8050,
    earlyBird: null,
    note: 'Multi-year discounts available',
    color: 'bronze',
  },
  {
    id: 'spc',
    name: 'SPC Free Zone',
    location: 'Sharjah Publishing City',
    badge: 'INSTANT LICENSE',
    activities: '1,500+',
    visas: 'Up to 100',
    timeline: 'Same day',
    price: 5750,
    earlyBird: null,
    note: 'Instant e-license available',
    color: 'emerald',
  },
  {
    id: 'rakez',
    name: 'RAKEZ',
    location: 'Ras Al Khaimah',
    badge: 'INDUSTRIAL HUB',
    activities: '5,000+',
    visas: 'Unlimited (warehousing)',
    timeline: '7–10 days',
    price: 11500,
    earlyBird: null,
    note: 'Warehousing & industrial plots',
    color: 'bronze',
  },
];

export const INDUSTRIES = [
  {
    name: 'E-Commerce',
    description: 'Payment gateway and logistical proximity for online retailers.',
    top: ['SPC', 'ANCFZ', 'SHAMS'],
    icon: 'ShoppingBag',
  },
  {
    name: 'IT Consultancy',
    description: 'Professional presence and visa quotas for tech advisors.',
    top: ['MEYDAN', 'IFZA', 'ANCFZ'],
    icon: 'Cpu',
  },
  {
    name: 'General Trade',
    description: 'Physical goods import/export with customs clearance.',
    top: ['JAFZA', 'RAKEZ', 'ANCFZ'],
    icon: 'Truck',
  },
  {
    name: 'Digital & Media',
    description: 'Creative, media and digital agencies in licensed hubs.',
    top: ['SHAMS', 'MEYDAN', 'SPC'],
    icon: 'Sparkles',
  },
];

export const ACTIVITY_SAMPLES = [
  'Software Development',
  'General Trading',
  'E-Commerce',
  'IT Consulting',
  'Digital Marketing',
  'Gold Trading',
  'Real Estate',
  'Restaurant',
  'Beauty Salon',
  'Logistics',
];

export const ACTIVITY_RESULTS = {
  'Software Development': {
    activity: 'Software Development',
    bestZone: 'IFZA Dubai',
    cost: 'AED 12,900',
    activityCode: 'A0011',
    matchScore: 96,
    alternative: ['Meydan FZ', 'ANCFZ Ajman'],
  },
  'E-Commerce': {
    activity: 'E-Commerce',
    bestZone: 'SPC Free Zone',
    cost: 'AED 5,750',
    activityCode: 'E2120',
    matchScore: 94,
    alternative: ['ANCFZ Ajman', 'SHAMS'],
  },
  'General Trading': {
    activity: 'General Trading',
    bestZone: 'RAKEZ',
    cost: 'AED 11,500',
    activityCode: 'G4690',
    matchScore: 92,
    alternative: ['JAFZA', 'ANCFZ Ajman'],
  },
  'IT Consulting': {
    activity: 'IT Consulting',
    bestZone: 'Meydan FZ',
    cost: 'AED 12,500',
    activityCode: 'M6202',
    matchScore: 95,
    alternative: ['IFZA Dubai', 'ANCFZ Ajman'],
  },
  'Digital Marketing': {
    activity: 'Digital Marketing',
    bestZone: 'SHAMS',
    cost: 'AED 8,050',
    activityCode: 'M7310',
    matchScore: 93,
    alternative: ['Meydan FZ', 'SPC'],
  },
  'Gold Trading': {
    activity: 'Gold Trading',
    bestZone: 'DMCC',
    cost: 'AED 34,000',
    activityCode: 'G4662',
    matchScore: 90,
    alternative: ['JAFZA', 'RAKEZ'],
  },
  'Real Estate': {
    activity: 'Real Estate Brokerage',
    bestZone: 'Dubai Mainland (DET)',
    cost: 'AED 22,000',
    activityCode: 'L6820',
    matchScore: 88,
    alternative: ['Meydan FZ', 'RAKEZ'],
  },
};

export const TESTIMONIALS = [
  {
    quote: "The only platform that actually told me SHAMS was better for my specific trading model than DMCC — saving me AED 15,000 a year.",
    name: 'Sarah Jenkins',
    role: 'E-Commerce Founder',
    avatar: 'https://i.pravatar.cc/100?img=47',
  },
  {
    quote: "Setup done in 48 hours. The AI Search matched me to ANCFZ instantly — exactly what I needed as a startup.",
    name: 'Rahul Mehta',
    role: 'IT Consultant',
    avatar: 'https://i.pravatar.cc/100?img=12',
  },
  {
    quote: "They exposed the hidden e-channel and renewal fees other consultants buried. Genuinely transparent advice.",
    name: 'Layla Al-Hammadi',
    role: 'F&B Entrepreneur',
    avatar: 'https://i.pravatar.cc/100?img=32',
  },
  {
    quote: "My investor visa and bank account were processed in under three weeks. The team kept me informed every step.",
    name: "James O'Connor",
    role: 'Logistics Director',
    avatar: 'https://i.pravatar.cc/100?img=68',
  },
];

export const PROCESS_STEPS = [
  {
    no: '01',
    title: 'Compare',
    body: 'Use our Smart Finder or AI Search. Get an instant shortlist of 3–5 optimal free zones matched to your activity and budget.',
  },
  {
    no: '02',
    title: 'Validate',
    body: 'Our consultants confirm your exact activity codes and visa requirements with the chosen freezone authority.',
  },
  {
    no: '03',
    title: 'Activate',
    body: 'Submit documents digitally. We handle the trade licence, establishment card and e-Visa — you focus on your business.',
  },
];

export const PLATFORM_STRENGTHS = [
  {
    title: 'Starting from AED 4,888',
    body: 'The lowest-cost legitimate UAE free zone, with 5% early bird pricing available now.',
    icon: 'BadgePercent',
  },
  {
    title: '100% Advisory Fee Waiver',
    body: 'You pay only official government fees. Our advisory service is completely free for the first 500 early clients.',
    icon: 'HandCoins',
  },
  {
    title: 'Free AI Website Bundle',
    body: 'Get a professional business website built for you at zero additional cost on any order above AED 10,000.',
    icon: 'Globe',
  },
  {
    title: 'AI Activity Matching',
    body: 'Type any business activity and instantly see which freezone supports it, with official pricing and expert analysis.',
    icon: 'Sparkles',
  },
];

export const FEATURES = [
  {
    title: 'Pure Neutrality',
    body: 'Not owned by any free zone. Our algorithm ranks jurisdictions solely on your requirements and budget — never on commissions.',
    icon: 'Scale',
  },
  {
    title: 'Hidden Cost Reveal',
    body: 'We expose renewals, mandatory office costs and e-channel fees that others hide behind "starting from" prices.',
    icon: 'Eye',
  },
  {
    title: 'Rapid Onboarding',
    body: 'Digital platform connects directly with licensing authorities. We work to secure the fastest possible timeline.',
    icon: 'Rocket',
  },
];

export const BLOG_POSTS = [
  {
    id: 1,
    slug: 'cheapest-uae-free-zones-2025',
    title: 'The Cheapest UAE Free Zones in 2025 (Honest Cost Breakdown)',
    excerpt: 'A real, unfiltered look at the lowest cost legitimate free zones — including hidden renewal and e-channel fees.',
    image: 'https://images.unsplash.com/flagged/photo-1559717865-a99cac1c95d8?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA4Mzl8MHwxfHNlYXJjaHwzfHxEdWJhaSUyMHNreWxpbmV8ZW58MHx8fHwxNzgwOTgwNDIwfDA&ixlib=rb-4.1.0&q=85',
    category: 'Free Zones',
    date: 'July 8, 2025',
    readTime: '7 min',
  },
  {
    id: 2,
    slug: 'free-zone-vs-mainland-which-is-right',
    title: 'Free Zone vs Mainland: Which Setup is Right For You?',
    excerpt: 'Comparing ownership rules, customs, visa quotas and banking — across both paths so you choose with confidence.',
    image: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2Mzl8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMG1lZXRpbmd8ZW58MHx8fHwxNzgwODg2MDI3fDA&ixlib=rb-4.1.0&q=85',
    category: 'Guides',
    date: 'June 28, 2025',
    readTime: '9 min',
  },
  {
    id: 3,
    slug: 'golden-visa-2025-eligibility',
    title: 'UAE Golden Visa 2025 — Updated Eligibility & Process',
    excerpt: 'Investors, entrepreneurs and specialised talent — how to qualify for the 10-year residency under the latest framework.',
    image: 'https://images.unsplash.com/photo-1611577810610-642f8ac05c32?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTJ8MHwxfHNlYXJjaHwzfHxEdWJhaSUyMG1hcmluYXxlbnwwfHx8fDE3ODA5ODA0MjB8MA&ixlib=rb-4.1.0&q=85',
    category: 'Visa',
    date: 'June 15, 2025',
    readTime: '6 min',
  },
  {
    id: 4,
    slug: 'opening-business-bank-account-uae',
    title: 'Opening a UAE Business Bank Account in 2025',
    excerpt: 'KYC requirements, documents and bank-by-bank turnaround times — plus the common rejection reasons to avoid.',
    image: 'https://images.pexels.com/photos/7693692/pexels-photo-7693692.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
    category: 'Banking',
    date: 'June 1, 2025',
    readTime: '8 min',
  },
];

export const COUNTRY_CODES = [
  { code: '+971', flag: 'AE', label: 'AE +971' },
  { code: '+91', flag: 'IN', label: 'IN +91' },
  { code: '+44', flag: 'UK', label: 'UK +44' },
  { code: '+1', flag: 'US', label: 'US +1' },
  { code: '+966', flag: 'SA', label: 'SA +966' },
  { code: '+92', flag: 'PK', label: 'PK +92' },
  { code: '+880', flag: 'BD', label: 'BD +880' },
  { code: '+20', flag: 'EG', label: 'EG +20' },
  { code: '+974', flag: 'QA', label: 'QA +974' },
  { code: '+965', flag: 'KW', label: 'KW +965' },
];

export const BUDGETS = [
  'Any Budget',
  'Under AED 5,000',
  'AED 5,000 – 10,000',
  'AED 10,000 – 20,000',
  'Above AED 20,000',
];

export const VISA_OPTIONS = [
  '0 — Licence only',
  '1 Visa',
  '2 Visas',
  '3+ Visas',
];

export const OFFICE_TYPES = ['Virtual Desk', 'Physical Office', 'No Preference'];

export const VISA_TYPES = [
  {
    name: 'Golden Visa',
    duration: '10 years',
    audience: 'Investors, specialised talent, entrepreneurs',
    icon: 'Crown',
    color: 'bronze',
  },
  {
    name: 'Investor / Partner Visa',
    duration: '2 years',
    audience: 'Shareholders & business partners',
    icon: 'Briefcase',
    color: 'emerald',
  },
  {
    name: 'Employment Visa',
    duration: '2 years',
    audience: 'Sponsored employees & teams',
    icon: 'UserCheck',
    color: 'emerald',
  },
  {
    name: 'Family Visa',
    duration: '2–3 years',
    audience: 'Spouse, children, dependents',
    icon: 'Users',
    color: 'bronze',
  },
];
