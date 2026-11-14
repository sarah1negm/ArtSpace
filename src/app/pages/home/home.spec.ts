import { ComponentFixture, DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Home } from './home';

describe('Home', () => {
  let fixture: ComponentFixture<Home>;

  beforeEach(async () => {
    localStorage.clear(); sessionStorage.clear();
    await TestBed.configureTestingModule({
      deferBlockBehavior: DeferBlockBehavior.Manual,
      imports: [Home],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows Login and Sign up buttons when logged out', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Login');
    expect(text).toContain('Sign up');
  });

  it('loads all four featured artwork images from local assets when the deferred section renders', async () => {
    const blocks = await fixture.getDeferBlocks();
    await blocks[0].render(DeferBlockState.Complete);
    await fixture.whenStable();
    const images = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLImageElement>('.previews img');
    expect(images.length).toBe(4);
    for (const [index, image] of Array.from(images).entries()) {
      const artwork = fixture.componentInstance.artworks[index];
      expect(image.alt).toBe(artwork.title);
      expect(image.getAttribute('src')).toBe(artwork.image);
      expect(new URL(image.src).origin).toBe(location.origin);
      expect(artwork.image).toMatch(/^artworks\/featured\/.+\.svg$/);
      image.loading = 'eager';
      await image.decode();
      expect(image.complete).toBeTrue();
      expect(image.naturalWidth).toBe(800);
      expect(image.naturalHeight).toBe(600);
      const bounds = image.getBoundingClientRect();
      expect(bounds.width).toBeGreaterThan(0);
      expect(bounds.height).toBeCloseTo(bounds.width * .75, 0);
    }
  });
});
