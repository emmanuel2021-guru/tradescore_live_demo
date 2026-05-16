// Shape-only trader profile. Real values come from /api/me, /api/score and
// /api/transactions — every numeric field starts null so the UI shows "—"
// or empty state instead of fake numbers for brand-new accounts. The
// landing-page hero still uses these as a stand-in (it's marketing, not
// user data) but inside the dashboard nothing should display a TRADER
// default once a real user is signed in.
export const TRADER = {
  name: '',
  firstName: '',
  business: '',
  location: '',
  since: '',
  avatar: '',
  email: '',
  phone: '',

  score: null,
  maxScore: 850,
  monthlyRevenue: null,
  transactions: null,
  growth: null,
  streak: null,
  loanEligible: null,
  uniqueCustomers: null,
  squadWallet: null,
};

// 30 days of transactions — richer dataset than before so the
// transaction page and AI categorisation feel populated.
export const TXS = [
  { id:  1, name: 'Customer Payment',    type: 'in',  amount: 15500, time: 'Today, 2:14 PM',     ref: 'SQ-PAY-9421' },
  { id:  2, name: 'Customer Payment',    type: 'in',  amount:  8200, time: 'Today, 11:30 AM',    ref: 'SQ-PAY-9418' },
  { id:  3, name: 'Stock Purchase',      type: 'out', amount: 45000, time: 'Yesterday, 3:20 PM', ref: 'SQ-OUT-2104' },
  { id:  4, name: 'Customer Payment',    type: 'in',  amount: 22000, time: 'Yesterday, 1:05 PM', ref: 'SQ-PAY-9407' },
  { id:  5, name: 'Customer Payment',    type: 'in',  amount:  9800, time: 'Mon, 4:45 PM',        ref: 'SQ-PAY-9389' },
  { id:  6, name: 'Rent Payment',        type: 'out', amount: 80000, time: 'Mon, 10:00 AM',       ref: 'SQ-OUT-2098' },
  { id:  7, name: 'Customer Payment',    type: 'in',  amount: 31000, time: 'Sun, 12:44 PM',       ref: 'SQ-PAY-9367' },
  { id:  8, name: 'Customer Payment',    type: 'in',  amount: 12300, time: 'Sat, 5:21 PM',        ref: 'SQ-PAY-9344' },
  { id:  9, name: 'Wholesale Stock',     type: 'out', amount: 65000, time: 'Sat, 9:10 AM',        ref: 'SQ-OUT-2079' },
  { id: 10, name: 'Customer Payment',    type: 'in',  amount: 18400, time: 'Fri, 4:02 PM',        ref: 'SQ-PAY-9301' },
  { id: 11, name: 'Customer Payment',    type: 'in',  amount: 27600, time: 'Fri, 1:18 PM',        ref: 'SQ-PAY-9295' },
  { id: 12, name: 'Transport',           type: 'out', amount:  5500, time: 'Thu, 7:40 AM',        ref: 'SQ-OUT-2061' },
  { id: 13, name: 'Customer Payment',    type: 'in',  amount: 14200, time: 'Thu, 3:55 PM',        ref: 'SQ-PAY-9277' },
  { id: 14, name: 'Electricity Bill',    type: 'out', amount: 12500, time: 'Wed, 11:30 AM',       ref: 'SQ-OUT-2044' },
  { id: 15, name: 'Customer Payment',    type: 'in',  amount: 21000, time: 'Wed, 2:14 PM',        ref: 'SQ-PAY-9261' },
  { id: 16, name: 'Customer Payment',    type: 'in',  amount: 17500, time: 'Tue, 6:48 PM',        ref: 'SQ-PAY-9244' },
  { id: 17, name: 'Stock Purchase',      type: 'out', amount: 38000, time: 'Tue, 10:00 AM',       ref: 'SQ-OUT-2031' },
];

export const FACTORS = [
  { label: 'Transaction Volume',  value: 88, weight: 30, desc: '₦847K avg. monthly revenue' },
  { label: 'Payment Consistency', value: 82, weight: 25, desc: 'Steady income over 14 months' },
  { label: 'Business Growth',     value: 76, weight: 20, desc: '+18.4% revenue growth MoM' },
  { label: 'Account Longevity',   value: 71, weight: 15, desc: 'Active since March 2023' },
  { label: 'Customer Diversity',  value: 79, weight: 10, desc: '184 unique payers this month' },
];

export const REV  = [420000, 510000, 490000, 630000, 580000, 710000, 847500];
export const MONS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];

// Job-seeker pool — the workforce side of the ecosystem. These are unemployed
// youth / informal hands who have onboarded to Squad and built a payment
// history through gigs. Each gig paid via Squad lands in their virtual
// account, feeds the same TradeScore engine, and slowly unlocks credit for
// them — that's the systemic loop Challenge 02 asks for.
export const WORKERS = [
  {
    id: 'w1', name: 'Tunde Adebayo',     area: 'Yaba',     distanceKm: 1.8,
    skills: ['delivery', 'load-bearer', 'errand', 'market-run'],
    languages: ['English', 'Yoruba'], rating: 4.9, gigsCompleted: 87,
    tradeScore: 678, hasSquadWallet: true, hourlyRate: 1500,
    bio: 'Owns a bike · same-day market runs',
  },
  {
    id: 'w2', name: 'Chiamaka Okeke',    area: 'Surulere', distanceKm: 3.2,
    skills: ['shop-help', 'cashier', 'inventory-count', 'customer-service'],
    languages: ['English', 'Igbo'], rating: 4.8, gigsCompleted: 64,
    tradeScore: 642, hasSquadWallet: true, hourlyRate: 1200,
    bio: 'Two years retail experience',
  },
  {
    id: 'w3', name: 'Ibrahim Musa',      area: 'Mushin',   distanceKm: 2.4,
    skills: ['delivery', 'load-bearer', 'stock-running', 'market-run'],
    languages: ['English', 'Hausa', 'Yoruba'], rating: 4.7, gigsCompleted: 112,
    tradeScore: 701, hasSquadWallet: true, hourlyRate: 1400,
    bio: 'Strong lifter · Balogun & Idumota daily',
  },
  {
    id: 'w4', name: 'Blessing Eze',      area: 'Yaba',     distanceKm: 0.9,
    skills: ['shop-help', 'cashier', 'social-media', 'customer-service'],
    languages: ['English', 'Igbo', 'Pidgin'], rating: 4.6, gigsCompleted: 31,
    tradeScore: 598, hasSquadWallet: true, hourlyRate: 1100,
    bio: 'New to gigs, eager · ND Marketing',
  },
  {
    id: 'w5', name: 'Femi Lawal',        area: 'Lagos Island', distanceKm: 5.6,
    skills: ['delivery', 'errand', 'driver'],
    languages: ['English', 'Yoruba'], rating: 4.5, gigsCompleted: 48,
    tradeScore: 615, hasSquadWallet: true, hourlyRate: 1600,
    bio: 'Has a car · long-distance runs',
  },
  {
    id: 'w6', name: 'Amaka Nwosu',       area: 'Surulere', distanceKm: 3.8,
    skills: ['inventory-count', 'cashier', 'bookkeeping'],
    languages: ['English', 'Igbo'], rating: 4.9, gigsCompleted: 22,
    tradeScore: 581, hasSquadWallet: true, hourlyRate: 1300,
    bio: 'Studies accounting · meticulous',
  },
];

// Microcredit products for workers / job seekers. Smaller principals, shorter
// terms, framed around real informal-economy use cases (transport advance,
// skills training, asset purchase). Same underwriting engine — same TradeScore
// gates each tier — but the products are appropriate to the user's earning
// scale. This is the financial-inclusion side of the loop.
export const WORKER_LOAN_TIERS = [
  {
    name: 'GT Starter Boost',
    bank: 'GTBank',
    minScore: 550,
    max: 20_000,
    rateMonthly: 2.5,
    aprNote: '30% p.a.',
    term: '30 days',
    desc: 'Transport advance, airtime, urgent supplies',
    fees: '₦500 flat origination',
    icon: 'lightning-charge-fill',
  },
  {
    name: 'GT Skills Loan',
    bank: 'GTBank',
    minScore: 620,
    max: 80_000,
    rateMonthly: 2.0,
    aprNote: '24% p.a.',
    term: '60 days',
    desc: 'Certifications, training, vocational courses',
    fees: '1% mgmt fee',
    icon: 'mortarboard-fill',
  },
  {
    name: 'GT Asset Loan',
    bank: 'GTBank',
    minScore: 700,
    max: 300_000,
    rateMonthly: 1.8,
    aprNote: '21.6% p.a.',
    term: '90 days',
    desc: 'Bike, equipment, tools for self-employment',
    fees: '1% mgmt fee · 1% insurance',
    icon: 'tools',
  },
];

// Real GTBank loan products (sourced from gtbank.com SME & retail offerings).
// Rates are GTBank's published monthly equivalents; tenors are real GTBank terms.
// Management fee 1% + insurance ~1% apply on disbursement (shown in calculator note).
export const LOAN_TIERS = [
  {
    name: 'GT Quick Credit',
    bank: 'GTBank',
    minScore: 600,
    max: 500000,
    rateMonthly: 1.33,
    aprNote: '16% p.a.',
    term: '6 months',
    desc: 'Same-day digital loan, no collateral · *737*51*51#',
    fees: '1% mgmt fee · 0.5% insurance',
    icon: 'lightning-charge-fill',
  },
  {
    name: 'GT Smart Advance',
    bank: 'GTBank',
    minScore: 670,
    max: 2000000,
    rateMonthly: 1.5,
    aprNote: '18% p.a.',
    term: '12 months',
    desc: 'Pre-approved working-capital loan for SMEs',
    fees: '1% mgmt fee · 1% insurance',
    icon: 'cash-coin',
  },
  {
    name: 'GT MaxPlus SME',
    bank: 'GTBank',
    minScore: 720,
    max: 5000000,
    rateMonthly: 1.75,
    aprNote: '21% p.a.',
    term: '24 months',
    desc: 'Inventory financing & store improvement',
    fees: '1% mgmt fee · 1% insurance',
    icon: 'shop',
  },
  {
    name: 'GT SME Growth',
    bank: 'GTBank',
    minScore: 770,
    max: 10000000,
    rateMonthly: 2.0,
    aprNote: '24% p.a.',
    term: '36 months',
    desc: 'Expansion capital (2nd location, equipment)',
    fees: '1% mgmt fee · 1% insurance · 5% equity',
    icon: 'graph-up-arrow',
  },
];
