import { Injectable, computed, signal } from '@angular/core';
import { Role, User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly USERS_KEY = 'artspace_users';
  private readonly SESSION_KEY = 'artspace_session';
  private readonly COOKIE = 'artspace_remember';

  readonly currentUser = signal<User | null>(this.loadSession());
  readonly isLoggedIn = computed(() => this.currentUser() !== null);
  readonly role = computed(() => this.currentUser()?.role ?? null);

  // ---------- storage helpers ----------
  private getUsers(): User[] {
    return JSON.parse(localStorage.getItem(this.USERS_KEY) ?? '[]');
  }
  private saveUsers(users: User[]) {
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
  }
  private loadSession(): User | null {
    const id = sessionStorage.getItem(this.SESSION_KEY);
    return this.getUsers().find(u => u.id === id) ?? null;
  }
  private async hash(text: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  getRememberedUsername(): string {
    return document.cookie.split('; ').find(c => c.startsWith(this.COOKIE + '='))?.split('=')[1] ?? '';
  }

  // ---------- demo accounts so teammates can test every role ----------
  async seedDemoUsers() {
    if (this.getUsers().length) return;
    const mk = async (username: string, name: string, role: Role): Promise<User> => ({
      id: crypto.randomUUID(), username, name, role,
      email: `${username}@artspace.com`, picture: '', cardLast4: '0000',
      passwordHash: await this.hash('Pass1234'),
      preferences: { theme: 'light', newsletter: false },
    });
    this.saveUsers([
      await mk('student1', 'Demo Student', 'student'),
      await mk('accountant1', 'Demo Accountant', 'accountant'),
      await mk('admin1', 'Demo Admin', 'admin'),
    ]);
  }

  // ---------- auth ----------
  async signup(data: { username: string; name: string; email: string; picture: string;
                       password: string; cardNumber: string; newsletter: boolean; theme: 'light' | 'dark' }) {
    const users = this.getUsers();
    if (users.some(u => u.username === data.username)) return { ok: false, error: 'Username already taken' };
    if (users.some(u => u.email === data.email)) return { ok: false, error: 'Email already registered' };
    const user: User = {
      id: crypto.randomUUID(), username: data.username, name: data.name, email: data.email,
      picture: data.picture, role: 'student',
      passwordHash: await this.hash(data.password),
      cardLast4: data.cardNumber.slice(-4),
      preferences: { theme: data.theme, newsletter: data.newsletter },
    };
    this.saveUsers([...users, user]);
    return { ok: true, error: '' };
  }

  async login(username: string, password: string, remember: boolean) {
    const user = this.getUsers().find(u => u.username === username);
    if (!user || user.passwordHash !== await this.hash(password)) {
      return { ok: false, error: 'Invalid username or password' };
    }
    sessionStorage.setItem(this.SESSION_KEY, user.id);
    this.currentUser.set(user);
    document.cookie = remember
      ? `${this.COOKIE}=${username}; max-age=${7 * 86400}; path=/; SameSite=Strict`
      : `${this.COOKIE}=; max-age=0; path=/`;
    return { ok: true, error: '' };
  }

  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
    this.currentUser.set(null);
  }

  updateProfile(changes: Partial<Pick<User, 'name' | 'email' | 'picture' | 'preferences'>>) {
    const me = this.currentUser();
    if (!me) return;
    const updated = { ...me, ...changes };
    this.saveUsers(this.getUsers().map(u => (u.id === me.id ? updated : u)));
    this.currentUser.set(updated);
  }
}