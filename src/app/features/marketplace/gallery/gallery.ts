import { Component, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CartService } from '../cart';
import { ListingsService } from '../listings.service';
import { AddToCart } from '../shared/add-to-cart';

@Component({
  selector: 'app-gallery',
  imports: [CurrencyPipe, RouterLink, AddToCart],
  templateUrl: './gallery.html',
  styleUrls: ['../marketplace.scss', './gallery.scss'],
})
export class Gallery {
  readonly cartService: CartService = inject(CartService);
  readonly artworks = inject(ListingsService).all;
}
