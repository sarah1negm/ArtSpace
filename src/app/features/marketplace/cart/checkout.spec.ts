import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Cart } from './cart';
import { CartService } from '../cart';
import { ARTWORKS } from '../artworks';

describe('Cart quantities and simulated checkout', () => {
  beforeEach(() => {
    localStorage.removeItem('artspace-cart');
    TestBed.configureTestingModule({ imports: [Cart], providers: [provideRouter([])] });
  });
  afterEach(() => localStorage.removeItem('artspace-cart'));
  it('groups additions and updates quantity, subtotal and persistence through the UI', async () => {
    const cart = TestBed.inject(CartService);
    cart.addToCart(ARTWORKS[0]);
    cart.addToCart(ARTWORKS[0]);
    const fixture = TestBed.createComponent(Cart);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('li').length).toBe(1);
    expect(element.textContent).toContain('Quantity: 2');
    element
      .querySelector<HTMLButtonElement>('[aria-label="Increase quantity of Sunset Dreams"]')!
      .click();
    await fixture.whenStable();
    expect(cart.total()).toBe(360);
    expect(element.textContent?.replace(/\s/g, '')).toContain('Subtotal:EGP360.00');
    expect(JSON.parse(localStorage.getItem('artspace-cart')!).length).toBe(3);
    element
      .querySelector<HTMLButtonElement>('[aria-label="Decrease quantity of Sunset Dreams"]')!
      .click();
    await fixture.whenStable();
    expect(cart.total()).toBe(240);
    element.querySelector<HTMLButtonElement>('.remove')!.click();
    await fixture.whenStable();
    expect(cart.items()).toEqual([]);
    expect(element.textContent).toContain('Your cart is empty');
  });
  it('requires confirmation, allows cancel, then clears the persisted cart and displays a demo receipt', async () => {
    const cart = TestBed.inject(CartService);
    cart.addToCart(ARTWORKS[1]);
    const fixture = TestBed.createComponent(Cart);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const click = (text: string) =>
      [...element.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.textContent?.trim() === text)!
        .click();
    click('Simulated checkout');
    await fixture.whenStable();
    expect(cart.total()).toBe(200);
    click('Cancel');
    await fixture.whenStable();
    expect(cart.items().length).toBe(1);
    click('Simulated checkout');
    await fixture.whenStable();
    click('Confirm demo order');
    await fixture.whenStable();
    expect(cart.total()).toBe(0);
    expect(localStorage.getItem('artspace-cart')).toBe('[]');
    expect(element.textContent).toContain('Demo checkout complete');
    expect(element.textContent).toContain('No payment was taken');
    expect(fixture.componentInstance.receipt()).toEqual({ total: 200, quantity: 1 });
  });
  it('rejects invalid quantities and caps repeated additions', () => {
    const cart = TestBed.inject(CartService);
    cart.addToCart(ARTWORKS[0]);
    for (const quantity of [0, -1, 1.5, NaN, Infinity, 100]) cart.setQuantity(1, quantity);
    expect(cart.items().length).toBe(1);
    cart.setQuantity(1, 99);
    cart.addToCart(ARTWORKS[0]);
    expect(cart.items().length).toBe(99);
    expect(cart.lines()[0].quantity).toBe(99);
    cart.setQuantity(1, 1);
    expect(cart.total()).toBe(120);
  });
  it('restores saved quantities in a fresh service instance', () => {
    const cart = TestBed.inject(CartService);
    cart.addToCart(ARTWORKS[0]);
    cart.setQuantity(1, 3);
    TestBed.resetTestingModule();
    const restored = TestBed.inject(CartService);
    expect(restored.lines()).toEqual([{ artwork: ARTWORKS[0], quantity: 3 }]);
    expect(restored.total()).toBe(360);
  });
});
