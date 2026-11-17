import { TestBed } from '@angular/core/testing';
import { computed } from '@angular/core';
import { AuthService } from './auth.service';
import { StorageService } from './storage.service';

const signup = {
  username: 'newstudent',
  name: 'New Student',
  email: 'new@example.com',
  picture: '',
  password: 'Pass1234',
  cardNumber: '4111111111111111',
  newsletter: true,
  theme: 'dark' as const,
};
describe('Authentication storage reliability', () => {
  let auth: AuthService;
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = 'artspace_remember=;max-age=0;path=/';
    TestBed.configureTestingModule({});
    auth = TestBed.inject(AuthService);
    await auth.seedDemoUsers();
    await auth.login('student1', 'Pass1234', true);
  });
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = 'artspace_remember=;max-age=0;path=/';
  });
  for (const remember of [true, false]) {
    it(`keeps login and authorization correct when optional cookie ${remember ? 'saving' : 'deletion'} is blocked`, async () => {
      const previous = auth.getRememberedUsername();
      const write = spyOnProperty(document, 'cookie', 'set')
        .and.throwError(new DOMException('Blocked', 'SecurityError'));
      expect((await auth.login('accountant1', 'Pass1234', remember)).ok).toBeTrue();
      expect(write).toHaveBeenCalled();
      expect(auth.role()).toBe('accountant');
      expect(sessionStorage.getItem('artspace_session')).toBe(auth.currentUser()!.id);
      expect(auth.getRememberedUsername()).toBe(previous);
      write.and.callThrough();
      expect((await auth.login('accountant1', 'Pass1234', remember)).ok).toBeTrue();
      expect(auth.getRememberedUsername()).toBe(remember ? 'accountant1' : '');
    });
  }
  for (const name of ['QuotaExceededError', 'SecurityError']) {
    it(`preserves accounts and signed-in state on failed signup/profile writes and supports retry (${name})`, async () => {
      const users = localStorage.getItem('artspace_users'),
        session = sessionStorage.getItem('artspace_session'),
        user = auth.currentUser();
      const write = spyOn(Storage.prototype, 'setItem').and.callFake(() => {
        throw new DOMException('blocked', name);
      });
      const result = await auth.signup(signup);
      expect(result.ok).toBeFalse();
      expect(result.error).toContain('could not be saved');
      expect(
        auth.updateProfile({
          name: 'Updated Name',
          preferences: { theme: 'dark', newsletter: true },
        }).ok,
      ).toBeFalse();
      expect(auth.currentUser()).toBe(user);
      expect(localStorage.getItem('artspace_users')).toBe(users);
      expect(sessionStorage.getItem('artspace_session')).toBe(session);
      write.and.callThrough();
      expect((await auth.signup(signup)).ok).toBeTrue();
      expect(
        auth.updateProfile({
          name: 'Updated Name',
          preferences: { theme: 'dark', newsletter: true },
        }).ok,
      ).toBeTrue();
      expect(auth.storageError()).toBe('');
      const data = localStorage.getItem('artspace_users')!;
      expect(data).not.toContain(signup.password);
      expect(data).not.toContain(signup.cardNumber);
      const created = JSON.parse(data).find(
        (item: { username: string }) => item.username === signup.username,
      );
      expect(created.role).toBe('student');
      expect(created.cardLast4).toBe('1111');
      TestBed.resetTestingModule();
      auth = TestBed.inject(AuthService);
      expect(auth.currentUser()?.name).toBe('Updated Name');
      expect(auth.currentUser()?.preferences.theme).toBe('dark');
    });
    it(`does not change the previous session or remembered username after failed login (${name})`, async () => {
      const user = auth.currentUser(),
        session = sessionStorage.getItem('artspace_session'),
        remember = auth.getRememberedUsername();
      const write = spyOn(Storage.prototype, 'setItem').and.callFake(() => {
        throw new DOMException('blocked', name);
      });
      const result = await auth.login('accountant1', 'Pass1234', false);
      expect(result.ok).toBeFalse();
      expect(result.error).toContain('session storage');
      expect(auth.currentUser()).toBe(user);
      expect(auth.role()).toBe('student');
      expect(sessionStorage.getItem('artspace_session')).toBe(session);
      expect(auth.getRememberedUsername()).toBe(remember);
      write.and.callThrough();
      expect((await auth.login('accountant1', 'Pass1234', false)).ok).toBeTrue();
      expect(auth.role()).toBe('accountant');
      expect(auth.getRememberedUsername()).toBe('');
      const id = auth.currentUser()!.id;
      expect(sessionStorage.getItem('artspace_session')).toBe(id);
      TestBed.resetTestingModule();
      auth = TestBed.inject(AuthService);
      expect(auth.currentUser()?.id).toBe(id);
    });
  }
  it('does not overwrite malformed account data during seeding, signup, login or profile updates', async () => {
    const invalid = '{"unrecognized":"saved data"}';
    localStorage.setItem('artspace_users', invalid);
    const user = auth.currentUser(),
      session = sessionStorage.getItem('artspace_session');
    expect(await auth.seedDemoUsers()).toBeFalse();
    expect((await auth.signup(signup)).ok).toBeFalse();
    expect((await auth.login('student1', 'Pass1234', false)).ok).toBeFalse();
    expect(auth.updateProfile({ name: 'Change' }).ok).toBeFalse();
    expect(auth.currentUser()).toBe(user);
    expect(auth.getStudentArtists()).toEqual([]);
    expect(localStorage.getItem('artspace_users')).toBe(invalid);
    expect(sessionStorage.getItem('artspace_session')).toBe(session);
  });
  it('preserves invalid JSON and reports the read failure instead of replacing accounts', async () => {
    localStorage.setItem('artspace_users', '{broken');
    expect((await auth.signup(signup)).error).toContain('could not be read');
    expect(await auth.seedDemoUsers()).toBeFalse();
    expect(localStorage.getItem('artspace_users')).toBe('{broken');
  });
  it('handles denied account reads without losing the existing authenticated state', async () => {
    const user = auth.currentUser();
    const read = spyOn(Storage.prototype, 'getItem').and.throwError('blocked');
    expect((await auth.signup(signup)).ok).toBeFalse();
    expect((await auth.login('student1', 'Pass1234', false)).ok).toBeFalse();
    expect(auth.updateProfile({ name: 'Change' }).ok).toBeFalse();
    expect(await auth.seedDemoUsers()).toBeFalse();
    expect(auth.currentUser()).toBe(user);
    read.and.callThrough();
    expect((await auth.login('student1', 'Pass1234', false)).ok).toBeTrue();
  });
  it('initializes safely when storage reads are blocked', () => {
    TestBed.resetTestingModule();
    spyOn(Storage.prototype, 'getItem').and.throwError('blocked');
    expect(() => (auth = TestBed.inject(AuthService))).not.toThrow();
    expect(auth.currentUser()).toBeNull();
    expect(auth.storageError()).toContain('could not be read');
  });
  it('returns a failure rather than rejecting when demo-account initialization cannot persist', async () => {
    auth.logout();
    localStorage.clear();
    spyOn(Storage.prototype, 'setItem').and.throwError('quota');
    expect(await auth.seedDemoUsers()).toBeFalse();
    expect(auth.isLoggedIn()).toBeFalse();
    expect(localStorage.getItem('artspace_users')).toBeNull();
  });
  it('keeps logout state consistent when removing the session is blocked, and allows retry', () => {
    const user = auth.currentUser(),
      session = sessionStorage.getItem('artspace_session');
    const remove = spyOn(Storage.prototype, 'removeItem').and.throwError('blocked');
    expect(auth.logout().ok).toBeFalse();
    expect(auth.currentUser()).toBe(user);
    expect(sessionStorage.getItem('artspace_session')).toBe(session);
    remove.and.callThrough();
    expect(auth.logout().ok).toBeTrue();
    expect(auth.currentUser()).toBeNull();
    expect(sessionStorage.getItem('artspace_session')).toBeNull();
  });
  it('rejects duplicate profile email changes without losing the previous profile', () => {
    const user = auth.currentUser();
    expect(auth.updateProfile({ email: 'accountant1@artspace.com' }).ok).toBeFalse();
    expect(auth.currentUser()).toBe(user);
  });
  it('keeps existing raw session IDs and JSON session values in their original formats', () => {
    const storage = TestBed.inject(StorageService);
    expect(storage.setSessionString('auth-raw-test', 'user-id')).toBeTrue();
    expect(sessionStorage.getItem('auth-raw-test')).toBe('user-id');
    expect(storage.readSessionString('auth-raw-test')).toEqual({ ok: true, value: 'user-id' });
    expect(storage.setSession('auth-json-test', { step: 1 })).toBeTrue();
    expect(storage.getSession('auth-json-test', {})).toEqual({ step: 1 });
  });
  it('refreshes reactive student-artist readers after a storage-read failure and successful login retry', async () => {
    const artists = computed(() => auth.getStudentArtists());
    const read = spyOn(Storage.prototype, 'getItem').and.throwError('blocked');
    expect(artists()).toEqual([]);
    expect((await auth.login('student1', 'Pass1234', false)).ok).toBeFalse();
    read.and.callThrough();
    expect((await auth.login('student1', 'Pass1234', false)).ok).toBeTrue();
    expect(artists().map((artist) => artist.name)).toContain('Demo Student');
  });
});
