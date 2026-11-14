import { inject, Injectable } from '@angular/core';
import { ListingsService } from './listings.service';

/** Shared reactive catalogue for both mock and student-created artworks. */
@Injectable({ providedIn: 'root' })
export class ArtworkCatalog {
  readonly artworks = inject(ListingsService).all;
}
