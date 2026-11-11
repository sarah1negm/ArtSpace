import { Routes } from '@angular/router';

export const MARKETPLACE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./gallery/gallery').then((m) => m.Gallery),
  },
  { path: 'cart', loadComponent: () => import('./cart/cart').then((m) => m.Cart) },
  { path: ':id', loadComponent: () => import('./details/details').then((m) => m.ArtworkDetails) },
];
