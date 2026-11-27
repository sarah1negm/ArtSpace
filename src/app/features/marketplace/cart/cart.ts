import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CartService } from '../cart';
import { CheckoutReceipt } from '../marketplace-api.service';

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
    if (!this.cartService.items().length && !this.cartService.checkoutPending()) return;
    const complete = (receipt: CheckoutReceipt | null) => {
      if (!receipt) return;
      this.receipt.set(receipt);
      this.confirming.set(false);
    };
    const result = this.cartService.checkout();
    if (result instanceof Promise) void result.then(complete);
    else complete(result);
  }
}
