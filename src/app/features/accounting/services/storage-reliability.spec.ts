import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AccountingService } from './accounting.service';
import { STORAGE_KEY } from '../accounting.mock';
import { routes } from '../../../app.routes';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/user.model';

describe('Accounting persistence failures', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  for (const name of ['QuotaExceededError', 'SecurityError']) {
    it(`rejects payroll, budget, payouts and reset without changing state or saved data (${name})`, () => {
      const acc = TestBed.inject(AccountingService);
      acc.setBaseSalary('t1', 15000);
      const previous = localStorage.getItem(STORAGE_KEY);
      const snapshot = {
        payroll: acc.payroll(),
        ledger: acc.ledger(),
        payouts: acc.payouts(),
        totals: acc.totals(),
        gallery: acc.galleryTotals(),
      };
      const write = spyOn(Storage.prototype, 'setItem').and.callFake(() => {
        throw new DOMException('blocked', name);
      });
      expect(acc.setBaseSalary('t1', 99999)).toBeFalse();
      expect(acc.addAdjustment('t1', 'allowances', 'Bonus', 1000)).toBeFalse();
      expect(acc.removeAdjustment('t1', 'deductions', 't1-d0')).toBeFalse();
      expect(
        acc.addLedgerEntry({ month: '2026-11', type: 'expense', label: 'Frames', amount: 500 }),
      ).toBeFalse();
      expect(acc.removeLedgerEntry(acc.ledger()[0].id)).toBeFalse();
      expect(acc.processPayout('sale-1')).toBeFalse();
      expect(
        acc.processStudentPayouts(acc.payouts().find((item) => item.id === 'sale-1')!.studentName),
      ).toBe(0);
      expect(acc.processAllPayouts()).toBe(0);
      expect(acc.reset()).toBeFalse();
      expect({
        payroll: acc.payroll(),
        ledger: acc.ledger(),
        payouts: acc.payouts(),
        totals: acc.totals(),
        gallery: acc.galleryTotals(),
      }).toEqual(snapshot);
      expect(localStorage.getItem(STORAGE_KEY)).toBe(previous);
      expect(acc.storageError()).toContain('could not be saved');
      write.and.callThrough();
      expect(acc.processPayout('sale-1')).toBeTrue();
      expect(acc.storageError()).toBe('');
      TestBed.resetTestingModule();
      const restored = TestBed.inject(AccountingService);
      expect(restored.payouts().find((item) => item.id === 'sale-1')?.status).toBe('Paid');
      expect(restored.payroll().find((item) => item.id === 't1')?.baseSalary).toBe(15000);
    });
  }
  it('shows an error and keeps payroll form values instead of success messages', async () => {
    const user: User = {
      id: 'accountant',
      name: 'Accountant',
      username: 'accountant',
      email: 'a@example.com',
      role: 'accountant',
      picture: '',
      cardLast4: '0000',
      passwordHash: '',
      preferences: { theme: 'light', newsletter: false },
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        {
          provide: AuthService,
          useValue: { currentUser: signal(user), isLoggedIn: () => true, role: () => 'accountant' },
        },
      ],
    });
    const harness = await RouterTestingHarness.create('/accounting/payroll');
    const page = harness.routeNativeElement!;
    const click = (text: string) => {
      [...page.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!.click();
      harness.detectChanges();
    };
    click('Manage Layla Hassan');
    const input = page.querySelector<HTMLInputElement>('input[type=number]')!;
    input.value = '20000';
    const write = spyOn(Storage.prototype, 'setItem').and.throwError('blocked');
    input.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    harness.detectChanges();
    expect(page.querySelector('[role=alert]')?.textContent).toContain('could not be saved');
    expect(page.textContent).not.toContain('Base salary updated.');
    expect(input.value).toBe('20000');
    write.and.callThrough();
    input.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    harness.detectChanges();
    expect(page.querySelector('[role=alert]')).toBeNull();
    expect(page.textContent).toContain('Base salary updated.');
    await harness.navigateByUrl('/accounting/payouts');
    write.and.throwError('quota');
    const payoutPage = harness.routeNativeElement!;
    const button = [...payoutPage.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Pay Quiet Harbour'),
    )!;
    button.click();
    harness.detectChanges();
    expect(payoutPage.querySelector('[role=alert]')?.textContent).toContain('could not be saved');
    expect(payoutPage.textContent).not.toContain('processed.');
    expect(
      TestBed.inject(AccountingService)
        .payouts()
        .find((item) => item.id === 'sale-1')?.status,
    ).toBe('Pending');
  });
});
