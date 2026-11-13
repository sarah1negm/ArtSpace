import { Component, inject, input, OnDestroy, signal } from '@angular/core';
import { Artwork } from '../artworks';
import { CartService } from '../cart';

@Component({
  selector: 'app-add-to-cart',
  template: `<button type="button" [class.added]="added()" (click)="add()">
      {{ added() ? 'Added to Cart' : 'Add to Cart' }}
    </button>
    <span class="status" role="status">{{
      added() ? artwork().title + ' added to cart.' : ''
    }}</span>`,
  styles: `
    button {
      padding: 0.65rem 1.2rem;
      border: 0;
      border-radius: 8px;
      background: #e8a33d;
      color: #1f1b2e;
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
  private readonly cart = inject(CartService);
  private timer?: ReturnType<typeof setTimeout>;
  add(): void {
    this.cart.addToCart(this.artwork());
    this.added.set(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.added.set(false), 1400);
  }
  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }
}
