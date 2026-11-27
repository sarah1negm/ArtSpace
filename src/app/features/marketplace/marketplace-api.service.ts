import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, InjectionToken, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { Artwork } from './artworks';
import { MarketplaceMonitoring } from '../../core/services/marketplace-monitoring';
import { AuthService } from '../../core/services/auth.service';

export const USE_MARKETPLACE_API = new InjectionToken<boolean>('Laravel marketplace', {
  providedIn: 'root', factory: () => false,
});
export interface CartData {
  lines: { artwork: Artwork; quantity: number }[];
  total: number;
  unavailableIds: string[];
}
export interface CheckoutReceipt {
  total: number;
  quantity: number;
  requestId?: string;
  saleIds?: string[];
  simulated?: boolean;
  cart?: CartData;
}

/** getRandomValues also works on HTTP LAN origins, unlike randomUUID(). */
export function checkoutRequestId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

@Injectable({ providedIn: 'root' })
export class MarketplaceApi {
  private readonly http = inject(HttpClient);
  private readonly monitoring = inject(MarketplaceMonitoring);
  private readonly auth = inject(AuthService);
  private generation = 0;
  readonly data = signal<CartData>({ lines: [], total: 0, unavailableIds: [] });
  readonly ready = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly readError = signal('');
  readonly items = computed(() => this.data().lines.flatMap(line =>
    Array.from({ length: line.quantity }, () => line.artwork)));
  private readonly pendingCheckout = signal<string | null>(null);
  private pendingTotalMinor = 0;
  readonly checkoutPending = computed(() => this.pendingCheckout() !== null);

  constructor() {
    let identity = this.auth.currentUser()?.id;
    void this.load();
    effect(() => {
      const next = this.auth.currentUser()?.id;
      if (next === identity) return;
      identity = next;
      untracked(() => {
        this.generation++;
        this.data.set({ lines: [], total: 0, unavailableIds: [] });
        this.ready.set(false);
        this.busy.set(false);
        this.pendingCheckout.set(null);
        void this.load();
      });
    });
  }

  async load(): Promise<void> {
    if (this.busy()) return;
    const generation = this.generation;
    this.busy.set(true);
    try {
      const data = await firstValueFrom(this.http.get<CartData>('/api/cart'));
      if (generation !== this.generation) return;
      this.data.set(data);
      this.ready.set(true);
      this.readError.set('');
      this.error.set('');
    } catch {
      if (generation !== this.generation) return;
      this.ready.set(false);
      this.readError.set('Your server cart could not be loaded. Retry before changing it.');
    } finally { if (generation === this.generation) this.busy.set(false); }
  }

  async add(id: Artwork['id']) {
    const started = performance.now();
    const success = await this.change(() => this.http.post<CartData>('/api/cart/items', { artworkId: id }));
    this.monitoring.measure('marketplace_add_cart_ms', started, success);
    return success;
  }
  remove(id: Artwork['id']) { return this.change(() => this.http.delete<CartData>('/api/cart/items/' + encodeURIComponent(id))); }
  clear() { return this.change(() => this.http.delete<CartData>('/api/cart')); }
  quantity(id: Artwork['id'], quantity: number) {
    return this.change(() => this.http.patch<CartData>('/api/cart/items/' + encodeURIComponent(id), { quantity }));
  }

  async checkout(): Promise<CheckoutReceipt | null> {
    if (!this.ready() || this.busy() || (!this.checkoutPending() &&
        (this.data().unavailableIds.length || !this.items().length))) return null;
    const generation = this.generation;
    this.busy.set(true);
    this.error.set('');
    const started = performance.now();
    // Keep the same key after a network failure: a retry can retrieve the receipt.
    try {
      if (!this.pendingCheckout()) {
        this.pendingCheckout.set(checkoutRequestId());
        this.pendingTotalMinor = Math.round(this.data().total * 100);
      }
      const receipt = await firstValueFrom(this.http.post<CheckoutReceipt>('/api/cart/checkout', {
        requestId: this.pendingCheckout(), expectedTotalMinor: this.pendingTotalMinor,
      }));
      if (generation !== this.generation) return null;
      this.data.set(receipt.cart ?? { lines: [], total: 0, unavailableIds: [] });
      this.pendingCheckout.set(null);
      this.monitoring.measure('marketplace_checkout_ms', started, true);
      return receipt;
    } catch (error) {
      if (generation !== this.generation) return null;
      if (error instanceof HttpErrorResponse && [401, 403, 409, 419, 422, 429].includes(error.status)) {
        this.pendingCheckout.set(null);
      }
      this.monitoring.measure('marketplace_checkout_ms', started, false);
      this.error.set(this.describe(error));
      return null;
    } finally { if (generation === this.generation) this.busy.set(false); }
  }

  private async change(request: () => Observable<CartData>): Promise<boolean> {
    if (!this.ready() || this.busy() || this.checkoutPending()) return false;
    const generation = this.generation;
    this.busy.set(true);
    this.error.set('');
    try {
      const data = await firstValueFrom(request());
      if (generation !== this.generation) return false;
      this.data.set(data);
      this.pendingCheckout.set(null);
      return true;
    } catch (error) {
      if (generation !== this.generation) return false;
      this.error.set(this.describe(error));
      return false;
    } finally { if (generation === this.generation) this.busy.set(false); }
  }

  private describe(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) return 'Please sign in before completing your simulated purchase.';
      if (error.status === 419) return 'Your session expired. Reload the page and sign in, then retry.';
      if ([409, 422].includes(error.status) && typeof error.error?.message === 'string') return error.error.message;
    }
    return 'The server could not confirm this operation. Retry or reload your cart to check its state.';
  }
}
