import { Injectable } from '@angular/core';

export type StorageReadResult<T> = { ok: true; value: T } | { ok: false };

@Injectable({ providedIn: 'root' })
export class StorageService {
  // Unlike getLocal's fallback, this preserves the distinction between missing and unreadable data.
  readLocal<T>(key: string, fallback: T): StorageReadResult<T> {
    try {
      const raw = localStorage.getItem(key);
      return { ok: true, value: raw === null ? fallback : JSON.parse(raw) as T };
    } catch { return { ok: false }; }
  }
  readSessionString(key: string): StorageReadResult<string | null> {
    try { return { ok: true, value: sessionStorage.getItem(key) }; }
    catch { return { ok: false }; }
  }
  setSessionString(key: string, value: string): boolean {
    try { sessionStorage.setItem(key, value); return true; }
    catch { return false; }
  }
  /** False means nothing was saved; callers must not commit their in-memory change. */
  // localStorage: data that must survive closing the browser (cart, listings, invoices)
  getLocal<T>(key: string, fallback: T): T {
    try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; }
    catch { return fallback; }
  }
  setLocal(key: string, value: unknown): boolean {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  }

  // sessionStorage: temporary data tied to this tab (checkout in progress, filters, form drafts)
  getSession<T>(key: string, fallback: T): T {
    try { const v = sessionStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; }
    catch { return fallback; }
  }
  setSession(key: string, value: unknown): boolean {
    try { sessionStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  }
  removeSession(key: string): boolean {
    try { sessionStorage.removeItem(key); return true; }
    catch { return false; }
  }

  // cookies: tiny preferences with an expiry (remember-me, theme, cookie consent)
  getCookie(name: string): string {
    const hit = document.cookie.split('; ').find(c => c.startsWith(name + '='));
    return hit ? decodeURIComponent(hit.split('=')[1]) : '';
  }
  setCookie(name: string, value: string, days = 7) {
    document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${days * 86400}; path=/; SameSite=Strict`;
  }
  deleteCookie(name: string) { document.cookie = `${name}=; max-age=0; path=/`; }
}
