import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CartService } from '../cart';

@Component({
  selector: 'app-cart',
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './cart.html',
  styleUrls: ['../marketplace.scss', './cart.scss'],
})
export class Cart {
  readonly cartService: CartService = inject(CartService);
  readonly receipt = signal<{ total: number; quantity: number } | null>(null);
  readonly confirming = signal(false);
  checkout(): void {
    if (!this.cartService.items().length) return;
    const receipt = {
      total: this.cartService.total(),
      quantity: this.cartService.items().length,
    };
    if (!this.cartService.clear()) return;
    this.receipt.set(receipt);
    this.confirming.set(false);
  }
}
