import { Routes } from '@angular/router';

export const STUDENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./student-shell').then((m) => m.StudentShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Student Dashboard | ArtSpace',
        loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'fees',
        title: 'Student Fees | ArtSpace',
        loadComponent: () => import('./fees/fees').then((m) => m.Fees),
      },
      {
        path: 'invoices',
        title: 'Invoices | ArtSpace',
        loadComponent: () => import('./invoices/invoices').then((m) => m.Invoices),
      },
      {
        path: 'artwork',
        title: 'Artwork Listings | ArtSpace',
        loadComponent: () =>
          import('./artwork-management/artwork-management').then((m) => m.ArtworkManagement),
      },
      {
        path: 'sales',
        title: 'Student Sales | ArtSpace',
        loadComponent: () => import('./sales/sales').then((m) => m.Sales),
      },
      { path: '**', redirectTo: '' },
    ],
  },
];
