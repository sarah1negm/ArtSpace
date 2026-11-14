import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Gallery } from './gallery/gallery';
import { ARTWORKS } from './artworks';
import { MARKETPLACE_ROUTES } from './marketplace.routes';

describe('Local marketplace artwork images', () => {
  beforeEach(() => {
    localStorage.removeItem('artspace-cart');
    TestBed.configureTestingModule({
      imports: [Gallery],
      providers: [provideRouter([{ path: 'gallery', children: MARKETPLACE_ROUTES }])],
    });
  });
  afterEach(() => localStorage.removeItem('artspace-cart'));

  async function verifyImage(image: HTMLImageElement, expected: string): Promise<void> {
    expect(image.getAttribute('src')).toBe(expected);
    expect(new URL(image.src).origin).toBe(location.origin);
    // Lazy images must be made eager in the test because the fixture can be offscreen.
    image.loading = 'eager';
    await image.decode();
    expect(image.complete).toBeTrue();
    expect(image.naturalWidth).toBe(800);
    expect(image.naturalHeight).toBe(600);
    const bounds = image.getBoundingClientRect();
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
    expect(getComputedStyle(image).visibility).toBe('visible');
    expect(getComputedStyle(image).display).not.toBe('none');
  }

  it('loads and decodes all three local images in Gallery', async () => {
    const fixture = TestBed.createComponent(Gallery);
    await fixture.whenStable();
    const images = fixture.nativeElement.querySelectorAll('img') as NodeListOf<HTMLImageElement>;
    expect(images.length).toBe(3);
    for (const image of images) {
      const artwork = ARTWORKS.find((item) => item.title === image.alt)!;
      await verifyImage(image, artwork.image);
    }
    fixture.destroy();
  });

  it('loads and decodes the matching local image on every Artwork Details route', async () => {
    const harness = await RouterTestingHarness.create();
    for (const artwork of ARTWORKS) {
      await harness.navigateByUrl(`/gallery/${artwork.id}`);
      const image = harness.routeNativeElement!.querySelector('img')!;
      expect(image.alt).toBe(artwork.title);
      await verifyImage(image, artwork.image);
    }
  });
});
