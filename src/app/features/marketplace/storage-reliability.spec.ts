import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CartService } from './cart';
import { ARTWORKS } from './artworks';
import { AddToCart } from './shared/add-to-cart';
import { Cart } from './cart/cart';

describe('Cart atomic persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({ imports: [Cart, AddToCart], providers: [provideRouter([])] });
  });
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  for (const name of ['QuotaExceededError', 'SecurityError']) {
    it(`does not change items, totals or saved JSON on failed cart actions (${name})`, () => {
      const cart = TestBed.inject(CartService);
      cart.addToCart(ARTWORKS[0]);
      cart.setQuantity(1, 2);
      const previous = localStorage.getItem('artspace-cart');
      const write = spyOn(Storage.prototype, 'setItem').and.callFake(() => {
        throw new DOMException('blocked', name);
      });
      expect(cart.addToCart(ARTWORKS[1])).toBeFalse();
      expect(cart.setQuantity(1, 3)).toBeFalse();
      expect(cart.removeArtwork(1)).toBeFalse();
      expect(cart.removeFromCart(0)).toBeFalse();
      expect(cart.clear()).toBeFalse();
      expect(cart.items()).toEqual([ARTWORKS[0], ARTWORKS[0]]);
      expect(cart.total()).toBe(240);
      expect(localStorage.getItem('artspace-cart')).toBe(previous);
      write.and.callThrough();
      expect(cart.setQuantity(1, 3)).toBeTrue();
      expect(cart.total()).toBe(360);
      expect(cart.storageError()).toBe('');
      TestBed.resetTestingModule();
      expect(TestBed.inject(CartService).total()).toBe(360);
    });
  }
  it('shows an add error instead of animation/success and allows a retry', async () => {
    const fixture = TestBed.createComponent(AddToCart);
    fixture.componentRef.setInput('artwork', ARTWORKS[0]);
    await fixture.whenStable();
    const write = spyOn(Storage.prototype, 'setItem').and.throwError('blocked');
    const page: HTMLElement = fixture.nativeElement;
    page.querySelector('button')!.click();
    await fixture.whenStable();
    expect(page.querySelector('[role=alert]')?.textContent).toContain('could not be saved');
    expect(page.querySelector('button')!.classList.contains('added')).toBeFalse();
    expect(page.textContent).not.toContain('Added to Cart');
    write.and.callThrough();
    page.querySelector('button')!.click();
    await fixture.whenStable();
    expect(page.querySelector('[role=alert]')).toBeNull();
    expect(page.querySelector('button')!.classList.contains('added')).toBeTrue();
    fixture.destroy();
  });
  it('does not announce checkout or clear the receipt/cart if its saved empty cart fails', async () => {
    const cart = TestBed.inject(CartService);
    cart.addToCart(ARTWORKS[1]);
    const previous = localStorage.getItem('artspace-cart');
    const fixture = TestBed.createComponent(Cart);
    await fixture.whenStable();
    const page: HTMLElement = fixture.nativeElement;
    const click = async (text: string) => {
      [...page.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!.click();
      await fixture.whenStable();
    };
    await click('Simulated checkout');
    const write = spyOn(Storage.prototype, 'setItem').and.throwError('quota');
    await click('Confirm demo order');
    expect(page.textContent).not.toContain('Demo checkout complete');
    expect(page.querySelector('[role=alert]')?.textContent).toContain('could not be saved');
    expect(cart.total()).toBe(200);
    expect(fixture.componentInstance.receipt()).toBeNull();
    expect(fixture.componentInstance.confirming()).toBeTrue();
    expect(localStorage.getItem('artspace-cart')).toBe(previous);
    write.and.callThrough();
    await click('Confirm demo order');
    expect(page.textContent).toContain('Demo checkout complete');
    expect(cart.total()).toBe(0);
    expect(localStorage.getItem('artspace-cart')).toBe('[]');
    fixture.destroy();
  });
});
