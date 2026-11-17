import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { signal } from '@angular/core';
import { AuthService } from './core/services/auth.service';

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
      currentUser: signal(null),
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
});
