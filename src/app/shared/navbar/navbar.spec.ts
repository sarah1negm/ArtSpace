import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Navbar } from './navbar';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user.model';

describe('Navbar', () => {
  let fixture: ComponentFixture<Navbar>;
  let auth: AuthService;
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(async () => {
    localStorage.clear(); sessionStorage.clear();
    await TestBed.configureTestingModule({ imports: [Navbar], providers: [provideRouter([])] }).compileComponents();
    auth = TestBed.inject(AuthService);
    fixture = TestBed.createComponent(Navbar);
  });

  it('shows Login and Sign up when logged out', () => {
    fixture.detectChanges();
    expect(text()).toContain('Login');
    expect(text()).toContain('Sign up');
    expect(text()).not.toContain('Logout');
  });

  it('shows My Dashboard for a student', () => {
    auth.currentUser.set({ role: 'student' } as User);
    fixture.detectChanges();
    expect(text()).toContain('My Dashboard');
    expect(text()).not.toContain('Accounting');
  });

  it('shows Accounting for an accountant', () => {
    auth.currentUser.set({ role: 'accountant' } as User);
    fixture.detectChanges();
    expect(text()).toContain('Accounting');
    expect(text()).toContain('Logout');
  });

  function failLogout() {
    auth.currentUser.set({ id: 'student-1', role: 'student' } as User);
    fixture.detectChanges();
    const logout = spyOn(auth, 'logout').and.returnValue({ ok: false, error: 'Session storage is blocked.' });
    fixture.componentInstance.logout();
    fixture.detectChanges();
    return logout;
  }

  it('keeps failed logout feedback while the same session remains active', () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate');
    failLogout();
    fixture.componentInstance.toggle();
    fixture.detectChanges();
    expect(text()).toContain('Session storage is blocked.');
    expect(auth.currentUser()?.id).toBe('student-1');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('clears obsolete feedback after authentication changes and preserves role links', () => {
    failLogout();
    auth.currentUser.set({ id: 'accountant-1', role: 'accountant' } as User);
    fixture.detectChanges();
    expect(text()).not.toContain('Session storage is blocked.');
    expect(text()).toContain('Accounting');
    expect(text()).not.toContain('My Dashboard');
    expect(fixture.nativeElement.querySelector('a[routerLink="/profile"]')).toBeTruthy();
  });

  it('clears obsolete feedback when another caller successfully logs out', () => {
    const logout = failLogout();
    logout.and.callThrough();
    expect(auth.logout().ok).toBeTrue();
    fixture.detectChanges();
    expect(text()).not.toContain('Session storage is blocked.');
    expect(text()).toContain('Login');
  });

  it('clears feedback and navigates home after a successful logout retry', () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const logout = failLogout();
    logout.and.callThrough();
    fixture.componentInstance.logout();
    fixture.detectChanges();
    expect(fixture.componentInstance.logoutError()).toBe('');
    expect(auth.currentUser()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('does not clear a new failure or unrelated authentication feedback', () => {
    const logout = failLogout();
    auth.currentUser.set({ id: 'admin-1', role: 'admin' } as User);
    auth.storageError.set('Another authentication error');
    logout.and.returnValue({ ok: false, error: 'New logout failure' });
    fixture.componentInstance.logout();
    fixture.detectChanges();
    expect(text()).toContain('New logout failure');
    expect(auth.storageError()).toBe('Another authentication error');
    expect(text()).toContain('Accounting');
  });
});
