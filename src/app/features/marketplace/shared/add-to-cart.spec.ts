import { TestBed } from '@angular/core/testing';
import { AddToCart } from './add-to-cart';
import { ARTWORKS } from '../artworks';
import { CartService } from '../cart';

describe('AddToCart feedback', () => {
  beforeEach(() => {
    localStorage.removeItem('artspace-cart');
    TestBed.configureTestingModule({ imports: [AddToCart] });
  });
  afterEach(() => localStorage.removeItem('artspace-cart'));
  it('shows animated feedback then resets, supporting repeat additions', async () => {
    const fixture = TestBed.createComponent(AddToCart);
    fixture.componentRef.setInput('artwork', ARTWORKS[0]);
    await fixture.whenStable();
    jasmine.clock().install();
    try {
      const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
      button.click();
      fixture.detectChanges();
      expect(button.classList.contains('added')).toBeTrue();
      expect(button.textContent).toContain('Added to Cart');
      jasmine.clock().tick(1400);
      fixture.detectChanges();
      expect(button.classList.contains('added')).toBeFalse();
      button.click();
      expect(TestBed.inject(CartService).items().length).toBe(2);
    } finally {
      fixture.destroy();
      jasmine.clock().uninstall();
    }
  });
});
