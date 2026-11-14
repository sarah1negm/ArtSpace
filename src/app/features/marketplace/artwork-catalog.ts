import { Injectable, signal } from '@angular/core';
import { ARTWORKS, Artwork } from './artworks';

/** Shared catalogue boundary. Future ListingsService mapping belongs here. */
@Injectable({ providedIn: 'root' })
export class ArtworkCatalog {
  readonly artworks = signal<readonly Artwork[]>(ARTWORKS).asReadonly();
}
