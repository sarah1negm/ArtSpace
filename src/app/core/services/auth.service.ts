import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { Role, User } from '../models/user.model';
import { StorageReadResult, StorageService } from './storage.service';

export const USE_SHARED_LOGIN = new InjectionToken<boolean>('Shared Laravel login', {
  providedIn: 'root',
  factory: () => false,
});

type ServerUser = Omit<User, 'passwordHash'>;

export interface AuthResult {
  ok: boolean;
  error: string;
}
const SAVE_ERROR =
  'Your changes could not be saved. Browser storage may be full or blocked. Your previous data has been kept. Please allow site storage or free space, then try again.';
const READ_ERROR =
  'Your saved account data could not be read. Browser storage may be blocked or the saved data may be invalid. No data was changed. Please check site storage and try again.';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storage = inject(StorageService);
  private readonly http = inject(USE_SHARED_LOGIN) ? inject(HttpClient) : null;
  private readonly sessionUrl = '/api/auth/session';
  readonly sharedLogin = this.http !== null;
  private readonly USERS_KEY = 'artspace_users';
  private readonly SESSION_KEY = 'artspace_session';
  private readonly COOKIE = 'artspace_remember';
  private readonly usersRevision = signal(0);
  readonly storageError = signal('');
  readonly currentUser = signal<User | null>(this.sharedLogin ? null : this.loadSession());
  readonly isLoggedIn = computed(() => this.currentUser() !== null);
  readonly role = computed(() => this.currentUser()?.role ?? null);

  private getUsers(): User[] | null {
    const result = this.storage.readLocal<unknown>(this.USERS_KEY, []);
    if (!result.ok || !Array.isArray(result.value)) return null;
    const valid = result.value.every((user: unknown) => {
      if (!user || typeof user !== 'object') return false;
      const u = user as User;
      return (
        typeof u.id === 'string' &&
        typeof u.username === 'string' &&
        typeof u.name === 'string' &&
        typeof u.email === 'string' &&
        typeof u.picture === 'string' &&
        typeof u.passwordHash === 'string' &&
        typeof u.cardLast4 === 'string' &&
        ['student', 'accountant', 'admin'].includes(u.role) &&
        !!u.preferences &&
        ['light', 'dark'].includes(u.preferences.theme) &&
        typeof u.preferences.newsletter === 'boolean'
      );
    });
    return valid ? (result.value as User[]) : null;
  }
  private saveUsers(users: User[]): boolean {
    if (!this.storage.setLocal(this.USERS_KEY, users)) return false;
    this.usersRevision.update((value) => value + 1);
    return true;
  }
  getStudentArtists(): { id: string; name: string }[] {
    const result = this.readStudentArtists();
    return result.ok ? result.value : [];
  }
  // Catalogue consumers must distinguish an empty artist list from a failed account read.
  readStudentArtists(): StorageReadResult<{ id: string; name: string }[]> {
    this.usersRevision();
    const users = this.getUsers();
    if (!users) return { ok: false };
    return {
      ok: true,
      value: users.filter((user) => user.role === 'student').map(({ id, name }) => ({ id, name })),
    };
  }
  private loadSession(): User | null {
    const session = this.storage.readSessionString(this.SESSION_KEY);
    if (!session.ok) {
      this.storageError.set(READ_ERROR);
      return null;
    }
    if (!session.value) return null;
    const users = this.getUsers();
    if (!users) {
      this.storageError.set(READ_ERROR);
      return null;
    }
    return users.find((user) => user.id === session.value) ?? null;
  }
  private fail(error: string, storage = false): AuthResult {
    if (storage) this.storageError.set(error);
    return { ok: false, error };
  }
  private async hash(text: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  getRememberedUsername(): string {
    try {
      return this.storage.getCookie(this.COOKIE);
    } catch {
      return '';
    }
  }
  private rememberUsername(username: string, remember: boolean): void {
    // A blocked optional cookie must not undo a successfully persisted login session.
    try {
      if (remember) this.storage.setCookie(this.COOKIE, username, 7);
      else this.storage.deleteCookie(this.COOKIE);
    } catch {
      /* The login session is saved even if optional cookies are unavailable. */
    }
  }
  async seedDemoUsers(): Promise<boolean> {
    if (this.sharedLogin) return true;
    const users = this.getUsers();
    if (!users) {
      this.fail(READ_ERROR, true);
      return false;
    }
    if (users.length) return true;
    try {
      const passwordHash = await this.hash('Pass1234');
      const make = (username: string, name: string, role: Role): User => ({
        id: crypto.randomUUID(),
        username,
        name,
        role,
        email: `${username}@artspace.com`,
        picture: '',
        cardLast4: '0000',
        passwordHash,
        preferences: { theme: 'light', newsletter: false },
      });
      // Recheck after hashing so initialization cannot overwrite a newly created account.
      const latest = this.getUsers();
      if (!latest) {
        this.fail(READ_ERROR, true);
        return false;
      }
      if (latest.length) return true;
      if (
        !this.saveUsers([
          make('student1', 'Demo Student', 'student'),
          make('accountant1', 'Demo Accountant', 'accountant'),
          make('admin1', 'Demo Admin', 'admin'),
        ])
      ) {
        this.fail(SAVE_ERROR, true);
        return false;
      }
      this.storageError.set('');
      return true;
    } catch {
      this.fail('Demo accounts could not be prepared. Please try again.');
      return false;
    }
  }
  async signup(data: {
    username: string;
    name: string;
    email: string;
    picture: string;
    password: string;
    cardNumber: string;
    newsletter: boolean;
    theme: 'light' | 'dark';
  }): Promise<AuthResult> {
    this.storageError.set('');
    if (this.http) {
      const { cardNumber, theme, newsletter, ...account } = data;
      return this.writeAccount('POST', '/api/auth/register', {
        ...account, cardLast4: cardNumber.slice(-4), preferences: { theme, newsletter },
      });
    }
    try {
      const passwordHash = await this.hash(data.password);
      const users = this.getUsers();
      if (!users) return this.fail(READ_ERROR, true);
      const username = data.username.trim(),
        name = data.name.trim(),
        email = data.email.trim();
      if (!name || !username || !email) return this.fail('Enter a username, name and email.');
      if (users.some((user) => user.username === username))
        return this.fail('Username already taken');
      if (users.some((user) => user.email.toLowerCase() === email.toLowerCase()))
        return this.fail('Email already registered');
      const user: User = {
        id: crypto.randomUUID(),
        username,
        name,
        email,
        picture: data.picture,
        role: 'student',
        passwordHash,
        cardLast4: data.cardNumber.slice(-4),
        preferences: { theme: data.theme, newsletter: data.newsletter },
      };
      if (!this.saveUsers([...users, user])) return this.fail(SAVE_ERROR, true);
      return { ok: true, error: '' };
    } catch {
      return this.fail('Your account could not be created. Please try again.');
    }
  }
  async restoreSession(): Promise<void> {
    if (!this.http) return;
    try {
      const { user } = await firstValueFrom(
        this.http.get<{ user: ServerUser | null }>(this.sessionUrl).pipe(timeout(5000)),
      );
      this.setServerUser(user);
    } catch {
      this.currentUser.set(null);
    }
  }

  private setServerUser(user: ServerUser | null): void {
    this.currentUser.set(user ? { ...user, passwordHash: '' } : null);
  }

  private async writeAccount(method: 'POST' | 'PATCH', url: string, body: object): Promise<AuthResult> {
    const http = this.http!;
    const currentUser = this.currentUser();
    try {
      await firstValueFrom(http.get(this.sessionUrl).pipe(timeout(10000)));
      const result = await firstValueFrom(
        http.request<{ user: ServerUser } | null>(method, url, { body }).pipe(timeout(10000)),
      );
      if (result?.user && currentUser === this.currentUser()) this.setServerUser(result.user);
      return { ok: true, error: '' };
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 401) return this.fail('Please sign in again.');
        if (error.status === 422) return this.fail(error.error?.message ?? 'Check your account details.');
        if (error.status === 429) return this.fail('Too many attempts. Wait a minute and try again.');
      }
      return this.fail('Account service is unavailable. Try again.');
    }
  }

  saveServerProfile(changes: Partial<Pick<User, 'name' | 'email' | 'picture' | 'preferences'>>): Promise<AuthResult> {
    return this.writeAccount('PATCH', '/api/auth/profile', changes);
  }

  private async loginServer(identifier: string, password: string, remember: boolean): Promise<AuthResult> {
    const http = this.http!;
    try {
      await firstValueFrom(http.get(this.sessionUrl).pipe(timeout(10000)));
      const { user } = await firstValueFrom(
        http.post<{ user: ServerUser }>(this.sessionUrl, { identifier, password }).pipe(timeout(10000)),
      );
      this.setServerUser(user);
      this.rememberUsername(user.username || identifier, remember);
      return { ok: true, error: '' };
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        if ([401, 422].includes(error.status)) return this.fail('Invalid username, email or password');
        if (error.status === 429) return this.fail('Too many attempts. Wait a minute and try again.');
      }
      return this.fail('Sign-in is unavailable. Check the server and try again.');
    }
  }

  async logoutServer(): Promise<AuthResult> {
    try {
      const http = this.http!;
      await firstValueFrom(http.get(this.sessionUrl).pipe(timeout(10000)));
      await firstValueFrom(http.delete(this.sessionUrl).pipe(timeout(10000)));
      this.currentUser.set(null);
      return { ok: true, error: '' };
    } catch {
      return this.fail('The server could not end your session. Try again.');
    }
  }

  async login(username: string, password: string, remember: boolean): Promise<AuthResult> {
    this.storageError.set('');
    if (this.http) return this.loginServer(username.trim(), password, remember);
    try {
      const passwordHash = await this.hash(password);
      const users = this.getUsers();
      if (!users) return this.fail(READ_ERROR, true);
      const user = users.find((candidate) => candidate.username === username.trim());
      if (!user || user.passwordHash !== passwordHash)
        return this.fail('Invalid username or password');
      // Keep the existing raw string session ID format, not a JSON-quoted string.
      if (!this.storage.setSessionString(this.SESSION_KEY, user.id))
        return this.fail(
          'You could not be logged in because browser session storage is blocked or full. Your previous session has been kept. Please allow site storage and try again.',
          true,
        );
      this.currentUser.set(user);
      // Refresh reactive listing readers after a successful retry of previously blocked reads.
      this.usersRevision.update((value) => value + 1);
      this.rememberUsername(user.username, remember);
      return { ok: true, error: '' };
    } catch {
      return this.fail('You could not be logged in. Please try again.');
    }
  }
  logout(): AuthResult {
    this.storageError.set('');
    if (!this.storage.removeSession(this.SESSION_KEY))
      return this.fail(
        'You could not be logged out because browser session storage is blocked. Your session is unchanged. Please allow site storage and try again.',
        true,
      );
    this.currentUser.set(null);
    return { ok: true, error: '' };
  }
  updateProfile(
    changes: Partial<Pick<User, 'name' | 'email' | 'picture' | 'preferences'>>,
  ): AuthResult {
    this.storageError.set('');
    const me = this.currentUser();
    if (!me) return this.fail('Please log in before updating your profile.');
    const users = this.getUsers();
    if (!users) return this.fail(READ_ERROR, true);
    const stored = users.find((user) => user.id === me.id);
    if (!stored) return this.fail('Your saved account was not found. Please log in again.');
    const updated = {
      ...stored,
      ...changes,
      name: (changes.name ?? stored.name).trim(),
      email: (changes.email ?? stored.email).trim(),
    };
    if (!updated.name || !updated.email) return this.fail('Enter a name and a valid email.');
    if (
      users.some(
        (user) => user.id !== me.id && user.email.toLowerCase() === updated.email.toLowerCase(),
      )
    )
      return this.fail('Email already registered');
    if (!this.saveUsers(users.map((user) => (user.id === me.id ? updated : user))))
      return this.fail(SAVE_ERROR, true);
    this.currentUser.set(updated);
    return { ok: true, error: '' };
  }
}
