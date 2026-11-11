import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { Role, User } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { StorageService } from '../../core/services/storage.service';

describe('Student portal routes', () => {
  const currentUser = signal<User | null>(null);
  const student: User = {
    id: 'routing-test',
    name: 'Portal Student',
    username: 'student',
    email: 'student@example.com',
    role: 'student',
    picture: '',
    cardLast4: '0000',
    passwordHash: '',
    preferences: { theme: 'light', newsletter: false },
  };

  beforeEach(() => {
    currentUser.set(student);
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
          useValue: { getLocal: (_key: string, fallback: unknown) => fallback, setLocal: () => {} },
        },
      ],
    });
  });

  it('renders the dashboard and each child route in the portal shell', async () => {
    const harness = await RouterTestingHarness.create();
    const pages = [
      ['/student', 'Welcome, Portal Student'],
      ['/student/fees', 'Student fees'],
      ['/student/invoices', 'Invoices'],
      ['/student/artwork', 'Artwork listings'],
      ['/student/sales', 'Student sales'],
    ];
    for (const [url, heading] of pages) {
      await harness.navigateByUrl(url);
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent?.trim()).toBe(heading);
      expect(harness.routeNativeElement?.querySelectorAll('nav a').length).toBe(5);
    }
  });

  it('marks an invoice paid through the page and shows it in fee history', async () => {
    const harness = await RouterTestingHarness.create('/student/invoices');
    const buttons = Array.from(harness.routeNativeElement?.querySelectorAll('button') ?? []);
    buttons.find((button) => button.textContent?.trim() === 'INV-PRINTMAKING')?.click();
    harness.detectChanges();
    const pay = harness.routeNativeElement?.querySelector('section[aria-live] button');
    expect(pay).toBeTruthy();
    (pay as HTMLButtonElement).click();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('section[aria-live] button')).toBeNull();

    await harness.navigateByUrl('/student/fees');
    expect(harness.routeNativeElement?.querySelector('section ul')?.textContent).toContain(
      'Printmaking',
    );
  });

  it('sends a signed-out visitor to login', async () => {
    currentUser.set(null);
    try {
      await RouterTestingHarness.create('/student/fees');
      expect(TestBed.inject(Router).url).toBe('/login');
    } finally {
      sessionStorage.removeItem('artspace_return');
    }
  });
});
