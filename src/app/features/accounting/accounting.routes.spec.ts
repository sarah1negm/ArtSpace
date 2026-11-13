import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { Role, User } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { StorageService } from '../../core/services/storage.service';

describe('Accounting portal routes', () => {
  const currentUser = signal<User | null>(null);
  const user = (role: Role): User => ({
    id: 'u1', name: 'Test', username: 'test', email: 't@example.com', role,
    picture: '', cardLast4: '0000', passwordHash: '', preferences: { theme: 'light', newsletter: false },
  });

  beforeEach(() => {
    currentUser.set(user('accountant'));
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        {
          provide: AuthService,
          useValue: {
            currentUser,
            isLoggedIn: () => !!currentUser(),
            role: (): Role | null => currentUser()?.role ?? null,
            getRememberedUsername: () => '',
          },
        },
        {
          provide: StorageService,
          useValue: { getLocal: (_k: string, fallback: unknown) => fallback, setLocal: () => {} },
        },
      ],
    });
  });

  it('renders every accounting page for an accountant', async () => {
    const harness = await RouterTestingHarness.create();
    const pages = [
      ['/accounting', 'Accounting dashboard'],
      ['/accounting/payroll', 'Staff payroll'],
      ['/accounting/payouts', 'Seller payouts'],
      ['/accounting/budget', 'Department budget'],
    ];
    for (const [url, heading] of pages) {
      await harness.navigateByUrl(url);
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent?.trim()).toBe(heading);
      expect(harness.routeNativeElement?.querySelectorAll('nav a').length).toBe(4);
    }
  });

  it('updates the net salary when a base salary is edited in the UI', async () => {
    const harness = await RouterTestingHarness.create('/accounting/payroll');
    const el = harness.routeNativeElement!;
    const manage = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Manage Layla'));
    manage!.click();
    harness.detectChanges();
    const input = el.querySelector('input[type=number]') as HTMLInputElement;
    input.value = '20000';
    (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Save base')) as HTMLButtonElement).click();
    harness.detectChanges();
    expect(el.querySelector('section[aria-live]')?.textContent).toContain('19,050');
  });

  it('marks a payout as paid from the page', async () => {
    const harness = await RouterTestingHarness.create('/accounting/payouts');
    const el = harness.routeNativeElement!;
    const btn = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Pay Quiet Harbour'));
    btn!.click();
    harness.detectChanges();
    expect(Array.from(el.querySelectorAll('button')).some((b) => b.textContent?.includes('Pay Quiet Harbour'))).toBeFalse();
  });

  it('keeps students out of the accounting portal', async () => {
    currentUser.set(user('student'));
    await RouterTestingHarness.create('/accounting');
    expect(TestBed.inject(Router).url).toBe('/');
  });
});
