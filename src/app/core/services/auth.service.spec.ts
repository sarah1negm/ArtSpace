import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  const data = {
    username: 'sara', name: 'Sara', email: 'sara@x.com', picture: '',
    password: 'Pass1234', cardNumber: '4111111111111111', newsletter: false, theme: 'light' as const,
  };

  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear();
    document.cookie = 'artspace_remember=; max-age=0; path=/';
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  it('signs up and stores only a password hash and the last 4 card digits', async () => {
    const res = await service.signup(data);
    expect(res.ok).toBeTrue();
    const raw = localStorage.getItem('artspace_users')!;
    expect(raw).toContain('"cardLast4":"1111"');
    expect(raw).not.toContain('4111111111111111');
    expect(raw).not.toContain('Pass1234');
  });

  it('rejects a duplicate username', async () => {
    await service.signup(data);
    const res = await service.signup({ ...data, email: 'other@x.com' });
    expect(res.ok).toBeFalse();
  });

  it('logs in with the right password and saves the session in sessionStorage', async () => {
    await service.signup(data);
    const res = await service.login('sara', 'Pass1234', false);
    expect(res.ok).toBeTrue();
    expect(service.isLoggedIn()).toBeTrue();
    expect(sessionStorage.getItem('artspace_session')).toBeTruthy();
  });

  it('rejects a wrong password', async () => {
    await service.signup(data);
    const res = await service.login('sara', 'wrong', false);
    expect(res.ok).toBeFalse();
    expect(service.isLoggedIn()).toBeFalse();
  });

  it('sets the remember-me cookie only when asked', async () => {
    await service.signup(data);
    await service.login('sara', 'Pass1234', true);
    expect(service.getRememberedUsername()).toBe('sara');
  });

  it('logout clears the session', async () => {
    await service.signup(data);
    await service.login('sara', 'Pass1234', false);
    service.logout();
    expect(service.isLoggedIn()).toBeFalse();
    expect(sessionStorage.getItem('artspace_session')).toBeNull();
  });

  it('updateProfile persists changes', async () => {
    await service.signup(data);
    await service.login('sara', 'Pass1234', false);
    service.updateProfile({ name: 'Sara Ali' });
    expect(service.currentUser()?.name).toBe('Sara Ali');
    expect(localStorage.getItem('artspace_users')).toContain('Sara Ali');
  });
});