import { Component, computed, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ARTWORKS } from '../artworks';
import { AddToCart } from '../shared/add-to-cart';

@Component({
  selector: 'app-artwork-details',
  imports: [CurrencyPipe, RouterLink, AddToCart],
  templateUrl: './details.html',
  styleUrls: ['../marketplace.scss', './details.scss'],
})
export class ArtworkDetails {
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  readonly artwork = computed(() =>
    ARTWORKS.find((item) => String(item.id) === this.params()?.get('id')),
  );
}
