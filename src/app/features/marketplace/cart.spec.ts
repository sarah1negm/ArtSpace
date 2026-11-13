import { TestBed } from '@angular/core/testing';
import { CartService } from './cart';
import { ARTWORKS } from './artworks';

describe('CartService', () => {
  beforeEach(() => {
    localStorage.removeItem('artspace-cart');
    TestBed.configureTestingModule({});
  });
  afterEach(() => localStorage.removeItem('artspace-cart'));
  it('adds multiple copies and removes only the selected entry', () => {
    const service = TestBed.inject(CartService);
    service.addToCart(ARTWORKS[0]);
    service.addToCart(ARTWORKS[0]);
    service.addToCart(ARTWORKS[1]);
    expect(service.total()).toBe(440);
    service.removeFromCart(1);
    expect(service.items()).toEqual([ARTWORKS[0], ARTWORKS[1]]);
    expect(service.total()).toBe(320);
    expect(JSON.parse(localStorage.getItem('artspace-cart')!)).toEqual(service.items());
  });
  it('restores saved items using trusted catalogue prices', () => {
    localStorage.setItem('artspace-cart', JSON.stringify([{ id: 1, price: 0 }, { id: 999 }, null]));
    const service = TestBed.inject(CartService);
    expect(service.items()).toEqual([ARTWORKS[0]]);
    expect(service.total()).toBe(120);
  });
  it('handles malformed storage', () => {
    localStorage.setItem('artspace-cart', '{broken');
    expect(TestBed.inject(CartService).items()).toEqual([]);
  });
  it('handles a stored value that is not an array', () => {
    localStorage.setItem('artspace-cart', '{}');
    expect(TestBed.inject(CartService).total()).toBe(0);
  });
  it('keeps working when storage access fails', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('blocked');
    spyOn(Storage.prototype, 'setItem').and.throwError('blocked');
    const service = TestBed.inject(CartService);
    service.addToCart(ARTWORKS[1]);
    expect(service.total()).toBe(200);
    service.removeFromCart(0);
    expect(service.total()).toBe(0);
  });
});
