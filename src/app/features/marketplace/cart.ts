import { computed, inject, Injectable, signal } from '@angular/core';
import { Artwork } from './artworks';
import { ArtworkCatalog } from './artwork-catalog';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly catalog = inject(ArtworkCatalog);
  private readonly storageKey = 'artspace-cart';
  private readonly cartItems = signal<readonly Artwork[]>(this.loadCart());
  readonly items = this.cartItems.asReadonly();
  readonly total = computed(() => this.items().reduce((sum, item) => sum + item.price, 0));
  readonly lines = computed(() => {
    const rows = new Map<number, { artwork: Artwork; quantity: number }>();
    for (const artwork of this.items()) {
      const row = rows.get(artwork.id);
      if (row) row.quantity++;
      else rows.set(artwork.id, { artwork, quantity: 1 });
    }
    return [...rows.values()];
  });

  setQuantity(id: number, quantity: number): void {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return;
    const artwork = this.items().find((item) => item.id === id);
    if (!artwork) return;
    let replaced = false;
    this.cartItems.update((items) =>
      items.flatMap((item) => {
        if (item.id !== id) return [item];
        if (replaced) return [];
        replaced = true;
        return Array.from({ length: quantity }, () => artwork);
      }),
    );
    this.saveCart();
  }

  removeArtwork(id: number): void {
    this.cartItems.update((items) => items.filter((item) => item.id !== id));
    this.saveCart();
  }

  clear(): void {
    this.cartItems.set([]);
    this.saveCart();
  }

  addToCart(artwork: Artwork): void {
    const item = this.catalog.artworks().find((candidate) => candidate.id === artwork.id);
    if (!item) return;
    if (this.items().filter((existing) => existing.id === item.id).length >= 99) return;
    this.cartItems.update((items) => [...items, item]);
    this.saveCart();
  }
  removeFromCart(index: number): void {
    this.cartItems.update((items) => items.filter((_, i) => i !== index));
    this.saveCart();
  }
  private saveCart(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.items()));
    } catch {
      /* Keep the cart usable when storage is unavailable. */
    }
  }
  private loadCart(): readonly Artwork[] {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(this.storageKey) ?? '[]');
      if (!Array.isArray(saved)) return [];
      const counts = new Map<number, number>();
      return saved.flatMap((value) => {
        const item = this.catalog.artworks().find((artwork) => artwork.id === value?.id);
        if (!item || (counts.get(item.id) ?? 0) >= 99) return [];
        counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
        return [item];
      });
    } catch {
      return [];
    }
  }
}
