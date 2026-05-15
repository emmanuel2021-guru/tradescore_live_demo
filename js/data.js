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

export const LOAN_TIERS = [
  { name: 'Quick Float',   minScore: 600, max:  100000, rateMonthly: 3.5, term: '30 days',  desc: 'Same-day cash for emergencies' },
  { name: 'Stock Boost',   minScore: 680, max:  300000, rateMonthly: 2.8, term: '60 days',  desc: 'Re-stock inventory comfortably'    },
  { name: 'Growth Credit', minScore: 720, max:  500000, rateMonthly: 2.2, term: '90 days',  desc: 'Mid-cycle business expansion'       },
  { name: 'Expansion',     minScore: 780, max: 1000000, rateMonthly: 1.8, term: '120 days', desc: 'Open a second location'            },
];
