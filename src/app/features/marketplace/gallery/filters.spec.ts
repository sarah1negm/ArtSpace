import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Gallery } from './gallery';
import { ARTWORKS, Artwork } from '../artworks';
import { ArtworkCatalog } from '../artwork-catalog';

describe('Gallery search, filters and sorting', () => {
  beforeEach(() => {
    localStorage.removeItem('artspace-cart');
    TestBed.configureTestingModule({ imports: [Gallery], providers: [provideRouter([])] });
  });
  afterEach(() => localStorage.removeItem('artspace-cart'));
  it('combines name, category, both inclusive price bounds and popularity', async () => {
    const source = signal<readonly Artwork[]>([
      {
        ...ARTWORKS[0],
        id: 12,
        title: 'Ocean Study',
        category: 'Print',
        price: 150,
        popularity: 400,
      },
      {
        ...ARTWORKS[0],
        id: 13,
        title: 'Ocean Light',
        category: 'Print',
        price: 200,
        popularity: 20,
      },
      ...ARTWORKS,
    ]);
    TestBed.overrideProvider(ArtworkCatalog, { useValue: { artworks: source.asReadonly() } });
    const fixture = TestBed.createComponent(Gallery);
    const gallery = fixture.componentInstance;
    gallery.search.set(' OCEAN ');
    gallery.category.set('Print');
    gallery.minPrice.set(150);
    gallery.maxPrice.set(200);
    gallery.sort.set('popularity');
    expect(gallery.filteredArtworks().map((item) => item.id)).toEqual([12, 2, 13]);
    gallery.sort.set('price-asc');
    expect(gallery.filteredArtworks().map((item) => item.price)).toEqual([150, 200, 200]);
    gallery.sort.set('price-desc');
    expect(gallery.filteredArtworks().map((item) => item.price)).toEqual([200, 200, 150]);
    source.update((items) => items.filter((item) => item.id !== 12));
    expect(gallery.filteredArtworks().length).toBe(2);
    expect(source().map((item) => item.id)).toEqual([13, 1, 2, 3]);
    fixture.destroy();
  });
  it('sorts mock artworks by likes, independently of ids', () => {
    const fixture = TestBed.createComponent(Gallery);
    fixture.componentInstance.sort.set('popularity');
    expect(fixture.componentInstance.filteredArtworks().map((item) => item.id)).toEqual([2, 3, 1]);
    fixture.destroy();
  });
  it('wires form controls and resets no-result or invalid ranges', async () => {
    const fixture = TestBed.createComponent(Gallery);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const search = element.querySelector<HTMLInputElement>('input[type=search]')!;
    search.value = 'sunset';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(element.querySelectorAll('.artwork-card').length).toBe(1);
    expect(element.textContent).toContain(ARTWORKS[0].description);
    expect(element.querySelector('.category')?.textContent).toContain('Painting');
    expect(element.textContent).toContain('EGP');
    const category = element.querySelector<HTMLSelectElement>('select')!;
    category.value = 'Print';
    category.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(element.textContent).toContain('No artworks match');
    const prices = element.querySelectorAll<HTMLInputElement>('input[type=number]');
    prices[0].value = '300';
    prices[0].dispatchEvent(new Event('input'));
    prices[1].value = '100';
    prices[1].dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(element.querySelector('[role=alert]')?.textContent).toContain('Minimum price');
    element.querySelector<HTMLButtonElement>('.filters button')!.click();
    await fixture.whenStable();
    expect(element.querySelectorAll('.artwork-card').length).toBe(ARTWORKS.length);
    expect(search.value).toBe('');
    expect(prices[0].value).toBe('');
    expect(prices[1].value).toBe('');
    fixture.destroy();
  });
  it('treats empty or invalid price inputs as unset and supports zero', () => {
    const fixture = TestBed.createComponent(Gallery);
    const gallery = fixture.componentInstance;
    gallery.setPrice('min', '0');
    expect(gallery.minPrice()).toBe(0);
    gallery.setPrice('max', '');
    expect(gallery.maxPrice()).toBeNull();
    gallery.setPrice('min', '-1');
    expect(gallery.minPrice()).toBeNull();
    gallery.setPrice('max', 'abc');
    expect(gallery.maxPrice()).toBeNull();
    fixture.destroy();
  });
});
