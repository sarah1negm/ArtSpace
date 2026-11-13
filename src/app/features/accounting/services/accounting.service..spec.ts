import { TestBed } from '@angular/core/testing';
import { StorageService } from '../../../core/services/storage.service';
import { AccountingService } from './accounting.service';

describe('AccountingService', () => {
  let service: AccountingService;
  let saved: Record<string, unknown>;

  beforeEach(() => {
    saved = {};
    TestBed.configureTestingModule({
      providers: [
        {
          provide: StorageService,
          useValue: {
            getLocal: (_k: string, fallback: unknown) => fallback,
            setLocal: (k: string, v: unknown) => (saved[k] = v),
          },
        },
      ],
    });
    service = TestBed.inject(AccountingService);
  });

  it('calculates net salary as base + allowances - deductions', () => {
    const layla = service.payroll().find((p) => p.id === 't1')!;
    expect(layla.netSalary).toBe(14000 + 900 - 1850);
  });

  it('recalculates net salary and persists after edits', () => {
    expect(service.setBaseSalary('t1', 15000)).toBeTrue();
    expect(service.addAdjustment('t1', 'allowances', 'Bonus', 1000)).toBeTrue();
    expect(service.addAdjustment('t1', 'deductions', 'Loan', 500)).toBeTrue();
    expect(service.payroll().find((p) => p.id === 't1')!.netSalary).toBe(15000 + 1900 - 2350);
    expect(Object.keys(saved).length).toBe(1);
  });

  it('rejects invalid salary input', () => {
    expect(service.setBaseSalary('t1', -5)).toBeFalse();
    expect(service.addAdjustment('t1', 'allowances', '  ', 100)).toBeFalse();
    expect(service.addAdjustment('t1', 'deductions', 'Fine', 0)).toBeFalse();
  });

  it('removes an adjustment', () => {
    service.removeAdjustment('t1', 'deductions', 't1-d0');
    expect(service.payroll().find((p) => p.id === 't1')!.totalDeductions).toBe(450);
  });

  it('generates a JSON salary report whose totals match the staff rows', () => {
    const report = service.generateReport('2026-11');
    expect(report.month).toBe('2026-11');
    expect(report.employees.length).toBe(6);
    expect(report.totals.netSalary).toBe(service.totalPayroll());
    expect(() => JSON.parse(JSON.stringify(report))).not.toThrow();
  });

  it('splits each sale into 15% commission and student earnings', () => {
    const sale = service.payouts().find((p) => p.id === 'sale-1')!;
    expect(sale.commission).toBe(180);
    expect(sale.earnings).toBe(1020);
    expect(sale.status).toBe('Pending');
  });

  it('processes payouts and reduces the pending total', () => {
    const before = service.pendingPayouts();
    const earnings = service.payouts().find((p) => p.id === 'sale-1')!.earnings;
    expect(service.processPayout('sale-1')).toBeTrue();
    expect(service.processPayout('sale-1')).toBeFalse(); // cannot pay twice
    expect(service.pendingPayouts()).toBeCloseTo(before - earnings, 2);
    expect(service.processAllPayouts()).toBeGreaterThan(0);
    expect(service.pendingPayouts()).toBe(0);
  });

  it('computes gallery profit and includes ledger entries', () => {
    const before = service.galleryTotals();
    expect(service.addLedgerEntry({ month: '2026-11', type: 'expense', label: 'Frames', amount: 500 })).toBeTrue();
    expect(service.galleryTotals().expenses).toBeCloseTo(before.expenses + 500, 2);
    expect(service.galleryTotals().profit).toBeCloseTo(before.profit - 500, 2);
    expect(service.addLedgerEntry({ month: '1999-01', type: 'income', label: 'x', amount: 5 })).toBeFalse();
  });

  it('feeds payroll and gallery figures into the school totals', () => {
    const m = service.monthly()[5];
    expect(m.expenses).toBe(m.payroll + m.operating + m.galleryExpenses);
    expect(m.net).toBe(m.income - m.expenses);
  });
});
