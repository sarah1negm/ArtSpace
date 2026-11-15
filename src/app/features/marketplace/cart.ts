import { computed, inject, Injectable, signal } from '@angular/core';
import { Artwork } from './artworks';
import { ArtworkCatalog } from './artwork-catalog';
import { StorageService } from '../../core/services/storage.service';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly catalog = inject(ArtworkCatalog);
  private readonly storage = inject(StorageService);
  private readonly storageKey = 'artspace-cart';
  readonly storageError = signal('');
  private readonly cartIds = signal<Artwork['id'][]>(this.loadCart());
  readonly items = computed(() => this.resolve(this.cartIds()));
  readonly total = computed(() => this.items().reduce((sum, item) => sum + item.price, 0));
  readonly lines = computed(() => {
    const rows = new Map<Artwork['id'], { artwork: Artwork; quantity: number }>();
    for (const artwork of this.items()) {
      const row = rows.get(artwork.id);
      if (row) row.quantity++;
      else rows.set(artwork.id, { artwork, quantity: 1 });
    }
    return [...rows.values()];
  });

  setQuantity(id: Artwork['id'], quantity: number): boolean {
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

  removeArtwork(id: Artwork['id']): boolean {
    return this.saveCart(this.cartIds().filter((item) => item !== id));
  }

  clear(): boolean {
    return this.saveCart([]);
  }

  addToCart(artwork: Artwork): boolean {
    const item = this.catalog.artworks().find((candidate) => candidate.id === artwork.id);
    if (!item || this.items().filter((existing) => existing.id === item.id).length >= 99)
      return false;
    return this.saveCart([...this.cartIds(), item.id]);
  }

  removeFromCart(index: number): boolean {
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
    this.storageError.set('');
    // Keep the existing array-of-artworks storage format and resolve current prices.
    if (!this.storage.setLocal(this.storageKey, this.resolve(nextIds))) {
      this.storageError.set(
        'Your cart could not be saved. Browser storage may be full or blocked. Your cart has not changed. Please free storage or allow site storage, then try again.',
      );
      return false;
    }
    this.cartIds.set(nextIds);
    return true;
  }

  private loadCart(): Artwork['id'][] {
    const saved = this.storage.getLocal<unknown>(this.storageKey, []);
    if (!Array.isArray(saved)) return [];
    const counts = new Map<Artwork['id'], number>();
    return saved.flatMap((value) => {
      const item = this.catalog.artworks().find((artwork) => artwork.id === value?.id);
      if (!item || (counts.get(item.id) ?? 0) >= 99) return [];
      counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
      return [item.id];
    });
  }
}
