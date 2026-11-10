import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home').then(m => m.Home) },
  { path: 'login', loadComponent: () => import('./pages/login/login').then(m => m.Login) },
  { path: 'signup', loadComponent: () => import('./pages/signup/signup').then(m => m.Signup) },
  { path: 'profile', canActivate: [authGuard],
    loadComponent: () => import('./pages/profile/profile').then(m => m.Profile) },
  { path: 'gallery',
    loadChildren: () => import('./features/marketplace/marketplace.routes').then(m => m.MARKETPLACE_ROUTES) },
  { path: 'student', canActivate: [authGuard, roleGuard('student')],
    loadChildren: () => import('./features/student/student.routes').then(m => m.STUDENT_ROUTES) },
  { path: 'accounting', canActivate: [authGuard, roleGuard('accountant', 'admin')],
    loadChildren: () => import('./features/accounting/accounting.routes').then(m => m.ACCOUNTING_ROUTES) },
  { path: '**', redirectTo: '' },
];