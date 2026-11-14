import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MARKETPLACE_ROUTES } from '../marketplace.routes';
import { CartService } from '../cart';

describe('Marketplace routes and artwork details', () => {
  beforeEach(() => {
    localStorage.removeItem('artspace-cart');
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'gallery', children: MARKETPLACE_ROUTES }])],
    });
  });
  afterEach(() => localStorage.removeItem('artspace-cart'));
  it('loads details, adds to cart, and updates when the id changes', async () => {
    const harness = await RouterTestingHarness.create('/gallery/1');
    expect(harness.routeNativeElement?.textContent).toContain('Sunset Dreams');
    expect(harness.routeNativeElement?.textContent).toContain('EGP');
    expect(harness.routeNativeElement?.textContent).toContain('Painting');
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('button')!.click();
    expect(TestBed.inject(CartService).total()).toBe(120);
    await harness.navigateByUrl('/gallery/2');
    expect(harness.routeNativeElement?.textContent).toContain('Ocean Waves');
    await harness.navigateByUrl('/gallery/cart');
    expect(harness.routeNativeElement?.textContent).toContain('Your Shopping Cart');
  });
  it('handles unknown artwork ids', async () => {
    const harness = await RouterTestingHarness.create('/gallery/999');
    expect(harness.routeNativeElement?.textContent).toContain('Artwork not found');
    expect(harness.routeNativeElement?.querySelector('button')).toBeNull();
  });
});
