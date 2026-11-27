import { TestBed } from '@angular/core/testing';
import { LOGROCKET_APP_ID, LOGROCKET_LOADER, MarketplaceMonitoring, MONITORING_PRIVACY } from './marketplace-monitoring';
import { StorageService } from './storage.service';

describe('Marketplace monitoring privacy', () => {
  let consent: string;
  let sdk: { init: jasmine.Spy; track: jasmine.Spy };
  let loader: jasmine.Spy;
  beforeEach(() => {
    consent = 'accepted';
    sdk = { init: jasmine.createSpy('init'), track: jasmine.createSpy('track') };
    loader = jasmine.createSpy('loader').and.callFake(async () => sdk);
    TestBed.configureTestingModule({ providers: [
      { provide: LOGROCKET_APP_ID, useValue: 'team/queens-art' },
      { provide: LOGROCKET_LOADER, useValue: loader },
      { provide: StorageService, useValue: { getCookie: () => consent } },
    ] });
  });
  it('does not download or initialize the SDK without consent', async () => {
    consent = 'declined';
    await TestBed.inject(MarketplaceMonitoring).initialize();
    expect(loader).not.toHaveBeenCalled();
  });
  it('does not initialize without an actual project ID', async () => {
    TestBed.overrideProvider(LOGROCKET_APP_ID, { useValue: '' });
    await TestBed.inject(MarketplaceMonitoring).initialize();
    expect(loader).not.toHaveBeenCalled();
  });
  it('disables private capture and transmits only timing and outcome', async () => {
    const monitor = TestBed.inject(MarketplaceMonitoring);
    await monitor.initialize();
    const options = sdk.init.calls.mostRecent().args[1];
    expect(options.dom.isEnabled).toBeFalse();
    expect(options.network.isEnabled).toBeFalse();
    expect(options.console.isEnabled).toBeFalse();
    expect(options.shouldCaptureIP).toBeFalse();
    expect(options.shouldDetectExceptions).toBeFalse();
    monitor.measure('marketplace_checkout_ms', performance.now(), true);
    expect(sdk.track.calls.mostRecent().args[1]).toEqual({ duration_ms: jasmine.any(Number), success: true });
    consent = 'declined';
    expect(options.shouldSendData()).toBeFalse();
    monitor.measure('marketplace_checkout_ms', performance.now(), true);
    expect(sdk.track).toHaveBeenCalledTimes(1);
  });
  it('redacts account URLs, identifiers and search parameters', () => {
    const sanitize = MONITORING_PRIVACY.browser.urlSanitizer;
    expect(sanitize('https://example.test/profile?email=private')).toBe('https://example.test/redacted');
    expect(sanitize('https://example.test/gallery/private-id')).toBe('https://example.test/redacted');
    expect(sanitize('https://example.test/gallery?search=private')).toBe('https://example.test/gallery');
  });
  it('does not break the app if monitoring is unavailable', async () => {
    loader.and.rejectWith(new Error('offline'));
    await expectAsync(TestBed.inject(MarketplaceMonitoring).initialize()).toBeResolved();
  });
  it('retains only coarse timings while loading without blocking application work', async () => {
    let finish!: (value: typeof sdk) => void;
    loader.and.returnValue(new Promise(resolve => { finish = resolve; }));
    const monitor = TestBed.inject(MarketplaceMonitoring);
    const initialized = monitor.initialize();
    monitor.measure('marketplace_catalogue_ms', performance.now(), true);
    expect(sdk.track).not.toHaveBeenCalled();
    finish(sdk);
    await initialized;
    expect(sdk.track).toHaveBeenCalledOnceWith('marketplace_catalogue_ms', { duration_ms: jasmine.any(Number), success: true });
  });
  it('does not initialize or send buffered timings if consent is withdrawn during loading', async () => {
    let finish!: (value: typeof sdk) => void;
    loader.and.returnValue(new Promise(resolve => { finish = resolve; }));
    const monitor = TestBed.inject(MarketplaceMonitoring);
    const initialized = monitor.initialize();
    monitor.measure('marketplace_catalogue_ms', performance.now(), true);
    consent = 'declined';
    finish(sdk);
    await initialized;
    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.track).not.toHaveBeenCalled();
  });
});
