import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Cart } from './cart';
import { CartService } from '../cart';
import { ARTWORKS } from '../artworks';

describe('Cart page', () => {
  beforeEach(() => {
    localStorage.removeItem('artspace-cart');
    TestBed.configureTestingModule({ imports: [Cart], providers: [provideRouter([])] });
  });
  afterEach(() => localStorage.removeItem('artspace-cart'));
  it('shows an empty state', async () => {
    const fixture = TestBed.createComponent(Cart);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Your cart is empty');
  });
  it('shows the total and removes items through the UI', async () => {
    const service = TestBed.inject(CartService);
    service.addToCart(ARTWORKS[0]);
    service.addToCart(ARTWORKS[1]);
    const fixture = TestBed.createComponent(Cart);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Total: EGP320.00');
    element.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
    expect(element.querySelectorAll('li').length).toBe(1);
    expect(element.textContent).toContain('Total: EGP200.00');
    element.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
    expect(element.textContent).toContain('Your cart is empty');
  });
});
