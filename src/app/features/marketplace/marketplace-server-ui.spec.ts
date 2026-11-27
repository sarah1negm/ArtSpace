import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { Cart } from './cart/cart';
import { AddToCart } from './shared/add-to-cart';
import { ListingsService } from './listings.service';
import { StudentService } from '../student/student.service';
import { USE_MARKETPLACE_API } from './marketplace-api.service';
import { ARTWORKS } from './artworks';

describe('Marketplace server-backed UI', () => {
  let http: HttpTestingController;
  const artwork = { ...ARTWORKS[0], id: 'student-artwork-id' };
  const full = { lines: [{ artwork, quantity: 1 }], total: 120, unavailableIds: [] };
  const students = {
    listingsReady: signal(true), listingsError: signal(''), publicListings: signal([
      { ...artwork, imageUrl: artwork.image },
    ]), retryLoad: jasmine.createSpy('retryLoad'),
  };
  beforeEach(() => {
    students.retryLoad.calls.reset();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: USE_MARKETPLACE_API, useValue: true }, { provide: StudentService, useValue: students },
    ] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('excludes browser-only mock artworks in the API catalogue', () => {
    const listings = TestBed.inject(ListingsService);
    expect(listings.all().map(item => item.id)).toEqual(['student-artwork-id']);
    expect(listings.all()[0].description).toBe(artwork.description);
    expect(listings.all()[0].image).toBe(artwork.image);
  });
  it('shows loading, a failed read and a working retry instead of a false empty cart', async () => {
    const fixture = TestBed.createComponent(Cart);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading your server cart');
    expect(fixture.nativeElement.textContent).not.toContain('Your cart is empty');
    http.expectOne('/api/cart').flush({}, { status: 503, statusText: 'Unavailable' });
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('could not be loaded');
    const retry = Array.from(element.querySelectorAll('button')).find(button => button.textContent?.includes('Retry'));
    expect(retry).toBeDefined();
    retry!.click();
    http.expectOne('/api/cart').flush(full);
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.textContent).not.toContain('could not be loaded');
    expect(element.querySelector('button[aria-label^=Increase]')?.hasAttribute('disabled')).toBeTrue();
    expect(element.textContent).toContain('one of each');
  });
  it('suppresses add animation on server failure and supports a successful retry', async () => {
    const fixture = TestBed.createComponent(AddToCart);
    fixture.componentRef.setInput('artwork', artwork);
    http.expectOne('/api/cart').flush({ lines: [], total: 0, unavailableIds: [] });
    await fixture.whenStable();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    button.click();
    http.expectOne('/api/cart/items').flush({ message: 'Artwork sold.' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    expect(button.classList.contains('added')).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Artwork sold.');
    button.click();
    http.expectOne('/api/cart/items').flush(full);
    await fixture.whenStable();
    expect(button.classList.contains('added')).toBeTrue();
    expect(button.disabled).toBeTrue();
    fixture.destroy();
  });
  it('displays a receipt only after confirmed server checkout and refreshes student sales', async () => {
    const fixture = TestBed.createComponent(Cart);
    http.expectOne('/api/cart').flush(full);
    await fixture.whenStable();
    fixture.componentInstance.checkout();
    expect(fixture.componentInstance.receipt()).toBeNull();
    http.expectOne('/api/cart/checkout').flush({}, { status: 500, statusText: 'Failed' });
    await fixture.whenStable();
    expect(fixture.componentInstance.receipt()).toBeNull();
    expect(students.retryLoad).not.toHaveBeenCalled();
    fixture.componentInstance.checkout();
    http.expectOne('/api/cart/checkout').flush({ total: 120, quantity: 1, simulated: true });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Demo checkout complete');
    expect(students.retryLoad).toHaveBeenCalledTimes(1);
  });
  it('distinguishes a cart of unavailable listings from a genuinely empty cart', async () => {
    const fixture = TestBed.createComponent(Cart);
    http.expectOne('/api/cart').flush({ lines: [], total: 0, unavailableIds: ['sold-id'] });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No purchasable artworks remain');
    expect(fixture.nativeElement.textContent).not.toContain('Your cart is empty');
    expect(fixture.nativeElement.textContent).toContain('Remove unavailable artwork');
  });
});
