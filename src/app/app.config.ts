import { ApplicationConfig, inject, isDevMode, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { provideHttpClient } from '@angular/common/http';
import { AuthService, LOCAL_STUDENT_LOGIN } from './core/services/auth.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    { provide: LOCAL_STUDENT_LOGIN, useFactory: isDevMode },
    provideAppInitializer(() => inject(AuthService).restoreServerStudent()),
    provideRouter(routes)
  ]
};
