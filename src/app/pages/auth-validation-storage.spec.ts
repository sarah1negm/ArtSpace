import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { Login } from './login/login';
import { Signup } from './signup/signup';
import { Profile } from './profile/profile';
import { Navbar } from '../shared/navbar/navbar';
import { authGuard } from '../core/guards/auth.guard';

const signup = {
  username: 'newstudent',
  name: 'New Student',
  email: 'new@example.com',
  password: 'Pass1234',
  confirm: 'Pass1234',
  cardNumber: '4111111111111111',
  newsletter: true,
  theme: 'dark' as const,
};
describe('Authentication form validation and persistence feedback', () => {
  let auth: AuthService;
  let navigate: jasmine.Spy;
  let navigateByUrl: jasmine.Spy;
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = 'artspace_remember=;max-age=0;path=/';
    TestBed.configureTestingModule({
      imports: [Login, Signup, Profile, Navbar],
      providers: [provideRouter([])],
    });
    auth = TestBed.inject(AuthService);
    await auth.seedDemoUsers();
    const router = TestBed.inject(Router);
    navigate = spyOn(router, 'navigate').and.resolveTo(true);
    navigateByUrl = spyOn(router, 'navigateByUrl').and.resolveTo(true);
  });
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = 'artspace_remember=;max-age=0;path=/';
  });
  it('shows both required Login messages and never submits an invalid form', async () => {
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    const login = spyOn(auth, 'login').and.callThrough();
    fixture.componentInstance.form.controls.username.setValue('   ');
    await fixture.componentInstance.submit();
    await fixture.whenStable();
    const page: HTMLElement = fixture.nativeElement;
    expect(page.textContent).toContain('Enter your username.');
    expect(page.textContent).toContain('Enter your password.');
    expect(login).not.toHaveBeenCalled();
    expect(fixture.componentInstance.form.controls.username.value).toBe('   ');
    fixture.destroy();
  });
  it('keeps invalid credentials and Remember selection, then logs in on retry', async () => {
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    fixture.componentInstance.form.setValue({
      username: 'student1',
      password: 'Wrong123',
      remember: true,
    });
    await fixture.componentInstance.submit();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Invalid username or password');
    expect(fixture.componentInstance.form.getRawValue()).toEqual({
      username: 'student1',
      password: 'Wrong123',
      remember: true,
    });
    expect(navigateByUrl).not.toHaveBeenCalled();
    fixture.componentInstance.form.controls.password.setValue('Pass1234');
    await fixture.componentInstance.submit();
    expect(auth.getRememberedUsername()).toBe('student1');
    expect(navigateByUrl).toHaveBeenCalledWith('/profile');
    fixture.destroy();
    const reopened = TestBed.createComponent(Login);
    expect(reopened.componentInstance.form.controls.username.value).toBe('student1');
    expect(reopened.componentInstance.form.controls.remember.value).toBeTrue();
    reopened.destroy();
  });
  it('keeps Login values and previous session when storage fails, and allows retry', async () => {
    await auth.login('student1', 'Pass1234', true);
    const session = sessionStorage.getItem('artspace_session');
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    fixture.componentInstance.form.setValue({
      username: 'accountant1',
      password: 'Pass1234',
      remember: false,
    });
    const write = spyOn(Storage.prototype, 'setItem').and.throwError('quota');
    await fixture.componentInstance.submit();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role=alert]')?.textContent).toContain(
      'session storage',
    );
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('artspace_session')).toBe(session);
    expect(auth.role()).toBe('student');
    expect(fixture.componentInstance.form.controls.username.value).toBe('accountant1');
    expect(fixture.componentInstance.submitting()).toBeFalse();
    write.and.callThrough();
    await fixture.componentInstance.submit();
    expect(auth.role()).toBe('accountant');
    expect(navigateByUrl).toHaveBeenCalled();
    fixture.destroy();
  });
  it('does not fail a persisted login when the optional return-page hint cannot be read or removed', async () => {
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    fixture.componentInstance.form.setValue({
      username: 'student1',
      password: 'Pass1234',
      remember: false,
    });
    const original = Storage.prototype.getItem;
    spyOn(Storage.prototype, 'getItem').and.callFake(function (this: Storage, key: string) {
      if (key === 'artspace_return') throw new DOMException('blocked', 'SecurityError');
      return original.call(this, key);
    });
    spyOn(Storage.prototype, 'removeItem').and.throwError('blocked');
    await fixture.componentInstance.submit();
    expect(auth.isLoggedIn()).toBeTrue();
    expect(navigateByUrl).toHaveBeenCalledWith('/profile');
    fixture.destroy();
  });
  it('prevents duplicate login submissions while one is pending', async () => {
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    fixture.componentInstance.form.setValue({
      username: 'student1',
      password: 'Pass1234',
      remember: false,
    });
    let resolve!: (result: { ok: boolean; error: string }) => void;
    const login = spyOn(auth, 'login').and.returnValue(new Promise((done) => (resolve = done)));
    const first = fixture.componentInstance.submit();
    await fixture.componentInstance.submit();
    await fixture.whenStable();
    expect(login).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('button[type=submit]').disabled).toBeTrue();
    resolve({ ok: false, error: 'Try again' });
    await first;
    expect(fixture.componentInstance.submitting()).toBeFalse();
    fixture.destroy();
  });
  it('shows Signup required messages including empty confirmation and retains entered preferences', async () => {
    const fixture = TestBed.createComponent(Signup);
    await fixture.whenStable();
    const create = spyOn(auth, 'signup').and.callThrough();
    fixture.componentInstance.form.patchValue({ theme: 'dark', newsletter: true, name: '   ' });
    await fixture.componentInstance.submit();
    await fixture.whenStable();
    const text = fixture.nativeElement.textContent;
    for (const message of [
      'Enter a username.',
      'Enter your full name.',
      'Enter your email address.',
      'Enter a password.',
      'Confirm your password.',
      'Enter a 16-digit card number',
    ])
      expect(text).toContain(message);
    expect(create).not.toHaveBeenCalled();
    expect(fixture.componentInstance.form.controls.theme.value).toBe('dark');
    expect(fixture.componentInstance.form.controls.newsletter.value).toBeTrue();
    fixture.destroy();
  });
  it('explains invalid Signup values and mismatched passwords without submitting', async () => {
    const fixture = TestBed.createComponent(Signup);
    await fixture.whenStable();
    const create = spyOn(auth, 'signup').and.callThrough();
    fixture.componentInstance.form.setValue({
      ...signup,
      username: 'a!',
      email: 'invalid',
      password: 'abc',
      confirm: 'different',
      cardNumber: '12',
    });
    await fixture.componentInstance.submit();
    await fixture.whenStable();
    const text = fixture.nativeElement.textContent;
    for (const message of [
      'at least 3 characters',
      'valid email address',
      'at least 8 characters',
      "Passwords don't match",
      'exactly 16 digits',
    ])
      expect(text).toContain(message);
    expect(create).not.toHaveBeenCalled();
    expect(fixture.componentInstance.form.controls.cardNumber.value).toBe('12');
    fixture.destroy();
  });
  it('keeps Signup values and picture after a failed write and navigates only after successful retry', async () => {
    const fixture = TestBed.createComponent(Signup);
    await fixture.whenStable();
    fixture.componentInstance.form.setValue(signup);
    fixture.componentInstance.picture.set('data:image/png;base64,cGljdHVyZQ==');
    const users = localStorage.getItem('artspace_users');
    const write = spyOn(Storage.prototype, 'setItem').and.throwError('quota');
    await fixture.componentInstance.submit();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role=alert]')?.textContent).toContain(
      'could not be saved',
    );
    expect(fixture.componentInstance.form.getRawValue()).toEqual(signup);
    expect(fixture.componentInstance.picture()).toContain('data:image/png');
    expect(localStorage.getItem('artspace_users')).toBe(users);
    expect(navigate).not.toHaveBeenCalled();
    write.and.callThrough();
    await fixture.componentInstance.submit();
    expect(navigate).toHaveBeenCalledWith(['/login']);
    const saved = JSON.parse(localStorage.getItem('artspace_users')!).find(
      (user: { username: string }) => user.username === signup.username,
    );
    expect(saved.role).toBe('student');
    expect(saved.preferences).toEqual({ theme: 'dark', newsletter: true });
    expect(saved.picture).toBe(fixture.componentInstance.picture());
    fixture.destroy();
  });
  it('rejects invalid Profile name/email without calling persistence', async () => {
    await auth.login('student1', 'Pass1234', false);
    const fixture = TestBed.createComponent(Profile);
    fixture.componentInstance.startEdit();
    await fixture.whenStable();
    const save = spyOn(auth, 'updateProfile').and.callThrough();
    fixture.componentInstance.form.patchValue({ name: '   ', email: 'invalid' });
    fixture.componentInstance.save();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Enter your full name.');
    expect(fixture.nativeElement.textContent).toContain('Enter a valid email address.');
    expect(save).not.toHaveBeenCalled();
    expect(fixture.componentInstance.editing()).toBeTrue();
    expect(fixture.componentInstance.saved()).toBeFalse();
    fixture.destroy();
  });
  it('keeps Profile draft, picture, theme and authenticated user on failure; announces success only after retry', async () => {
    await auth.login('student1', 'Pass1234', false);
    const user = auth.currentUser();
    const stored = localStorage.getItem('artspace_users');
    const fixture = TestBed.createComponent(Profile);
    fixture.componentInstance.startEdit();
    await fixture.whenStable();
    fixture.componentInstance.form.patchValue({
      name: 'New Name',
      email: 'changed@example.com',
      theme: 'dark',
      newsletter: true,
    });
    fixture.componentInstance.picture.set('data:image/png;base64,cGljdHVyZQ==');
    fixture.componentInstance.saved.set(true);
    const write = spyOn(Storage.prototype, 'setItem').and.throwError('quota');
    fixture.componentInstance.save();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role=alert]')?.textContent).toContain(
      'could not be saved',
    );
    expect(fixture.componentInstance.editing()).toBeTrue();
    expect(fixture.componentInstance.saved()).toBeFalse();
    expect(auth.currentUser()).toBe(user);
    expect(localStorage.getItem('artspace_users')).toBe(stored);
    expect(fixture.componentInstance.form.controls.theme.value).toBe('dark');
    expect(fixture.componentInstance.form.controls.name.value).toBe('New Name');
    expect(fixture.componentInstance.picture()).toContain('data:image/png');
    write.and.callThrough();
    fixture.componentInstance.save();
    await fixture.whenStable();
    expect(fixture.componentInstance.editing()).toBeFalse();
    expect(fixture.componentInstance.saved()).toBeTrue();
    expect(auth.currentUser()?.preferences.theme).toBe('dark');
    expect(fixture.nativeElement.textContent).toContain('Profile updated');
    fixture.destroy();
  });
  it('keeps the Navbar signed in and displays a logout failure without navigating', async () => {
    await auth.login('student1', 'Pass1234', false);
    const fixture = TestBed.createComponent(Navbar);
    await fixture.whenStable();
    const remove = spyOn(Storage.prototype, 'removeItem').and.throwError('blocked');
    fixture.componentInstance.logout();
    await fixture.whenStable();
    expect(auth.isLoggedIn()).toBeTrue();
    expect(fixture.nativeElement.querySelector('[role=alert]')?.textContent).toContain(
      'could not be logged out',
    );
    expect(navigate).not.toHaveBeenCalled();
    remove.and.callThrough();
    fixture.componentInstance.logout();
    expect(auth.isLoggedIn()).toBeFalse();
    expect(navigate).toHaveBeenCalledWith(['/']);
    fixture.destroy();
  });
  it('still redirects unauthenticated users when saving the optional return URL fails', () => {
    spyOn(Storage.prototype, 'setItem').and.throwError('blocked');
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/profile' } as never),
    );
    expect(String(result)).toBe('/login');
    expect(auth.isLoggedIn()).toBeFalse();
  });
});
