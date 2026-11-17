import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { signal } from '@angular/core';
import { AuthService } from './core/services/auth.service';
import { User } from './core/models/user.model';

describe('App', () => {
  it('creates the app shell', async () => {
    await TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([])] }).compileComponents();
    expect(TestBed.createComponent(App).componentInstance).toBeTruthy();
  });
});

describe('App cookie initialization', () => {
  let previousTheme: string | null;

  beforeEach(async () => {
    previousTheme = document.documentElement.getAttribute('data-theme');
    const auth = {
      currentUser: signal<User | null>(null),
      isLoggedIn: () => false,
      role: () => null,
      seedDemoUsers: jasmine.createSpy('seedDemoUsers'),
    };
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
  });

  afterEach(() => {
    if (previousTheme === null) document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', previousTheme);
  });

  it('initializes with malformed theme and consent cookies using safe defaults', () => {
    spyOnProperty(document, 'cookie', 'get').and.returnValue('artspace_theme=%; artspace_consent=%E0%A4%A');
    const write = spyOnProperty(document, 'cookie', 'set');
    const fixture = TestBed.createComponent(App);
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(fixture.nativeElement.querySelector('[aria-label="Cookie notice"]')).toBeTruthy();
    expect(write).not.toHaveBeenCalled();
  });

  it('preserves correctly encoded theme and consent cookies', () => {
    spyOnProperty(document, 'cookie', 'get').and.returnValue('artspace_theme=%64ark; artspace_consent=%61ccepted');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(fixture.nativeElement.querySelector('[aria-label="Cookie notice"]')).toBeNull();
  });

  for (const failure of ['throws', 'silently ignores']) {
    it(`keeps saved account themes working when cookie writing ${failure}, and retries on the next theme change`, () => {
      let cookies = 'artspace_consent=accepted';
      spyOnProperty(document, 'cookie', 'get').and.callFake(() => cookies);
      const write = spyOnProperty(document, 'cookie', 'set');
      if (failure === 'throws') write.and.throwError(new DOMException('Blocked', 'SecurityError'));
      else write.and.stub();
      const auth = TestBed.inject(AuthService);
      const user: User = {
        id: 'accountant-1', role: 'accountant', username: 'accountant', name: 'Accountant',
        email: 'accountant@example.com', picture: '', cardLast4: '1234', passwordHash: 'hash',
        preferences: { theme: 'dark', newsletter: false },
      };
      auth.currentUser.set(user);
      const fixture = TestBed.createComponent(App);
      expect(() => fixture.detectChanges()).not.toThrow();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(auth.currentUser()).toBe(user);
      expect(cookies).toBe('artspace_consent=accepted');
      expect(write).toHaveBeenCalledWith(jasmine.stringMatching(/^artspace_theme=dark;/));
      write.and.callFake((value: string) => { cookies = `artspace_consent=accepted; ${value.split(';')[0]}`; });
      auth.currentUser.set({ ...user, preferences: { ...user.preferences, theme: 'light' } });
      expect(() => fixture.detectChanges()).not.toThrow();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(cookies).toBe('artspace_consent=accepted; artspace_theme=light');
    });
  }
});
