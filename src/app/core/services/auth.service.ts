import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { Role, User } from '../models/user.model';
import { StorageReadResult, StorageService } from './storage.service';

export const LOCAL_STUDENT_LOGIN = new InjectionToken<boolean>('Local Laravel student login', {
  providedIn: 'root',
  factory: () => false,
});

type LocalStudent = Pick<User, 'id' | 'username' | 'name' | 'email'>;

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
  private readonly http = inject(LOCAL_STUDENT_LOGIN) ? inject(HttpClient) : null;
  private readonly studentSessionUrl = '/api/local/student-session';
  readonly serverStudent = signal(false);
  private readonly USERS_KEY = 'artspace_users';
  private readonly SESSION_KEY = 'artspace_session';
  private readonly COOKIE = 'artspace_remember';
  private readonly usersRevision = signal(0);
  readonly storageError = signal('');
  readonly currentUser = signal<User | null>(this.loadSession());
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
  async restoreServerStudent(): Promise<void> {
    if (!this.http) return;
    try {
      const { user } = await firstValueFrom(this.http.get<{ user: LocalStudent | null }>(this.studentSessionUrl).pipe(timeout(3000)));
      if (user) this.setServerStudent(user);
    } catch {
      // Laravel may be offline while running the original browser demo.
    }
  }

  private setServerStudent(user: LocalStudent): void {
    this.serverStudent.set(true);
    this.currentUser.set({
      ...user, role: 'student', picture: '', passwordHash: '', cardLast4: '',
      preferences: { theme: 'light', newsletter: false },
    });
  }

  private async loginServerStudent(identifier: string, password: string, remember: boolean): Promise<AuthResult> {
    const http = this.http!;
    try {
      await firstValueFrom(http.get(this.studentSessionUrl));
      const { user } = await firstValueFrom(http.post<{ user: LocalStudent }>(this.studentSessionUrl, { identifier, password }));
      this.storage.removeSession(this.SESSION_KEY);
      this.setServerStudent(user);
      this.rememberUsername(identifier, remember);
      return { ok: true, error: '' };
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        if ([401, 422].includes(error.status)) return this.fail('Invalid username or password');
        if (error.status === 429) return this.fail('Too many attempts. Wait a minute and try again.');
      }
      return this.fail('Laravel sign-in is unavailable. Check that the local server is running.');
    }
  }

  async logoutServerStudent(): Promise<AuthResult> {
    try {
      await firstValueFrom(this.http!.delete(this.studentSessionUrl));
      this.serverStudent.set(false);
      this.currentUser.set(null);
      return { ok: true, error: '' };
    } catch {
      return this.fail('Laravel could not end your session. Try again.');
    }
  }

  async login(username: string, password: string, remember: boolean): Promise<AuthResult> {
    this.storageError.set('');
    const identifier = username.trim().toLowerCase();
    if (this.http && /^portal-demo-(one|two)(@example\.test)?$/.test(identifier)) {
      return this.loginServerStudent(identifier, password, remember);
    }
    if (this.serverStudent()) return this.fail('Sign out of the Laravel demo account first.');
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
    if (this.serverStudent()) return this.fail('The local demo profile is read-only.');
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
