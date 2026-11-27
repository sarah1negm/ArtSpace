import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { provideHttpClient } from '@angular/common/http';
import { AuthService, USE_SHARED_LOGIN } from './core/services/auth.service';
import { USE_STUDENT_API } from './features/student/student-api.service';
import { routes } from './app.routes';
import { USE_MARKETPLACE_API } from './features/marketplace/marketplace-api.service';
import { MarketplaceMonitoring } from './core/services/marketplace-monitoring';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    { provide: USE_SHARED_LOGIN, useValue: true },
    { provide: USE_STUDENT_API, useValue: true },
    { provide: USE_MARKETPLACE_API, useValue: true },
    provideAppInitializer(() => inject(AuthService).restoreSession()),
    provideAppInitializer(() => { void inject(MarketplaceMonitoring).initialize(); }),
    provideRouter(routes)
  ]
};
