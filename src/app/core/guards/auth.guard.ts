import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { StorageService } from '../services/storage.service';
import { Role } from '../models/user.model';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isLoggedIn()) return true;
  inject(StorageService).setSessionString('artspace_return', state.url);
  return inject(Router).createUrlTree(['/login']);
};

export const roleGuard = (...allowed: Role[]): CanActivateFn => () => {
  const auth = inject(AuthService);
  const role = auth.role();
  return role && allowed.includes(role) ? true : inject(Router).createUrlTree(['/']);
};