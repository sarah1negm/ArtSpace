import { Injectable, InjectionToken, inject } from '@angular/core';
import { StorageService } from './storage.service';

/** Public project ID, never a LogRocket personal/API token. Empty disables monitoring. */
export const LOGROCKET_APP_ID = new InjectionToken<string>('LogRocket public app ID', {
  providedIn: 'root', factory: () => '',
});
type MonitoringSdk = Pick<typeof import('logrocket'), 'init' | 'track'>;
export const LOGROCKET_LOADER = new InjectionToken<() => Promise<MonitoringSdk>>('LogRocket loader', {
  providedIn: 'root', factory: () => async () => (await import('logrocket')).default,
});

// Conservative defaults: no DOM, inputs, images, network bodies/headers, console,
// URLs with IDs or queries, or user identification are sent to the third party.
export const MONITORING_PRIVACY = {
  shouldCaptureIP: false,
  shouldDetectExceptions: false,
  dom: { isEnabled: false, inputSanitizer: true, textSanitizer: true, imageSanitizer: true },
  console: { isEnabled: false, shouldAggregateConsoleErrors: false },
  network: { isEnabled: false },
  browser: { urlSanitizer: (url: string): string => {
    try {
      const parsed = new URL(url);
      return parsed.origin + (/^\/gallery(?:\/cart)?\/?$/.test(parsed.pathname) ? parsed.pathname : '/redacted');
    } catch { return '/redacted'; }
  } },
};

export type MarketplaceMetric = 'marketplace_catalogue_ms' | 'marketplace_add_cart_ms' | 'marketplace_checkout_ms';

@Injectable({ providedIn: 'root' })
export class MarketplaceMonitoring {
  private readonly appId = inject(LOGROCKET_APP_ID);
  private readonly storage = inject(StorageService);
  private readonly loader = inject(LOGROCKET_LOADER);
  private sdk: MonitoringSdk | null = null;
  private initializing = false;
  private pending: { metric: MarketplaceMetric; duration_ms: number; success: boolean }[] = [];

  async initialize(): Promise<void> {
    if (!this.appId || this.storage.getCookie('artspace_consent') !== 'accepted') return;
    this.initializing = true;
    try {
      const sdk = await this.loader();
      // Consent can change while the SDK downloads.
      if (this.storage.getCookie('artspace_consent') !== 'accepted') return;
      sdk.init(this.appId, { ...MONITORING_PRIVACY,
        shouldSendData: () => this.storage.getCookie('artspace_consent') === 'accepted',
      });
      this.sdk = sdk;
      for (const { metric, duration_ms, success } of this.pending) {
        if (this.storage.getCookie('artspace_consent') === 'accepted') sdk.track(metric, { duration_ms, success });
      }
    } catch { /* Optional monitoring must never interrupt the application. */ }
    finally { this.initializing = false; this.pending = []; }
  }

  measure(metric: MarketplaceMetric, started: number, success: boolean): void {
    if (!this.appId || this.storage.getCookie('artspace_consent') !== 'accepted') return;
    const duration_ms = Math.max(0, Math.round(performance.now() - started));
    if (!Number.isFinite(duration_ms)) return;
    if (!this.sdk) {
      // Retain a bounded set of coarse timings while the optional lazy chunk loads.
      // Never delay application bootstrap or capture request/user content.
      if (this.initializing && this.pending.length < 30) this.pending.push({ metric, duration_ms, success });
      return;
    }
    try {
      this.sdk.track(metric, { duration_ms, success });
    } catch { /* An unavailable analytics service must not fail a purchase. */ }
  }
}
