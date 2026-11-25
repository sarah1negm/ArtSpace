import { Routes } from '@angular/router';

export const STUDENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./student-shell').then((m) => m.StudentShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Student Dashboard | Queens Art',
        loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'fees',
        title: 'Student Fees | Queens Art',
        loadComponent: () => import('./fees/fees').then((m) => m.Fees),
      },
      {
        path: 'invoices',
        title: 'Invoices | Queens Art',
        loadComponent: () => import('./invoices/invoices').then((m) => m.Invoices),
      },
      {
        path: 'artwork',
        title: 'Artwork Listings | Queens Art',
        loadComponent: () =>
          import('./artwork-management/artwork-management').then((m) => m.ArtworkManagement),
      },
      {
        path: 'sales',
        title: 'Student Sales | Queens Art',
        loadComponent: () => import('./sales/sales').then((m) => m.Sales),
      },
      { path: '**', redirectTo: '' },
    ],
  },
];
