import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class StorageService {
  // localStorage: data that must survive closing the browser (cart, listings, invoices)
  getLocal<T>(key: string, fallback: T): T {
    try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; }
    catch { return fallback; }
  }
  setLocal(key: string, value: unknown) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
  }

  // sessionStorage: temporary data tied to this tab (checkout in progress, filters, form drafts)
  getSession<T>(key: string, fallback: T): T {
    try { const v = sessionStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; }
    catch { return fallback; }
  }
  setSession(key: string, value: unknown) {
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  }
  removeSession(key: string) { sessionStorage.removeItem(key); }

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