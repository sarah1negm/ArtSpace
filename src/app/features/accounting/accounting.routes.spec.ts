import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { Role, User } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { StorageService } from '../../core/services/storage.service';

describe('Accounting portal routes', () => {
  let originalTheme: string | null;
  const currentUser = signal<User | null>(null);
  const user = (role: Role): User => ({
    id: 'u1', name: 'Test', username: 'test', email: 't@example.com', role,
    picture: '', cardLast4: '0000', passwordHash: '', preferences: { theme: 'light', newsletter: false },
  });

  beforeEach(() => {
    originalTheme = document.documentElement.getAttribute('data-theme');
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
            readStudentArtists: () => ({ ok: true, value: [] }),
          },
        },
        {
          provide: StorageService,
          useValue: { loadLocal: () => ({ status: 'missing' }), setLocal: () => true },
        },
      ],
    });
  });

  afterEach(() => {
    if (originalTheme === null) document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', originalTheme);
  });

  function contrast(foreground: string, background: string): number {
    const luminance = (color: string) => {
      const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    const a = luminance(foreground), b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  for (const theme of ['light', 'dark']) {
    it(`keeps Accounting status text above 4.5:1 on rendered backgrounds in ${theme} mode`, async () => {
      document.documentElement.setAttribute('data-theme', theme);
      const harness = await RouterTestingHarness.create();
      for (const path of ['/accounting', '/accounting/budget', '/accounting/payroll', '/accounting/payouts']) {
        await harness.navigateByUrl(path);
        const root = harness.routeNativeElement!;
        const statuses = root.querySelectorAll<HTMLElement>('.pos, .neg');
        if (path === '/accounting' || path === '/accounting/budget') {
          expect(statuses.length).withContext(path).toBeGreaterThan(0);
        }
        for (const status of statuses) {
          const background = getComputedStyle(status.closest('.panel')!).backgroundColor;
          expect(background).toBe(theme === 'dark' ? 'rgb(34, 31, 46)' : 'rgb(255, 255, 255)');
          // Exercise both profit/loss states even when mock figures all have the same sign.
          for (const sign of ['pos', 'neg']) {
            status.classList.remove('pos', 'neg');
            status.classList.add(sign);
            expect(contrast(getComputedStyle(status).color, background))
              .withContext(`${path} ${sign} in ${theme}`).toBeGreaterThanOrEqual(4.5);
          }
        }
        for (const badge of root.querySelectorAll<HTMLElement>('.badge')) {
          const style = getComputedStyle(badge);
          expect(contrast(style.color, style.backgroundColor))
            .withContext(`${path} badge in ${theme}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }

  it('updates status colors when the theme changes on an existing Accounting page', async () => {
    const harness = await RouterTestingHarness.create('/accounting');
    const status = harness.routeNativeElement!.querySelector<HTMLElement>('.pos, .neg')!;
    expect(status).not.toBeNull();
    const panel = status.closest('.panel')!;
    for (const sign of ['pos', 'neg']) {
      status.classList.remove('pos', 'neg');
      status.classList.add(sign);
      document.documentElement.setAttribute('data-theme', 'light');
      const light = getComputedStyle(status).color;
      document.documentElement.setAttribute('data-theme', 'dark');
      expect(getComputedStyle(status).color).not.toBe(light);
      expect(contrast(getComputedStyle(status).color, getComputedStyle(panel).backgroundColor))
        .toBeGreaterThanOrEqual(4.5);
      document.documentElement.setAttribute('data-theme', 'light');
      expect(getComputedStyle(status).color).toBe(light);
    }
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
