import { Injectable, computed, inject, signal } from '@angular/core';
import { StorageService } from '../../../core/services/storage.service';
import { COMMISSION_RATE, MONTHLY_BASE, SELLER_SALES, STORAGE_KEY, initialState } from '../accounting.mock';
import {
  AccountingState,
  Adjustment,
  GalleryMonth,
  LedgerEntry,
  PayrollLine,
  PayrollReport,
  SchoolMonth,
  SellerSummary,
} from '../accounting.models';

const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (items: readonly { amount: number }[]) => items.reduce((t, i) => t + i.amount, 0);

export const monthLabel = (month: string): string => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en', { month: 'short', year: '2-digit' });
};

@Injectable({ providedIn: 'root' })
export class AccountingService {
  private readonly storage = inject(StorageService);
  private readonly state = signal<AccountingState>(this.storage.getLocal(STORAGE_KEY, initialState()));

  readonly months = MONTHLY_BASE.map((m) => m.month);
  readonly commissionRate = COMMISSION_RATE;

  // ---------------- payroll ----------------
  readonly payroll = computed<PayrollLine[]>(() =>
    this.state().staff.map((s) => {
      const totalAllowances = round2(sum(s.allowances));
      const totalDeductions = round2(sum(s.deductions));
      return {
        id: s.id,
        name: s.name,
        role: s.role,
        title: s.title,
        baseSalary: s.baseSalary,
        allowances: s.allowances,
        totalAllowances,
        deductions: s.deductions,
        totalDeductions,
        netSalary: round2(s.baseSalary + totalAllowances - totalDeductions),
      };
    }),
  );
  readonly totalPayroll = computed(() => round2(this.payroll().reduce((t, l) => t + l.netSalary, 0)));

  // ---------------- seller payouts ----------------
  readonly payouts = computed(() =>
    SELLER_SALES.map((s) => {
      const commission = round2(s.price * s.commissionRate);
      const paidOn = this.state().paid[s.id] ?? null;
      return { ...s, commission, earnings: round2(s.price - commission), paidOn, status: paidOn ? 'Paid' : 'Pending' };
    }),
  );
  readonly sellers = computed<SellerSummary[]>(() => {
    const map = new Map<string, SellerSummary>();
    for (const p of this.payouts()) {
      const row = map.get(p.studentName) ?? {
        studentName: p.studentName, sales: 0, gross: 0, commission: 0, earnings: 0, pending: 0, paid: 0,
      };
      row.sales += 1;
      row.gross = round2(row.gross + p.price);
      row.commission = round2(row.commission + p.commission);
      row.earnings = round2(row.earnings + p.earnings);
      if (p.paidOn) row.paid = round2(row.paid + p.earnings);
      else row.pending = round2(row.pending + p.earnings);
      map.set(p.studentName, row);
    }
    return [...map.values()];
  });
  readonly pendingPayouts = computed(() => round2(this.sellers().reduce((t, s) => t + s.pending, 0)));
  readonly totalCommission = computed(() => round2(this.payouts().reduce((t, p) => t + p.commission, 0)));

  // ---------------- gallery department ----------------
  readonly ledger = computed(() => this.state().ledger);
  readonly galleryMonthly = computed<GalleryMonth[]>(() =>
    MONTHLY_BASE.map((m) => {
      const entries = this.state().ledger.filter((e) => e.month === m.month);
      const commission = round2(m.galleryGross * COMMISSION_RATE);
      const otherIncome = sum(entries.filter((e) => e.type === 'income'));
      const expenses = sum(entries.filter((e) => e.type === 'expense'));
      const income = round2(commission + otherIncome);
      return {
        month: m.month, label: monthLabel(m.month), gross: m.galleryGross, commission,
        otherIncome, income, expenses, profit: round2(income - expenses),
      };
    }),
  );
  readonly galleryTotals = computed(() => {
    const g = this.galleryMonthly();
    const t = (k: 'gross' | 'commission' | 'income' | 'expenses' | 'profit') => round2(g.reduce((a, m) => a + m[k], 0));
    return { gross: t('gross'), commission: t('commission'), income: t('income'), expenses: t('expenses'), profit: t('profit') };
  });

  // ---------------- whole school ----------------
  readonly monthly = computed<SchoolMonth[]>(() => {
    const payroll = this.totalPayroll();
    const gallery = this.galleryMonthly();
    return MONTHLY_BASE.map((m, i) => {
      const g = gallery[i];
      const income = round2(m.tuition + m.studio + g.income);
      const expenses = round2(payroll + m.operating + g.expenses);
      return {
        month: m.month, label: monthLabel(m.month), tuition: m.tuition, studio: m.studio, gallery: g.income,
        income, payroll, operating: m.operating, galleryExpenses: g.expenses, expenses, net: round2(income - expenses),
      };
    });
  });
  readonly totals = computed(() => {
    const m = this.monthly();
    const t = (k: 'income' | 'expenses' | 'net') => round2(m.reduce((a, x) => a + x[k], 0));
    return { income: t('income'), expenses: t('expenses'), net: t('net') };
  });

  // ---------------- payroll actions ----------------
  setBaseSalary(staffId: string, amount: number): boolean {
    if (!Number.isFinite(amount) || amount < 0) return false;
    this.update((s) => ({
      ...s,
      staff: s.staff.map((m) => (m.id === staffId ? { ...m, baseSalary: round2(amount) } : m)),
    }));
    return true;
  }

  addAdjustment(staffId: string, kind: 'allowances' | 'deductions', label: string, amount: number): boolean {
    const clean = label.trim();
    if (!clean || !Number.isFinite(amount) || amount <= 0) return false;
    const adj: Adjustment = { id: crypto.randomUUID(), label: clean, amount: round2(amount) };
    this.update((s) => ({
      ...s,
      staff: s.staff.map((m) => (m.id === staffId ? { ...m, [kind]: [...m[kind], adj] } : m)),
    }));
    return true;
  }

  removeAdjustment(staffId: string, kind: 'allowances' | 'deductions', adjId: string): void {
    this.update((s) => ({
      ...s,
      staff: s.staff.map((m) =>
        m.id === staffId ? { ...m, [kind]: m[kind].filter((a) => a.id !== adjId) } : m,
      ),
    }));
  }

  generateReport(month: string): PayrollReport {
    const employees = this.payroll();
    const t = (k: 'baseSalary' | 'totalAllowances' | 'totalDeductions' | 'netSalary') =>
      round2(employees.reduce((a, e) => a + e[k], 0));
    return {
      month,
      generatedOn: this.today(),
      currency: 'EGP',
      employees,
      totals: {
        baseSalary: t('baseSalary'), allowances: t('totalAllowances'),
        deductions: t('totalDeductions'), netSalary: t('netSalary'),
      },
    };
  }

  // ---------------- payout actions (simulated) ----------------
  processPayout(saleId: string): boolean {
    if (!SELLER_SALES.some((s) => s.id === saleId) || this.state().paid[saleId]) return false;
    const today = this.today();
    this.update((s) => ({ ...s, paid: { ...s.paid, [saleId]: today } }));
    return true;
  }

  processStudentPayouts(studentName: string): number {
    return this.processMany(this.payouts().filter((p) => p.studentName === studentName && !p.paidOn));
  }

  processAllPayouts(): number {
    return this.processMany(this.payouts().filter((p) => !p.paidOn));
  }

  // ---------------- department budget actions ----------------
  addLedgerEntry(entry: Omit<LedgerEntry, 'id'>): boolean {
    const label = entry.label.trim();
    if (!label || !Number.isFinite(entry.amount) || entry.amount <= 0 || !this.months.includes(entry.month)) {
      return false;
    }
    this.update((s) => ({
      ...s,
      ledger: [...s.ledger, { ...entry, label, amount: round2(entry.amount), id: crypto.randomUUID() }],
    }));
    return true;
  }

  removeLedgerEntry(id: string): void {
    this.update((s) => ({ ...s, ledger: s.ledger.filter((e) => e.id !== id) }));
  }

  /** Restore the demo data (handy before a presentation). */
  reset(): void {
    this.update(() => initialState());
  }

  // ---------------- internals ----------------
  private processMany(rows: { id: string }[]): number {
    if (!rows.length) return 0;
    const today = this.today();
    this.update((s) => ({ ...s, paid: { ...s.paid, ...Object.fromEntries(rows.map((r) => [r.id, today])) } }));
    return rows.length;
  }

  private update(fn: (s: AccountingState) => AccountingState): void {
    const next = fn(this.state());
    this.storage.setLocal(STORAGE_KEY, next);
    this.state.set(next);
  }

  private today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
