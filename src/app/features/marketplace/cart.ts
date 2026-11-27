import { computed, inject, Injectable, signal } from '@angular/core';
import { Artwork } from './artworks';
import { ArtworkCatalog } from './artwork-catalog';
import { StudentService } from '../student/student.service';
import { loadError } from '../../core/services/storage-validation';
import { StorageService, StoredData } from '../../core/services/storage.service';
import { CheckoutReceipt, MarketplaceApi, USE_MARKETPLACE_API } from './marketplace-api.service';

@Injectable({ providedIn: 'root' })
export class CartService {
  readonly serverMode = inject(USE_MARKETPLACE_API);
  private readonly api = this.serverMode ? inject(MarketplaceApi) : null;
  readonly busy = computed(() => this.api?.busy() ?? false);
  readonly loading = computed(() => this.serverMode && !this.api!.ready() && !this.api!.readError());
  readonly maxQuantity = this.serverMode ? 1 : 99;
  readonly unavailableIds = computed(() => this.api?.data().unavailableIds ?? []);
  readonly checkoutPending = computed(() => this.api?.checkoutPending() ?? false);
  private readonly catalog = inject(ArtworkCatalog);
  private readonly storage = inject(StorageService);
  private readonly storageKey = 'artspace-cart';
  private readonly students = inject(StudentService);
  private readonly writeError = signal('');
  readonly loadStatus = signal<StoredData<unknown>['status']>('missing');
  readonly readError = computed(() => this.api ? this.api.readError() : loadError(this.loadStatus(), 'cart') || this.students.listingsError());
  readonly storageError = computed(() => this.readError() || (this.api ? this.api.error() : this.writeError()));
  private readonly cartIds = signal<Artwork['id'][]>(this.serverMode ? [] : this.loadCart());
  readonly items = computed(() => this.api ? this.api.items() : this.resolve(this.cartIds()));
  readonly total = computed(() => this.api ? this.api.data().total : this.items().reduce((sum, item) => sum + item.price, 0));
  readonly lines = computed(() => {
    const rows = new Map<Artwork['id'], { artwork: Artwork; quantity: number }>();
    for (const artwork of this.items()) {
      const row = rows.get(artwork.id);
      if (row) row.quantity++;
      else rows.set(artwork.id, { artwork, quantity: 1 });
    }
    return [...rows.values()];
  });

  setQuantity(id: Artwork['id'], quantity: number): boolean | Promise<boolean> {
    if (this.api) return this.api.quantity(id, quantity);
    if (!this.canWrite()) return false;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return false;
    if (!this.items().some((item) => item.id === id)) return false;
    let replaced = false;
    const next = this.cartIds().flatMap((item) => {
      if (item !== id) return [item];
      if (replaced) return [];
      replaced = true;
      return Array.from({ length: quantity }, () => id);
    });
    return this.saveCart(next);
  }

  removeArtwork(id: Artwork['id']): boolean | Promise<boolean> {
    if (this.api) return this.api.remove(id);
    return this.saveCart(this.cartIds().filter((item) => item !== id));
  }

  clear(): boolean | Promise<boolean> {
    if (this.api) return this.api.clear();
    return this.saveCart([]);
  }

  addToCart(artwork: Artwork): boolean | Promise<boolean> {
    if (this.api) return this.api.add(artwork.id);
    if (!this.canWrite()) return false;
    const item = this.catalog.artworks().find((candidate) => candidate.id === artwork.id);
    if (!item || this.items().filter((existing) => existing.id === item.id).length >= 99)
      return false;
    return this.saveCart([...this.cartIds(), item.id]);
  }

  removeFromCart(index: number): boolean | Promise<boolean> {
    if (this.api) {
      const item = this.items()[index];
      return item ? this.api.remove(item.id) : false;
    }
    return this.saveCart(
      this.items()
        .filter((_, i) => i !== index)
        .map((item) => item.id),
    );
  }

  private resolve(ids: readonly Artwork['id'][]): Artwork[] {
    return ids.flatMap((id) => {
      const item = this.catalog.artworks().find((artwork) => artwork.id === id);
      return item ? [item] : [];
    });
  }

  private saveCart(nextIds: Artwork['id'][]): boolean {
    this.writeError.set('');
    if (!this.canWrite()) return false;
    // Keep the existing array-of-artworks storage format and resolve current prices.
    if (!this.storage.setLocal(this.storageKey, this.resolve(nextIds))) {
      this.writeError.set(
        'Your cart could not be saved. Browser storage may be full or blocked. Your cart has not changed. Please free storage or allow site storage, then try again.',
      );
      return false;
    }
    this.cartIds.set(nextIds);
    return true;
  }

  retryLoad(): void {
    if (this.api) { void this.api.load(); return; }
    this.writeError.set('');
    this.students.retryLoad();
    const ids = this.loadCart();
    if (['loaded', 'missing'].includes(this.loadStatus())) this.cartIds.set(ids);
  }

  private canWrite(): boolean {
    return ['loaded', 'missing'].includes(this.loadStatus()) && this.students.listingsReady() && !this.students.listingsError();
  }

  checkout(): CheckoutReceipt | null | Promise<CheckoutReceipt | null> {
    if (this.api) {
      return this.api.checkout().then(receipt => {
        if (receipt) this.students.retryLoad();
        return receipt;
      });
    }
    if (!this.items().length || this.readError()) return null;
    const receipt = { total: this.total(), quantity: this.items().length };
    return this.clear() ? receipt : null;
  }

  private loadCart(): Artwork['id'][] {
    const result = this.storage.loadLocal(this.storageKey, (value): value is unknown[] => Array.isArray(value));
    this.loadStatus.set(result.status);
    if (result.status !== 'loaded') return [];
    const counts = new Map<Artwork['id'], number>();
    return result.value.flatMap(value => {
      // Keep unresolved IDs until the catalogue recovers; never trust persisted prices.
      const id = value && typeof value === 'object' ? (value as { id?: unknown }).id : null;
      if (!(typeof id === 'string' || typeof id === 'number' && Number.isFinite(id)) ||
          (counts.get(id) ?? 0) >= 99) return [];
      counts.set(id, (counts.get(id) ?? 0) + 1);
      return [id];
    });
  }
}
