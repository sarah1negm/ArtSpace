import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { Login } from './login/login';
import { Signup } from './signup/signup';
import { Profile } from './profile/profile';

function luminance(color: string): number {
  const channels = color
    .match(/[\d.]+/g)!
    .slice(0, 3)
    .map(Number)
    .map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(foreground: string, background: string): number {
  const a = luminance(foreground),
    b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function readable(element: Element, background: string, label: string): void {
  expect(contrast(getComputedStyle(element).color, background))
    .withContext(label)
    .toBeGreaterThanOrEqual(4.5);
}

describe('Authentication page theme contrast', () => {
  let originalTheme: string | null;
  beforeEach(async () => {
    originalTheme = document.documentElement.getAttribute('data-theme');
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [Login, Signup, Profile],
      providers: [provideRouter([])],
    });
    const auth = TestBed.inject(AuthService);
    await auth.seedDemoUsers();
    await auth.login('student1', 'Pass1234', false);
  });
  afterEach(() => {
    if (originalTheme === null) document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', originalTheme);
    localStorage.clear();
    sessionStorage.clear();
  });

  for (const theme of ['light', 'dark']) {
    for (const page of ['Login', 'Signup', 'Profile']) {
      it(`keeps ${page} content, controls, validation and disabled states readable in ${theme} mode`, async () => {
        document.documentElement.setAttribute('data-theme', theme);
        let fixture: ComponentFixture<Login | Signup | Profile>;
        if (page === 'Login') fixture = TestBed.createComponent(Login);
        else if (page === 'Signup') fixture = TestBed.createComponent(Signup);
        else fixture = TestBed.createComponent(Profile);
        await fixture.whenStable();
        const root: HTMLElement = fixture.nativeElement;
        const card = root.querySelector<HTMLElement>('.auth-card')!;
        const background = getComputedStyle(card).backgroundColor;
        expect(background).toBe(theme === 'dark' ? 'rgb(48, 33, 50)' : 'rgb(255, 255, 255)');
        readable(card, background, `${page} card text`);
        for (const link of root.querySelectorAll('a, .link-btn'))
          readable(link, background, `${page} link`);
        if (fixture.componentInstance instanceof Profile) {
          fixture.componentInstance.saved.set(true);
          await fixture.whenStable();
          readable(root.querySelector('.ok')!, background, 'Profile success message');
          const primary = root.querySelector<HTMLButtonElement>('button.primary-btn')!;
          readable(primary, getComputedStyle(primary).backgroundColor, 'Profile primary button');
          primary.disabled = true;
          readable(
            primary,
            getComputedStyle(primary).backgroundColor,
            'Profile disabled primary button',
          );
          fixture.componentInstance.startEdit();
        }
        if (fixture.componentInstance instanceof Login)
          fixture.componentInstance.error.set('Invalid username or password');
        if (fixture.componentInstance instanceof Signup)
          fixture.componentInstance.serverError.set('Could not save your account');
        if (fixture.componentInstance instanceof Profile) {
          fixture.componentInstance.error.set('Could not save your profile');
          fixture.componentInstance.form.controls.email.setValue('invalid-email');
        }
        fixture.componentInstance.form.markAllAsTouched();
        await fixture.whenStable();
        for (const link of root.querySelectorAll('a, .link-btn'))
          readable(link, background, `${page} edit-mode link`);
        for (const label of root.querySelectorAll('label'))
          readable(label, background, `${page} label`);
        for (const error of root.querySelectorAll('.error'))
          readable(error, background, `${page} error`);
        const controls = root.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
          'input:not([type=checkbox]), select',
        );
        for (const control of controls) {
          const style = getComputedStyle(control);
          readable(control, style.backgroundColor, `${page} ${control.id} text`);
          expect(contrast(style.borderTopColor, style.backgroundColor))
            .withContext(`${page} ${control.id} border`)
            .toBeGreaterThanOrEqual(3);
          if (control instanceof HTMLInputElement && control.type !== 'file') {
            control.placeholder = 'Example placeholder';
            expect(
              contrast(getComputedStyle(control, '::placeholder').color, style.backgroundColor),
            )
              .withContext('placeholder')
              .toBeGreaterThanOrEqual(4.5);
          }
          if (control instanceof HTMLInputElement && control.type === 'file') {
            const chooser = getComputedStyle(control, '::file-selector-button');
            expect(contrast(chooser.color, chooser.backgroundColor))
              .withContext('file chooser')
              .toBeGreaterThanOrEqual(4.5);
          }
          control.focus();
          const focused = getComputedStyle(control);
          expect(focused.outlineStyle).toBe('solid');
          expect(contrast(focused.outlineColor, background))
            .withContext('focus ring')
            .toBeGreaterThanOrEqual(3);
          control.disabled = true;
          readable(control, getComputedStyle(control).backgroundColor, `${page} disabled control`);
          control.disabled = false;
        }
        for (const button of root.querySelectorAll<HTMLButtonElement>('button[type=submit]')) {
          readable(button, getComputedStyle(button).backgroundColor, `${page} submit button`);
          button.disabled = true;
          readable(button, getComputedStyle(button).backgroundColor, `${page} disabled button`);
        }
        const invalid = root.querySelector<HTMLInputElement>('input.ng-invalid.ng-touched');
        expect(invalid).not.toBeNull();
        expect(
          contrast(
            getComputedStyle(invalid!).borderTopColor,
            getComputedStyle(invalid!).backgroundColor,
          ),
        ).toBeGreaterThanOrEqual(3);
        fixture.destroy();
      });
    }
    it(`keeps auth-specific colors scoped and follows theme changes without changing preferences (${theme})`, async () => {
      document.documentElement.setAttribute('data-theme', theme);
      const fixture = TestBed.createComponent(Login);
      await fixture.whenStable();
      const card: HTMLElement = fixture.nativeElement.querySelector('.auth-card');
      const preferences = TestBed.inject(AuthService).currentUser()!.preferences;
      const savedUsers = localStorage.getItem('artspace_users');
      const other = document.createElement('section');
      document.body.append(other);
      try {
        expect(getComputedStyle(other).getPropertyValue('--auth-error')).toBe('');
        const before = getComputedStyle(card).backgroundColor;
        document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'light' : 'dark');
        expect(getComputedStyle(card).backgroundColor).not.toBe(before);
        expect(TestBed.inject(AuthService).currentUser()!.preferences).toEqual(preferences);
        expect(localStorage.getItem('artspace_users')).toBe(savedUsers);
      } finally {
        other.remove();
        fixture.destroy();
      }
    });
  }
});
