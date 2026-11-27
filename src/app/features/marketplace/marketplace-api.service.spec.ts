import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MarketplaceApi, CartData, checkoutRequestId } from './marketplace-api.service';
import { AuthService } from '../../core/services/auth.service';
import { ARTWORKS } from './artworks';

describe('Laravel Marketplace cart', () => {
  let api: MarketplaceApi;
  let http: HttpTestingController;
  const empty: CartData = { lines: [], total: 0, unavailableIds: [] };
  const full: CartData = { lines: [{ artwork: { ...ARTWORKS[0], id: 'artwork-uuid' }, quantity: 1 }], total: 120, unavailableIds: [] };
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(MarketplaceApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  async function load(data = empty) {
    http.expectOne('/api/cart').flush(data);
    await Promise.resolve();
  }
  it('restores the cart and its authoritative total from the server', async () => {
    await load(full);
    expect(api.ready()).toBeTrue();
    expect(api.items().length).toBe(1);
    expect(api.data().total).toBe(120);
  });
  it('blocks writes after a failed read until a successful retry', async () => {
    http.expectOne('/api/cart').flush({}, { status: 503, statusText: 'Unavailable' });
    await Promise.resolve();
    expect(api.readError()).toContain('could not be loaded');
    expect(await api.add('id')).toBeFalse();
    http.expectNone('/api/cart/items');
    const retry = api.load();
    http.expectOne('/api/cart').flush(full);
    await retry;
    expect(api.readError()).toBe('');
    expect(api.items().length).toBe(1);
  });
  it('waits for a successful server write before changing state', async () => {
    await load();
    const add = api.add('artwork-uuid');
    const request = http.expectOne('/api/cart/items');
    expect(request.request.body).toEqual({ artworkId: 'artwork-uuid' });
    expect(api.items()).toEqual([]);
    expect(api.busy()).toBeTrue();
    request.flush(full);
    expect(await add).toBeTrue();
    expect(api.items().length).toBe(1);
  });
  it('preserves items after a failed remove and supports retry', async () => {
    await load(full);
    const remove = api.remove('artwork-uuid');
    http.expectOne('/api/cart/items/artwork-uuid').flush({}, { status: 500, statusText: 'Failed' });
    expect(await remove).toBeFalse();
    expect(api.items().length).toBe(1);
    expect(api.error()).not.toBe('');
    const retry = api.remove('artwork-uuid');
    http.expectOne('/api/cart/items/artwork-uuid').flush(empty);
    expect(await retry).toBeTrue();
    expect(api.items()).toEqual([]);
    expect(api.error()).toBe('');
  });
  it('preserves failed checkout and reuses its request ID for a safe retry', async () => {
    await load(full);
    const first = api.checkout();
    const request = http.expectOne('/api/cart/checkout');
    const key = request.request.body.requestId;
    request.flush({}, { status: 0, statusText: 'Network failure' });
    expect(await first).toBeNull();
    expect(api.items().length).toBe(1);
    const retry = api.checkout();
    const next = http.expectOne('/api/cart/checkout');
    expect(next.request.body.requestId).toBe(key);
    next.flush({ total: 120, quantity: 1, simulated: true, requestId: key, saleIds: ['1'] });
    expect((await retry)?.total).toBe(120);
    expect(api.items()).toEqual([]);
  });
  it('blocks checkout containing unavailable artworks', async () => {
    await load({ ...full, unavailableIds: ['sold-id'] });
    expect(await api.checkout()).toBeNull();
    http.expectNone('/api/cart/checkout');
  });
  it('recovers an uncertain checkout after reloading an empty cart and blocks intervening edits', async () => {
    await load(full);
    const checkout = api.checkout();
    const first = http.expectOne('/api/cart/checkout');
    const original = first.request.body;
    first.flush({}, { status: 0, statusText: 'Lost response' });
    expect(await checkout).toBeNull();
    expect(api.checkoutPending()).toBeTrue();
    expect(await api.remove('artwork-uuid')).toBeFalse();
    const reload = api.load();
    http.expectOne('/api/cart').flush(empty);
    await reload;
    const retry = api.checkout();
    const request = http.expectOne('/api/cart/checkout');
    expect(request.request.body).toEqual(original);
    request.flush({ total: 120, quantity: 1, cart: full });
    expect((await retry)?.total).toBe(120);
    expect(api.checkoutPending()).toBeFalse();
    expect(api.items().length).toBe(1); // A new cart from another tab is preserved.
  });
  it('explains unauthenticated checkout without changing the cart', async () => {
    await load(full);
    const result = api.checkout();
    http.expectOne('/api/cart/checkout').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(await result).toBeNull();
    expect(api.error()).toContain('sign in');
    expect(api.items().length).toBe(1);
  });
  it('creates retry UUIDs without depending on the secure-context randomUUID API', async () => {
    await load();
    expect(checkoutRequestId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(checkoutRequestId()).not.toBe(checkoutRequestId());
  });
  it('reloads the session cart after authentication changes and ignores old responses', async () => {
    await load(full);
    const remove = api.remove('artwork-uuid');
    const old = http.expectOne('/api/cart/items/artwork-uuid');
    TestBed.inject(AuthService).currentUser.set({ id: 'next-user', username: 'buyer', name: 'Buyer',
      email: 'buyer@example.test', picture: '', passwordHash: '', cardLast4: '', role: 'student',
      preferences: { theme: 'light', newsletter: false } });
    TestBed.tick();
    const reload = http.expectOne('/api/cart');
    reload.flush(empty);
    await Promise.resolve();
    old.flush(full);
    expect(await remove).toBeFalse();
    expect(api.items()).toEqual([]);
  });
});
