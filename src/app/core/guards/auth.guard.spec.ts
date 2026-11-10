import { TestBed } from '@angular/core/testing';
import { UrlTree, provideRouter } from '@angular/router';
import { authGuard, roleGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { User } from '../models/user.model';

describe('route guards', () => {
  let auth: AuthService;
  const run = (guard: any) => TestBed.runInInjectionContext(() => guard({} as any, {} as any));
  const fakeUser = (role: User['role']) => ({ id: '1', role } as User);

  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    auth = TestBed.inject(AuthService);
  });

  it('authGuard redirects to /login when logged out', () => {
    const result = run(authGuard);
    expect(result instanceof UrlTree).toBeTrue();
    expect(result.toString()).toBe('/login');
  });

  it('authGuard allows a logged-in user', () => {
    auth.currentUser.set(fakeUser('student'));
    expect(run(authGuard)).toBeTrue();
  });

  it('roleGuard allows a matching role', () => {
    auth.currentUser.set(fakeUser('accountant'));
    expect(run(roleGuard('accountant', 'admin'))).toBeTrue();
  });

  it('roleGuard blocks a different role', () => {
    auth.currentUser.set(fakeUser('student'));
    const result = run(roleGuard('accountant', 'admin'));
    expect(result instanceof UrlTree).toBeTrue();
  });
});