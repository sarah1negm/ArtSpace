import { Routes } from '@angular/router';

export const ACCOUNTING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./accounting-shell').then((m) => m.AccountingShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Accounting Dashboard | ArtSpace',
        loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'payroll',
        title: 'Staff Payroll | ArtSpace',
        loadComponent: () => import('./payroll/payroll').then((m) => m.Payroll),
      },
      {
        path: 'payouts',
        title: 'Seller Payouts | ArtSpace',
        loadComponent: () => import('./seller-payouts/seller-payouts').then((m) => m.SellerPayouts),
      },
      {
        path: 'budget',
        title: 'Department Budget | ArtSpace',
        loadComponent: () =>
          import('./department-budget/department-budget').then((m) => m.DepartmentBudget),
      },
      { path: '**', redirectTo: '' },
    ],
  },
];
