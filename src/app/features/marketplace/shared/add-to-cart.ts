import { Component, computed, inject, input, OnDestroy, signal } from '@angular/core';
import { Artwork } from '../artworks';
import { CartService } from '../cart';

@Component({
  selector: 'app-add-to-cart',
  template: `<button type="button" [class.added]="added()" [disabled]="atLimit() || pending() || cart.busy() || cart.checkoutPending() || cart.loading() || !!cart.readError()" (click)="add()">
      {{ pending() ? 'Adding...' : atLimit() ? 'Quantity limit reached' : added() ? 'Added to Cart' : 'Add to Cart' }}
    </button>
    @if (error()) { <p role="alert">{{ error() }}</p> }
    <span class="status" role="status">{{
      added() ? artwork().title + ' added to cart.' : ''
    }}</span>`,
  styles: `
    button {
      padding: 0.65rem 1.2rem;
      border: 0;
      border-radius: 8px;
      background: var(--brand-accent);
      color: var(--brand-deep);
      font: inherit;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:focus-visible {
      outline: 3px solid currentColor;
      outline-offset: 4px;
    }
    .added {
      animation: added 0.4s ease;
      background: #b9dfb7;
    }
    .status {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
    @keyframes added {
      50% {
        transform: scale(1.07);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      button {
        animation: none !important;
        transition: none;
      }
    }
  `,
})
export class AddToCart implements OnDestroy {
  readonly artwork = input.required<Artwork>();
  readonly added = signal(false);
  readonly error = signal('');
  readonly cart = inject(CartService);
  readonly pending = signal(false);
  readonly atLimit = computed(
    () => this.cart.items().filter((item) => item.id === this.artwork().id).length >= this.cart.maxQuantity,
  );
  private timer?: ReturnType<typeof setTimeout>;
  private destroyed = false;
  async add(): Promise<void> {
    if (this.atLimit() || this.pending() || this.cart.busy()) return;
    clearTimeout(this.timer);
    this.added.set(false);
    this.error.set('');
    this.pending.set(true);
    const result = this.cart.addToCart(this.artwork());
    const success = typeof result === 'boolean' ? result : await result;
    if (this.destroyed) return;
    this.pending.set(false);
    if (!success) {
      this.error.set(this.cart.storageError());
      return;
    }
    this.added.set(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.added.set(false), 1400);
  }
  ngOnDestroy(): void {
    this.destroyed = true;
    clearTimeout(this.timer);
  }
}
