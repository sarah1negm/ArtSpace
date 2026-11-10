import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
});