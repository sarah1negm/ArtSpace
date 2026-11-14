import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Gallery } from './gallery/gallery';
import { Cart } from './cart/cart';
import { CartService } from './cart';
import { ARTWORKS } from './artworks';
import { RouterTestingHarness } from '@angular/router/testing';
import { MARKETPLACE_ROUTES } from './marketplace.routes';

// Render component markup and its actual scoped CSS in narrow iframe viewports.
// This checks media queries, rather than resizing only the component host.
describe('Marketplace layouts below 600px', () => {
  beforeEach(() => {
    localStorage.removeItem('artspace-cart');
    TestBed.configureTestingModule({
      imports: [Gallery, Cart],
      providers: [provideRouter([{ path: 'gallery', children: MARKETPLACE_ROUTES }])],
    });
  });
  afterEach(() => {
    document.querySelectorAll('iframe[data-marketplace-test]').forEach((frame) => frame.remove());
    localStorage.removeItem('artspace-cart');
  });
  function renderAt(host: HTMLElement, width: number): Document {
    const frame = document.createElement('iframe');
    frame.dataset['marketplaceTest'] = '';
    frame.style.cssText = `width:${width}px;height:900px;border:0;position:absolute;left:0;top:0;`;
    document.body.append(frame);
    const doc = frame.contentDocument!;
    const base = doc.createElement('style');
    base.textContent = 'body { margin:0; font-family:system-ui,sans-serif; --card:#fff; }';
    doc.head.append(base);
    document.head
      .querySelectorAll('style')
      .forEach((style) => doc.head.append(style.cloneNode(true)));
    doc.body.append(host.cloneNode(true));
    return doc;
  }
  it('stacks gallery cards and filters without horizontal overflow', async () => {
    const fixture = TestBed.createComponent(Gallery);
    await fixture.whenStable();
    for (const width of [320, 375, 599]) {
      const doc = renderAt(fixture.nativeElement, width);
      const cards = doc.querySelectorAll<HTMLElement>('.artwork-card');
      expect(doc.documentElement.scrollWidth)
        .withContext(`gallery at ${width}px`)
        .toBeLessThanOrEqual(width);
      expect(cards[1].getBoundingClientRect().top).toBeGreaterThan(
        cards[0].getBoundingClientRect().top,
      );
      const filters = doc.querySelector<HTMLElement>('.filters')!;
      for (const image of doc.querySelectorAll('img')) {
        expect(image.getBoundingClientRect().width).toBeLessThanOrEqual(width);
        expect(image.getBoundingClientRect().height).toBeGreaterThan(0);
      }
      expect(doc.defaultView!.getComputedStyle(filters).gridTemplateColumns.split(' ').length)
        .withContext(`filter columns at ${width}px`)
        .toBe(1);
    }
    fixture.destroy();
  });
  it('keeps cart quantity and removal controls within mobile viewport', async () => {
    TestBed.inject(CartService).addToCart(ARTWORKS[0]);
    const fixture = TestBed.createComponent(Cart);
    await fixture.whenStable();
    for (const width of [320, 375, 599]) {
      const doc = renderAt(fixture.nativeElement, width);
      expect(doc.documentElement.scrollWidth)
        .withContext(`cart at ${width}px`)
        .toBeLessThanOrEqual(width);
      for (const button of doc.querySelectorAll('button')) {
        expect(button.getBoundingClientRect().right).toBeLessThanOrEqual(width);
      }
    }
    fixture.destroy();
  });
  it('keeps every artwork details image within mobile viewports', async () => {
    const harness = await RouterTestingHarness.create();
    for (const artwork of ARTWORKS) {
      await harness.navigateByUrl(`/gallery/${artwork.id}`);
      for (const width of [320, 375, 599]) {
        const doc = renderAt(harness.routeNativeElement!, width);
        const image = doc.querySelector('img')!;
        const bounds = image.getBoundingClientRect();
        expect(bounds.width).toBeGreaterThan(0);
        expect(bounds.right).toBeLessThanOrEqual(width);
        expect(bounds.height).toBeCloseTo(bounds.width * 0.75, 0);
        expect(doc.documentElement.scrollWidth).toBeLessThanOrEqual(width);
      }
    }
  });
});
