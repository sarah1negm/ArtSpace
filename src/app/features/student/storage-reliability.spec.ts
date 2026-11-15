import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { StudentService } from './student.service';
import { ArtworkDraft } from './student.models';
import { ArtworkCatalog } from '../marketplace/artwork-catalog';
import { CartService } from '../marketplace/cart';
import { ArtworkManagement } from './artwork-management/artwork-management';
import { Invoices } from './invoices/invoices';

const draft: ArtworkDraft = {
  title: 'Reliable artwork',
  description: 'A study',
  category: 'Painting',
  price: 100,
  imageUrl: 'https://example.com/art.png',
};
describe('Student persistence failures', () => {
  let student: StudentService;
  let key: string;
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [ArtworkManagement, Invoices],
      providers: [provideRouter([])],
    });
    const auth = TestBed.inject(AuthService);
    await auth.seedDemoUsers();
    await auth.login('student1', 'Pass1234', false);
    key = `artspace_student_v1_${auth.currentUser()!.id}`;
    student = TestBed.inject(StudentService);
  });
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  for (const name of ['QuotaExceededError', 'SecurityError']) {
    it(`keeps artworks, public catalogue, cart and saved data unchanged after failed edits/deletes (${name})`, () => {
      student.saveArtwork(draft);
      const id = student.artworks()[0].id;
      const catalog = TestBed.inject(ArtworkCatalog);
      const cart = TestBed.inject(CartService);
      cart.addToCart(catalog.artworks().find((item) => item.id === id)!);
      const previous = localStorage.getItem(key);
      const write = spyOn(Storage.prototype, 'setItem').and.callFake(() => {
        throw new DOMException('blocked', name);
      });
      expect(student.saveArtwork({ ...draft, title: 'Failed creation' })).toBeFalse();
      expect(student.saveArtwork({ ...draft, price: 999 }, id)).toBeFalse();
      expect(student.removeArtwork(id)).toBeFalse();
      expect(student.artworks()).toEqual([jasmine.objectContaining({ ...draft, id })]);
      expect(catalog.artworks().find((item) => item.id === id)?.price).toBe(100);
      expect(cart.total()).toBe(100);
      expect(localStorage.getItem(key)).toBe(previous);
      expect(student.storageError()).toContain('could not be saved');
      write.and.callThrough();
      expect(student.saveArtwork({ ...draft, price: 200 }, id)).toBeTrue();
      expect(student.storageError()).toBe('');
      expect(cart.total()).toBe(200);
      expect(student.removeArtwork(id)).toBeTrue();
      expect(cart.items()).toEqual([]);
    });
    it(`does not create invoices or mark payments paid when saving fails (${name})`, () => {
      const previous = localStorage.getItem(key);
      const before = student.outstanding();
      const write = spyOn(Storage.prototype, 'setItem').and.callFake(() => {
        throw new DOMException('blocked', name);
      });
      expect(student.createInvoice('studio')).toBeNull();
      expect(student.invoices().some((item) => item.feeId === 'studio')).toBeFalse();
      expect(student.payInvoice('INV-PRINTMAKING')).toBeFalse();
      expect(student.invoices().find((item) => item.id === 'INV-PRINTMAKING')?.paidOn).toBeNull();
      expect(student.outstanding()).toBe(before);
      expect(localStorage.getItem(key)).toBe(previous);
      write.and.callThrough();
      expect(student.createInvoice('studio')).toBe('INV-STUDIO');
      expect(student.payInvoice('INV-PRINTMAKING')).toBeTrue();
      expect(student.storageError()).toBe('');
    });
  }
  it('keeps the draft and edit/delete controls on failure without announcing success', async () => {
    const fixture = TestBed.createComponent(ArtworkManagement);
    await fixture.whenStable();
    const page: HTMLElement = fixture.nativeElement;
    const fill = (name: string, value: string) => {
      const input = page.querySelector<HTMLInputElement>(`[formControlName="${name}"]`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    fill('title', draft.title);
    fill('description', draft.description);
    fill('price', '100');
    fill('imageUrl', draft.imageUrl);
    const write = spyOn(Storage.prototype, 'setItem').and.throwError('quota');
    const submit = async () => {
      page
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await fixture.whenStable();
    };
    await submit();
    expect(page.querySelector('[role=alert]')?.textContent).toContain('could not be saved');
    expect(page.textContent).not.toContain('Listing added.');
    expect(page.querySelector<HTMLInputElement>('[formControlName=title]')!.value).toBe(
      draft.title,
    );
    write.and.callThrough();
    await submit();
    const click = async (text: string) => {
      [...page.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!.click();
      await fixture.whenStable();
    };
    await click('Edit');
    fill('title', 'Edited title');
    write.and.throwError('quota');
    await submit();
    expect(page.textContent).not.toContain('Listing updated.');
    expect(student.artworks()[0].title).toBe(draft.title);
    await click('Remove');
    await click('Confirm removal');
    expect(page.textContent).not.toContain('Listing removed.');
    expect(student.artworks().length).toBe(1);
    expect(page.querySelector('[role=alert]')?.textContent).toContain('could not be saved');
    fixture.destroy();
  });
  it('shows the persistence failure on the invoice page and keeps the payment unpaid', async () => {
    const fixture = TestBed.createComponent(Invoices);
    await fixture.whenStable();
    const page: HTMLElement = fixture.nativeElement;
    [...page.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === 'INV-PRINTMAKING')!
      .click();
    await fixture.whenStable();
    spyOn(Storage.prototype, 'setItem').and.throwError('blocked');
    [...page.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === 'Simulate payment')!
      .click();
    await fixture.whenStable();
    expect(page.querySelector('[role=alert]')?.textContent).toContain('could not be saved');
    expect(student.invoices().find((item) => item.id === 'INV-PRINTMAKING')?.paidOn).toBeNull();
    fixture.destroy();
  });
});
