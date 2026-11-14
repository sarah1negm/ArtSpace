import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CartService } from '../cart';
import { CATEGORIES, ArtworkCategory } from '../artworks';
import { ArtworkCatalog } from '../artwork-catalog';
import { AddToCart } from '../shared/add-to-cart';

export type SortOrder = 'title' | 'price-asc' | 'price-desc' | 'popularity';
@Component({
  selector: 'app-gallery',
  imports: [CurrencyPipe, RouterLink, AddToCart],
  templateUrl: './gallery.html',
  styleUrls: ['../marketplace.scss', './gallery.scss'],
})
export class Gallery {
  readonly cartService: CartService = inject(CartService);
  readonly artworks = inject(ArtworkCatalog).artworks;
  readonly categories = CATEGORIES;
  readonly search = signal('');
  readonly category = signal<ArtworkCategory | ''>('');
  readonly minPrice = signal<number | null>(null);
  readonly maxPrice = signal<number | null>(null);
  readonly sort = signal<SortOrder>('title');
  readonly invalidRange = computed(
    () =>
      this.minPrice() !== null && this.maxPrice() !== null && this.minPrice()! > this.maxPrice()!,
  );
  readonly filteredArtworks = computed(() => {
    const query = this.search().trim().toLowerCase();
    const min = this.minPrice();
    const max = this.maxPrice();
    if (this.invalidRange()) return [];
    const result = this.artworks().filter(
      (item) =>
        item.title.toLowerCase().includes(query) &&
        (!this.category() || item.category === this.category()) &&
        (min === null || item.price >= min) &&
        (max === null || item.price <= max),
    );
    return result.sort((a, b) => {
      switch (this.sort()) {
        case 'price-asc':
          return a.price - b.price || a.title.localeCompare(b.title);
        case 'price-desc':
          return b.price - a.price || a.title.localeCompare(b.title);
        case 'popularity':
          return b.popularity - a.popularity || a.title.localeCompare(b.title);
        default:
          return a.title.localeCompare(b.title);
      }
    });
  });
  setPrice(bound: 'min' | 'max', value: string): void {
    const number = value.trim() === '' ? null : Number(value);
    const price = number !== null && Number.isFinite(number) && number >= 0 ? number : null;
    (bound === 'min' ? this.minPrice : this.maxPrice).set(price);
  }
  setCategory(value: string): void {
    this.category.set(CATEGORIES.find((category) => category === value) ?? '');
  }
  setSort(value: string): void {
    if (
      value === 'title' ||
      value === 'price-asc' ||
      value === 'price-desc' ||
      value === 'popularity'
    )
      this.sort.set(value);
  }
  resetFilters(): void {
    this.search.set('');
    this.category.set('');
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.sort.set('title');
  }
}
