import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService, USE_SHARED_LOGIN } from './auth.service';

describe('Shared Laravel sign-in', () => {
  it('uses the same server identity for sign-in and restoration and clears it on sign-out', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: USE_SHARED_LOGIN, useValue: true },
      ],
    });
    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    const url = '/api/auth/session';
    const user = {
      id: '17',
      username: 'alice',
      name: 'Alice',
      email: 'alice@example.test',
      role: 'accountant',
      picture: '',
      cardLast4: '',
      preferences: { theme: 'light', newsletter: false },
    };

    const login = auth.login(user.email, 'test-password', false);
    http.expectOne({ url, method: 'GET' }).flush({ user: null });
    await Promise.resolve();
    const request = http.expectOne({ url, method: 'POST' });
    expect(request.request.body).toEqual({ identifier: user.email, password: 'test-password' });
    request.flush({ user });
    expect((await login).ok).toBeTrue();
    expect(auth.role()).toBe('accountant');

    const restore = auth.restoreSession();
    http.expectOne({ url, method: 'GET' }).flush({ user });
    await restore;
    expect(auth.currentUser()?.id).toBe(user.id);

    const logout = auth.logoutServer();
    http.expectOne({ url, method: 'GET' }).flush({ user });
    await Promise.resolve();
    http.expectOne({ url, method: 'DELETE' }).flush(null, { status: 204, statusText: 'No Content' });
    expect((await logout).ok).toBeTrue();
    expect(auth.currentUser()).toBeNull();
    http.verify();
  });
});
