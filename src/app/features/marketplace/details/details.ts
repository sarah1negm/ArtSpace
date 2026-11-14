import { Component, computed, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ArtworkCatalog } from '../artwork-catalog';
import { AddToCart } from '../shared/add-to-cart';

@Component({
  selector: 'app-artwork-details',
  imports: [CurrencyPipe, RouterLink, AddToCart],
  templateUrl: './details.html',
  styleUrls: ['../marketplace.scss', './details.scss'],
})
export class ArtworkDetails {
  private readonly catalog = inject(ArtworkCatalog);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  readonly artwork = computed(() =>
    this.catalog.artworks().find((item) => String(item.id) === this.params()?.get('id')),
  );
}
