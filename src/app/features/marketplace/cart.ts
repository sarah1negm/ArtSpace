import { computed, Injectable, signal } from '@angular/core';
import { ARTWORKS, Artwork } from './artworks';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly storageKey = 'artspace-cart';
  private readonly cartItems = signal<readonly Artwork[]>(this.loadCart());
  readonly items = this.cartItems.asReadonly();
  readonly total = computed(() => this.items().reduce((sum, item) => sum + item.price, 0));

  addToCart(artwork: Artwork): void {
    const item = ARTWORKS.find((candidate) => candidate.id === artwork.id);
    if (!item) return;
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
      return saved.flatMap((value) => {
        const item = ARTWORKS.find((artwork) => artwork.id === value?.id);
        return item ? [item] : [];
      });
    } catch {
      return [];
    }
  }
}
