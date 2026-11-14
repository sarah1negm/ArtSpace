import { computed, inject, Injectable, signal } from '@angular/core';
import { Artwork } from './artworks';
import { ListingsService } from './listings.service';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly storageKey = 'artspace-cart';
  private readonly listings = inject(ListingsService);
  private readonly cartIds = signal<Artwork['id'][]>(this.loadCart());
  readonly items = computed(() =>
    this.cartIds().flatMap((id) => {
      const item = this.listings.all().find((candidate) => candidate.id === id);
      return item ? [item] : [];
    }),
  );
  readonly total = computed(() => this.items().reduce((sum, item) => sum + item.price, 0));

  addToCart(artwork: Artwork): void {
    const item = this.listings.all().find((candidate) => candidate.id === artwork.id);
    if (!item) return;
    this.cartIds.set([...this.items().map((item) => item.id), item.id]);
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
      return saved.flatMap((value) => {
        const id = value?.id;
        return typeof id === 'string' || typeof id === 'number' ? [id] : [];
      });
    } catch {
      return [];
    }
  }
}
