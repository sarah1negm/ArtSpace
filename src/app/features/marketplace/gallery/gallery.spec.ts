import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Gallery } from './gallery';
import { ARTWORKS } from '../artworks';
import { CartService } from '../cart';

describe('Gallery', () => {
  beforeEach(() => {
    localStorage.removeItem('artspace-cart');
    TestBed.configureTestingModule({ imports: [Gallery], providers: [provideRouter([])] });
  });
  afterEach(() => localStorage.removeItem('artspace-cart'));
  it('renders the catalogue and adds an artwork through its button', async () => {
    const fixture = TestBed.createComponent(Gallery);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('.artwork-card').length).toBe(ARTWORKS.length);
    expect(element.querySelector('.artwork-link')?.getAttribute('href')).toBe('/gallery/3');
    element.querySelector<HTMLButtonElement>('app-add-to-cart button')!.click();
    await fixture.whenStable();
    expect(TestBed.inject(CartService).items()).toEqual([ARTWORKS[2]]);
    expect(element.textContent).toContain('Cart (1)');
    fixture.destroy();
  });
});
