export interface Adjustment {
  id: string;
  label: string;
  amount: number;
}

export interface StaffMember {
  id: string;
  name: string;
  role: 'Teacher' | 'Staff';
  title: string;
  baseSalary: number;
  allowances: Adjustment[];
  deductions: Adjustment[];
}

export interface LedgerEntry {
  id: string;
  month: string; // 'YYYY-MM'
  type: 'income' | 'expense';
  label: string;
  amount: number;
}

export interface SellerSale {
  id: string;
  studentName: string;
  artworkTitle: string;
  soldOn: string;
  price: number;
  commissionRate: number;
}

/** Everything the accountant can change; persisted in localStorage. */
export interface AccountingState {
  staff: StaffMember[];
  ledger: LedgerEntry[];
  /** saleId -> ISO date the seller payout was processed */
  paid: Record<string, string>;
}

export interface MonthlyBase {
  month: string;
  tuition: number;
  studio: number;
  galleryGross: number;
  operating: number;
}

export interface PayrollLine {
  id: string;
  name: string;
  role: string;
  title: string;
  baseSalary: number;
  allowances: Adjustment[];
  totalAllowances: number;
  deductions: Adjustment[];
  totalDeductions: number;
  netSalary: number;
}

export interface PayrollReport {
  month: string;
  generatedOn: string;
  currency: 'EGP';
  employees: PayrollLine[];
  totals: { baseSalary: number; allowances: number; deductions: number; netSalary: number };
}

export interface GalleryMonth {
  month: string;
  label: string;
  gross: number;
  commission: number;
  otherIncome: number;
  income: number;
  expenses: number;
  profit: number;
}

export interface SchoolMonth {
  month: string;
  label: string;
  tuition: number;
  studio: number;
  gallery: number;
  income: number;
  payroll: number;
  operating: number;
  galleryExpenses: number;
  expenses: number;
  net: number;
}

export interface SellerSummary {
  studentName: string;
  sales: number;
  gross: number;
  commission: number;
  earnings: number;
  pending: number;
  paid: number;
}
