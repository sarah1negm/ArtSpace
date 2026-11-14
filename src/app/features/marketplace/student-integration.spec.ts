import { TestBed, DeferBlockBehavior, DeferBlockState } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { AuthService } from '../../core/services/auth.service';
import { StudentService } from '../student/student.service';
import { ArtworkDraft } from '../student/student.models';
import { ArtworkCatalog } from './artwork-catalog';
import { CartService } from './cart';
import { Gallery } from './gallery/gallery';
import { Home } from '../../pages/home/home';

describe('Student listings across the Marketplace', () => {
  const draft: ArtworkDraft = {
    title: 'Integration Sunrise',
    description: 'Student landscape',
    category: 'Painting',
    price: 450.25,
    imageUrl: 'https://example.com/sunrise.png',
  };
  let auth: AuthService;
  let students: StudentService;
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
      deferBlockBehavior: DeferBlockBehavior.Manual,
    });
    auth = TestBed.inject(AuthService);
    await auth.seedDemoUsers();
    expect((await auth.login('student1', 'Pass1234', false)).ok).toBeTrue();
    students = TestBed.inject(StudentService);
  });
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('creates through the portal, searches and filters, opens details, changes quantity and checks out', async () => {
    const harness = await RouterTestingHarness.create('/student/artwork');
    const page = harness.routeNativeElement!;
    for (const [name, value] of Object.entries(draft)) {
      const input = page.querySelector<HTMLInputElement>(`[formControlName="${name}"]`)!;
      input.value = String(value);
      input.dispatchEvent(new Event(name === 'category' ? 'change' : 'input'));
    }
    page
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    harness.detectChanges();
    expect(page.textContent).toContain('Listing added.');
    const id = students.artworks()[0].id;
    expect(
      JSON.parse(localStorage.getItem(`artspace_student_v1_${auth.currentUser()!.id}`)!).artworks[0]
        .id,
    ).toBe(id);
    auth.logout();
    const gallery = await harness.navigateByUrl('/gallery', Gallery);
    gallery.search.set('INTEGRATION sunrise');
    gallery.setCategory('Painting');
    gallery.setPrice('min', '450');
    gallery.setPrice('max', '451');
    gallery.setSort('price-desc');
    harness.detectChanges();
    expect(gallery.filteredArtworks().map((a) => a.id)).toEqual([id]);
    expect(harness.routeNativeElement!.querySelector('.artwork-link')!.getAttribute('href')).toBe(
      `/gallery/${id}`,
    );
    await harness.navigateByUrl(`/gallery/${id}`);
    expect(harness.routeNativeElement!.textContent).toContain(draft.title);
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('app-add-to-cart button')!.click();
    await harness.navigateByUrl('/gallery/cart');
    const cartPage = harness.routeNativeElement!;
    cartPage.querySelector<HTMLButtonElement>('[aria-label^="Increase quantity"]')!.click();
    harness.detectChanges();
    expect(TestBed.inject(CartService).total()).toBe(900.5);
    cartPage.querySelector<HTMLButtonElement>('[aria-label^="Decrease quantity"]')!.click();
    harness.detectChanges();
    expect(TestBed.inject(CartService).total()).toBe(450.25);
    const click = (text: string) =>
      Array.from(cartPage.querySelectorAll('button'))
        .find((b) => b.textContent?.trim() === text)!
        .click();
    click('Simulated checkout');
    harness.detectChanges();
    click('Confirm demo order');
    harness.detectChanges();
    expect(cartPage.textContent).toContain('Demo checkout complete');
    expect(cartPage.textContent).toContain('450.25');
    expect(TestBed.inject(CartService).items()).toEqual([]);
    expect(JSON.parse(localStorage.getItem('artspace-cart')!)).toEqual([]);
  });

  it('updates Gallery, Details and cart prices on edit and removes deleted cart entries', async () => {
    students.saveArtwork(draft);
    const id = students.artworks()[0].id;
    const catalog = TestBed.inject(ArtworkCatalog);
    const cart = TestBed.inject(CartService);
    cart.addToCart(catalog.artworks().find((a) => a.id === id)!);
    cart.addToCart(catalog.artworks()[catalog.artworks().length - 1]);
    cart.setQuantity(id, 3);
    const harness = await RouterTestingHarness.create(`/gallery/${id}`);
    students.saveArtwork({ ...draft, title: 'Edited Sunrise', price: 500 }, id);
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Edited Sunrise');
    expect(cart.total()).toBe(1650);
    const gallery = await harness.navigateByUrl('/gallery', Gallery);
    gallery.search.set('Edited Sunrise');
    expect(gallery.filteredArtworks().length).toBe(1);
    expect(catalog.artworks().filter((a) => a.id === id).length).toBe(1);
    students.removeArtwork(id);
    expect(gallery.filteredArtworks()).toEqual([]);
    expect(cart.items().map((a) => a.id)).toEqual([3]);
    cart.removeFromCart(0);
    expect(cart.items()).toEqual([]);
    await harness.navigateByUrl(`/gallery/${id}`);
    expect(harness.routeNativeElement!.textContent).toContain('Artwork not found');
  });

  it('restores student cart IDs using current prices and drops deleted listings on reload', () => {
    students.saveArtwork(draft);
    const id = students.artworks()[0].id;
    localStorage.setItem('artspace-cart', JSON.stringify([{ id, price: 0 }, { id: 'deleted' }]));
    const cart = TestBed.inject(CartService);
    expect(cart.total()).toBe(450.25);
    cart.setQuantity(id, 99);
    cart.addToCart(
      TestBed.inject(ArtworkCatalog)
        .artworks()
        .find((a) => a.id === id)!,
    );
    expect(cart.items().length).toBe(99);
    for (const quantity of [0, -1, 100, 1.5, NaN]) cart.setQuantity(id, quantity);
    expect(cart.items().length).toBe(99);
  });

  it('shares listings between local accounts and links them from Home and Profile', async () => {
    students.saveArtwork(draft);
    const id = students.artworks()[0].id;
    const harness = await RouterTestingHarness.create('/profile');
    expect(
      harness.routeNativeElement!.querySelector(`a[href="/gallery/${id}"]`)?.textContent,
    ).toContain(draft.title);
    const home = TestBed.createComponent(Home);
    home.detectChanges();
    const blocks = await home.getDeferBlocks();
    await blocks[0].render(DeferBlockState.Complete);
    home.detectChanges();
    expect(home.nativeElement.querySelector(`a[href="/gallery/${id}"]`)?.textContent).toContain(
      draft.title,
    );
    await auth.login('accountant1', 'Pass1234', false);
    expect(students.artworks()).toEqual([]);
    expect(
      TestBed.inject(ArtworkCatalog)
        .artworks()
        .some((a) => a.id === id),
    ).toBeTrue();
    home.destroy();
  });
});
