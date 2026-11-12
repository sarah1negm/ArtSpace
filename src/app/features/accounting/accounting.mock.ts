import { AccountingState, LedgerEntry, MonthlyBase, SellerSale, StaffMember } from './accounting.models';

export const COMMISSION_RATE = 0.15;
export const STORAGE_KEY = 'artspace_accounting_v1';

export const MONTHLY_BASE: readonly MonthlyBase[] = [
  { month: '2026-06', tuition: 42000, studio: 9000, galleryGross: 6000, operating: 21000 },
  { month: '2026-07', tuition: 38000, studio: 8500, galleryGross: 7500, operating: 20500 },
  { month: '2026-08', tuition: 36000, studio: 8000, galleryGross: 5200, operating: 20500 },
  { month: '2026-09', tuition: 61000, studio: 12000, galleryGross: 9800, operating: 22000 },
  { month: '2026-10', tuition: 58000, studio: 11500, galleryGross: 12400, operating: 22500 },
  { month: '2026-11', tuition: 55000, studio: 11000, galleryGross: 15600, operating: 22500 },
];

const staff = (
  id: string,
  name: string,
  role: 'Teacher' | 'Staff',
  title: string,
  baseSalary: number,
  allowances: [string, number][],
  deductions: [string, number][],
): StaffMember => ({
  id,
  name,
  role,
  title,
  baseSalary,
  allowances: allowances.map(([label, amount], i) => ({ id: `${id}-a${i}`, label, amount })),
  deductions: deductions.map(([label, amount], i) => ({ id: `${id}-d${i}`, label, amount })),
});

export const INITIAL_STAFF: readonly StaffMember[] = [
  staff('t1', 'Layla Hassan', 'Teacher', 'Painting', 14000, [['Transport', 500], ['Materials', 400]], [['Income tax', 1400], ['Insurance', 450]]),
  staff('t2', 'Omar Farouk', 'Teacher', 'Printmaking', 13000, [['Transport', 500]], [['Income tax', 1300], ['Insurance', 420]]),
  staff('t3', 'Nadia Samir', 'Teacher', 'Drawing', 12500, [['Transport', 500]], [['Income tax', 1250], ['Insurance', 400]]),
  staff('t4', 'Karim Adel', 'Teacher', 'Sculpture', 12000, [['Studio hazard', 600]], [['Income tax', 1200], ['Insurance', 390]]),
  staff('s1', 'Mona Said', 'Staff', 'Administrator', 9000, [['Transport', 400]], [['Income tax', 800], ['Insurance', 300]]),
  staff('s2', 'Youssef Ali', 'Staff', 'Studio technician', 7500, [['Overtime', 350]], [['Income tax', 600], ['Insurance', 260]]),
];

const galleryLedger = (): LedgerEntry[] =>
  MONTHLY_BASE.flatMap((m, i) => [
    { id: `l-host-${m.month}`, month: m.month, type: 'expense' as const, label: 'Hosting & payment fees', amount: 800 },
    { id: `l-cur-${m.month}`, month: m.month, type: 'expense' as const, label: 'Curation & photography', amount: 1000 + i * 150 },
    ...(i === 3
      ? [{ id: 'l-ws', month: m.month, type: 'income' as const, label: 'Gallery opening tickets', amount: 1500 }]
      : []),
  ]);

export const SELLER_SALES: readonly SellerSale[] = [
  { id: 'sale-0', studentName: 'Salma Ibrahim', artworkTitle: 'Desert Light', soldOn: '2026-09-14', price: 950, commissionRate: COMMISSION_RATE },
  { id: 'sale-3', studentName: 'Salma Ibrahim', artworkTitle: 'Night Market', soldOn: '2026-10-09', price: 1400, commissionRate: COMMISSION_RATE },
  { id: 'sale-2', studentName: 'Demo Student', artworkTitle: 'Blue Courtyard', soldOn: '2026-10-22', price: 800, commissionRate: COMMISSION_RATE },
  { id: 'sale-1', studentName: 'Demo Student', artworkTitle: 'Quiet Harbour', soldOn: '2026-11-03', price: 1200, commissionRate: COMMISSION_RATE },
  { id: 'sale-4', studentName: 'Hady Mostafa', artworkTitle: 'Nile at Dusk (print)', soldOn: '2026-11-07', price: 600, commissionRate: COMMISSION_RATE },
  { id: 'sale-5', studentName: 'Hady Mostafa', artworkTitle: 'Old Cairo Rooftops', soldOn: '2026-11-10', price: 1750, commissionRate: COMMISSION_RATE },
];

export const initialState = (): AccountingState => ({
  staff: structuredClone(INITIAL_STAFF) as StaffMember[],
  ledger: galleryLedger(),
  paid: { 'sale-0': '2026-09-30', 'sale-3': '2026-10-15' },
});
