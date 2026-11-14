import { computed, inject, Injectable, signal } from '@angular/core';
import { Artwork } from './artworks';
import { ArtworkCatalog } from './artwork-catalog';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly catalog = inject(ArtworkCatalog);
  private readonly storageKey = 'artspace-cart';
  private readonly cartIds = signal<Artwork['id'][]>(this.loadCart());
  readonly items = computed(() =>
    this.cartIds().flatMap((id) => {
      const item = this.catalog.artworks().find((artwork) => artwork.id === id);
      return item ? [item] : [];
    }),
  );
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

  setQuantity(id: Artwork['id'], quantity: number): void {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return;
    const artwork = this.items().find((item) => item.id === id);
    if (!artwork) return;
    let replaced = false;
    this.cartIds.update((items) =>
      items.flatMap((item) => {
        if (item !== id) return [item];
        if (replaced) return [];
        replaced = true;
        return Array.from({ length: quantity }, () => artwork.id);
      }),
    );
    this.saveCart();
  }

  removeArtwork(id: Artwork['id']): void {
    this.cartIds.update((items) => items.filter((item) => item !== id));
    this.saveCart();
  }

  clear(): void {
    this.cartIds.set([]);
    this.saveCart();
  }

  addToCart(artwork: Artwork): void {
    const item = this.catalog.artworks().find((candidate) => candidate.id === artwork.id);
    if (!item) return;
    if (this.items().filter((existing) => existing.id === item.id).length >= 99) return;
    this.cartIds.update((items) => [...items, item.id]);
    this.saveCart();
  }
  removeFromCart(index: number): void {
    this.cartIds.set(
      this.items()
        .filter((_, i) => i !== index)
        .map((item) => item.id),
    );
    this.saveCart();
  }
  private saveCart(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.items()));
    } catch {
      /* Keep the cart usable when storage is unavailable. */
    }
  }
  private loadCart(): Artwork['id'][] {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(this.storageKey) ?? '[]');
      if (!Array.isArray(saved)) return [];
      const counts = new Map<Artwork['id'], number>();
      return saved.flatMap((value) => {
        const item = this.catalog.artworks().find((artwork) => artwork.id === value?.id);
        if (!item || (counts.get(item.id) ?? 0) >= 99) return [];
        counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
        return [item.id];
      });
    } catch {
      return [];
    }
  }
}
