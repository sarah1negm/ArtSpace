import { DeferBlockState, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { AuthService } from '../core/services/auth.service';
import { StorageService } from '../core/services/storage.service';
import { StudentService } from './student/student.service';
import { StudentShell } from './student/student-shell';
import { INITIAL_RECORDS } from './student/student.mock';
import { AccountingService } from './accounting/services/accounting.service';
import { AccountingShell } from './accounting/accounting-shell';
import { initialState, STORAGE_KEY } from './accounting/accounting.mock';
import { CartService } from './marketplace/cart';
import { Cart } from './marketplace/cart/cart';
import { ARTWORKS } from './marketplace/artworks';
import { ArtworkCatalog } from './marketplace/artwork-catalog';
import { Gallery } from './marketplace/gallery/gallery';
import { Payroll } from './accounting/payroll/payroll';
import { Fees } from './student/fees/fees';
import { Home } from '../pages/home/home';
import { Profile } from '../pages/profile/profile';

const draft = {
  title: 'Saved artwork',
  description: 'A study',
  category: 'Painting' as const,
  price: 125,
  imageUrl: 'https://example.com/art.png',
};
const studentRecords = () => ({
  ...structuredClone(INITIAL_RECORDS),
  artworks: [{ ...draft, id: 'saved-art' }],
});

describe('Storage read recovery', () => {
  let key: string;
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const auth = TestBed.inject(AuthService);
    await auth.seedDemoUsers();
    await auth.login('student1', 'Pass1234', false);
    key = `artspace_student_v1_${auth.currentUser()!.id}`;
  });
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  function denyRead(target: string): jasmine.Spy {
    const get = Storage.prototype.getItem;
    return spyOn(Storage.prototype, 'getItem').and.callFake(function (this: Storage, name: string) {
      if (name === target) throw new DOMException('blocked', 'SecurityError');
      return get.call(this, name);
    });
  }

  it('distinguishes missing, loaded, unreadable, invalid JSON and invalid structures without writing', () => {
    const storage = TestBed.inject(StorageService);
    const valid = (value: unknown): value is string => typeof value === 'string';
    const write = spyOn(Storage.prototype, 'setItem').and.callThrough();
    expect(storage.loadLocal('probe', valid)).toEqual({ status: 'missing' });
    localStorage.setItem('probe', '"saved"');
    expect(storage.loadLocal('probe', valid)).toEqual({ status: 'loaded', value: 'saved' });
    localStorage.setItem('probe', '{broken');
    expect(storage.loadLocal('probe', valid)).toEqual({ status: 'invalid' });
    localStorage.setItem('probe', 'null');
    expect(storage.loadLocal('probe', valid)).toEqual({ status: 'invalid' });
    const writes = write.calls.count();
    denyRead('probe');
    expect(storage.loadLocal('probe', valid)).toEqual({ status: 'unreadable' });
    expect(write.calls.count()).toBe(writes);
  });

  it('blocks Student mutations after a failed read and restores saved invoices/listings on retry', () => {
    const original = JSON.stringify(studentRecords());
    localStorage.setItem(key, original);
    const read = denyRead(key);
    const write = spyOn(Storage.prototype, 'setItem').and.callThrough();
    const student = TestBed.inject(StudentService);
    expect(student.loadStatus()).toBe('unreadable');
    expect(student.createInvoice('studio')).toBeNull();
    expect(student.payInvoice('INV-PRINTMAKING')).toBeFalse();
    expect(student.saveArtwork(draft)).toBeFalse();
    expect(student.removeArtwork('saved-art')).toBeFalse();
    expect(student.storageError()).toContain('Saving is blocked');
    expect(write).not.toHaveBeenCalled();
    read.and.callThrough();
    expect(localStorage.getItem(key)).toBe(original);
    // Recovery is explicit; restoring browser access alone cannot enable fallback writes.
    expect(student.saveArtwork(draft)).toBeFalse();
    student.retryLoad();
    expect(student.artworks()[0].id).toBe('saved-art');
    expect(student.invoices().length).toBe(INITIAL_RECORDS.invoices.length);
    expect(student.storageError()).toBe('');
    expect(student.saveArtwork({ ...draft, price: 250 }, 'saved-art')).toBeTrue();
    expect(student.payInvoice('INV-PRINTMAKING')).toBeTrue();
    expect(student.removeArtwork('saved-art')).toBeTrue();
  });

  it('blocks Accounting changes/reset after a failed read and recovers prior financial records', () => {
    const saved = initialState();
    saved.staff[0].baseSalary = 22222;
    const original = JSON.stringify(saved);
    localStorage.setItem(STORAGE_KEY, original);
    const read = denyRead(STORAGE_KEY);
    const write = spyOn(Storage.prototype, 'setItem').and.callThrough();
    const acc = TestBed.inject(AccountingService);
    expect(acc.loadStatus()).toBe('unreadable');
    expect(acc.setBaseSalary('t1', 100)).toBeFalse();
    expect(acc.addAdjustment('t1', 'allowances', 'Bonus', 10)).toBeFalse();
    expect(acc.removeAdjustment('t1', 'deductions', 't1-d0')).toBeFalse();
    expect(
      acc.addLedgerEntry({ month: '2026-11', type: 'income', label: 'Sale', amount: 10 }),
    ).toBeFalse();
    expect(acc.removeLedgerEntry('x')).toBeFalse();
    expect(acc.processPayout('sale-1')).toBeFalse();
    expect(acc.processAllPayouts()).toBe(0);
    expect(acc.reset()).toBeFalse();
    expect(write).not.toHaveBeenCalled();
    read.and.callThrough();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(original);
    expect(acc.setBaseSalary('t1', 100)).toBeFalse();
    acc.retryLoad();
    expect(acc.payroll()[0].baseSalary).toBe(22222);
    expect(acc.ledger()).toEqual(saved.ledger);
    expect(acc.storageError()).toBe('');
    expect(acc.setBaseSalary('t1', 23000)).toBeTrue();
    expect(acc.processPayout('sale-1')).toBeTrue();
  });

  it('blocks cart writes and checkout after a failed read, then restores quantities and totals', () => {
    const original = JSON.stringify([ARTWORKS[0], ARTWORKS[0], ARTWORKS[1]]);
    localStorage.setItem('artspace-cart', original);
    const read = denyRead('artspace-cart');
    const write = spyOn(Storage.prototype, 'setItem').and.callThrough();
    const cart = TestBed.inject(CartService);
    expect(cart.addToCart(ARTWORKS[2])).toBeFalse();
    expect(cart.setQuantity(ARTWORKS[0].id, 3)).toBeFalse();
    expect(cart.removeArtwork(ARTWORKS[0].id)).toBeFalse();
    expect(cart.removeFromCart(0)).toBeFalse();
    expect(cart.clear()).toBeFalse();
    const page = TestBed.createComponent(Cart);
    page.componentInstance.checkout();
    expect(page.componentInstance.receipt()).toBeNull();
    expect(write).not.toHaveBeenCalled();
    read.and.callThrough();
    expect(localStorage.getItem('artspace-cart')).toBe(original);
    expect(cart.addToCart(ARTWORKS[2])).toBeFalse();
    cart.retryLoad();
    expect(cart.items()).toEqual([ARTWORKS[0], ARTWORKS[0], ARTWORKS[1]]);
    expect(cart.total()).toBe(440);
    expect(cart.setQuantity(ARTWORKS[0].id, 3)).toBeTrue();
    expect(cart.removeArtwork(ARTWORKS[1].id)).toBeTrue();
    page.componentInstance.checkout();
    expect(page.componentInstance.receipt()).toEqual({ quantity: 3, total: 360 });
    expect(localStorage.getItem('artspace-cart')).toBe('[]');
    page.destroy();
  });

  it('preserves unresolved student cart IDs while listings are unreadable and restores them reactively', () => {
    localStorage.setItem(key, JSON.stringify(studentRecords()));
    localStorage.setItem('artspace-cart', JSON.stringify([{ id: 'saved-art' }, ARTWORKS[0]]));
    const read = denyRead(key);
    const cart = TestBed.inject(CartService);
    const catalog = TestBed.inject(ArtworkCatalog);
    expect(catalog.artworks().some((item) => item.id === 'saved-art')).toBeFalse();
    expect(cart.addToCart(ARTWORKS[1])).toBeFalse();
    expect(cart.clear()).toBeFalse();
    read.and.callThrough();
    cart.retryLoad();
    expect(cart.items().map((item) => item.id)).toEqual(['saved-art', ARTWORKS[0].id]);
    expect(cart.total()).toBe(245);
    expect(cart.addToCart(ARTWORKS[1])).toBeTrue();
  });

  it('keeps genuinely missing storage on the existing mock-data path', () => {
    const student = TestBed.inject(StudentService),
      acc = TestBed.inject(AccountingService),
      cart = TestBed.inject(CartService);
    expect(student.loadStatus()).toBe('missing');
    expect(student.invoices().length).toBe(INITIAL_RECORDS.invoices.length);
    expect(student.createInvoice('studio')).toBe('INV-STUDIO');
    expect(acc.loadStatus()).toBe('missing');
    expect(acc.payroll().length).toBe(initialState().staff.length);
    expect(acc.setBaseSalary('t1', 15000)).toBeTrue();
    expect(cart.loadStatus()).toBe('missing');
    expect(cart.addToCart(ARTWORKS[0])).toBeTrue();
  });

  it('protects unresolved student cart items when the artist-account read fails', () => {
    localStorage.setItem(key, JSON.stringify(studentRecords()));
    const original = JSON.stringify([{ id: 'saved-art' }]);
    localStorage.setItem('artspace-cart', original);
    const read = denyRead('artspace_users');
    const cart = TestBed.inject(CartService);
    expect(cart.addToCart(ARTWORKS[0])).toBeFalse();
    expect(cart.clear()).toBeFalse();
    expect(localStorage.getItem('artspace-cart')).toBe(original);
    read.and.callThrough();
    cart.retryLoad();
    expect(cart.items()[0].id).toBe('saved-art');
    expect(cart.total()).toBe(125);
    expect(cart.addToCart(ARTWORKS[0])).toBeTrue();
  });

  it('preserves a non-array cart record and blocks writes until it is corrected', () => {
    localStorage.setItem('artspace-cart', '{}');
    const cart = TestBed.inject(CartService);
    expect(cart.loadStatus()).toBe('invalid');
    expect(cart.addToCart(ARTWORKS[0])).toBeFalse();
    expect(cart.clear()).toBeFalse();
    expect(localStorage.getItem('artspace-cart')).toBe('{}');
    localStorage.setItem('artspace-cart', JSON.stringify([ARTWORKS[1]]));
    cart.retryLoad();
    expect(cart.total()).toBe(200);
  });

  const invalidStudent = [
    null,
    [],
    {},
    { invoices: [], artworks: {} },
    { invoices: [null], artworks: [] },
    { invoices: [], artworks: [{ ...draft, id: 'x', price: '125' }] },
    { invoices: [{ id: 'x', feeId: 'studio', issuedOn: 'bad', paidOn: null }], artworks: [] },
  ];
  for (const [index, bad] of invalidStudent.entries()) {
    it(`preserves invalid Student structure ${index}, avoids crashes, and reloads corrected records`, () => {
      const original = JSON.stringify(bad);
      localStorage.setItem(key, original);
      const student = TestBed.inject(StudentService);
      expect(() => {
        student.fees();
        student.invoices();
        student.publicListings();
      }).not.toThrow();
      expect(student.loadStatus()).toBe('invalid');
      expect(student.saveArtwork(draft)).toBeFalse();
      expect(student.createInvoice('studio')).toBeNull();
      expect(student.payInvoice('x')).toBeFalse();
      expect(student.removeArtwork('x')).toBeFalse();
      expect(localStorage.getItem(key)).toBe(original);
      localStorage.setItem(key, JSON.stringify(studentRecords()));
      student.retryLoad();
      expect(student.artworks()[0].id).toBe('saved-art');
      expect(student.storageError()).toBe('');
    });
  }
  const invalidAccounting = [
    null,
    [],
    {},
    { staff: [], ledger: [], paid: [] },
    { ...initialState(), staff: [null] },
    { ...initialState(), staff: [{ ...initialState().staff[0], baseSalary: '14000' }] },
    { ...initialState(), staff: [{ ...initialState().staff[0], allowances: [null] }] },
    {
      ...initialState(),
      ledger: [{ id: 'x', month: '2026-13', type: 'income', label: 'Bad', amount: 1 }],
    },
    { ...initialState(), paid: { 'sale-1': false } },
  ];
  for (const [index, bad] of invalidAccounting.entries()) {
    it(`preserves invalid Accounting structure ${index}, avoids crashes, and reloads corrected records`, () => {
      const original = JSON.stringify(bad);
      localStorage.setItem(STORAGE_KEY, original);
      const acc = TestBed.inject(AccountingService);
      expect(() => {
        acc.payroll();
        acc.totals();
        acc.payouts();
        acc.generateReport('2026-11');
      }).not.toThrow();
      expect(acc.loadStatus()).toBe('invalid');
      expect(acc.generateReport('2026-11')).toBeNull();
      expect(acc.setBaseSalary('t1', 99)).toBeFalse();
      expect(acc.processPayout('sale-1')).toBeFalse();
      expect(acc.reset()).toBeFalse();
      expect(localStorage.getItem(STORAGE_KEY)).toBe(original);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState()));
      acc.retryLoad();
      expect(acc.payroll().length).toBe(6);
      expect(acc.storageError()).toBe('');
    });
  }

  it('preserves malformed JSON in all three features until explicitly corrected and retried', () => {
    for (const name of [key, STORAGE_KEY, 'artspace-cart']) localStorage.setItem(name, '{broken');
    const student = TestBed.inject(StudentService),
      acc = TestBed.inject(AccountingService),
      cart = TestBed.inject(CartService);
    expect(student.saveArtwork(draft)).toBeFalse();
    expect(acc.reset()).toBeFalse();
    expect(cart.clear()).toBeFalse();
    for (const name of [key, STORAGE_KEY, 'artspace-cart'])
      expect(localStorage.getItem(name)).toBe('{broken');
    localStorage.setItem(key, JSON.stringify(studentRecords()));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState()));
    localStorage.setItem('artspace-cart', JSON.stringify([ARTWORKS[0]]));
    student.retryLoad();
    acc.retryLoad();
    cart.retryLoad();
    expect(student.loadStatus()).toBe('loaded');
    expect(acc.loadStatus()).toBe('loaded');
    expect(cart.total()).toBe(120);
  });

  it('offers working Student, Accounting, Gallery and Cart retry controls without resetting stored values', async () => {
    localStorage.setItem(key, JSON.stringify(studentRecords()));
    localStorage.setItem(STORAGE_KEY, 'null');
    localStorage.setItem('artspace-cart', '{}');
    const read = denyRead(key);
    const fixtures = [
      TestBed.createComponent(StudentShell),
      TestBed.createComponent(AccountingShell),
      TestBed.createComponent(Gallery),
      TestBed.createComponent(Cart),
    ];
    for (const fixture of fixtures) {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role=alert]')).not.toBeNull();
      expect(
        [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].some((button) =>
          button.textContent?.includes('Retry loading'),
        ),
      ).toBeTrue();
    }
    read.and.callThrough();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState()));
    localStorage.setItem('artspace-cart', JSON.stringify([ARTWORKS[0]]));
    // Exercise each independent recovery. Gallery shares the recovered Student data.
    for (const index of [0, 1, 3]) {
      const fixture = fixtures[index];
      requiredRetry(fixture.nativeElement).click();
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('[role=alert]')).toBeNull();
    }
    await fixtures[2].whenStable();
    expect(fixtures[2].nativeElement.querySelector('[role=alert]')).toBeNull();
    expect(TestBed.inject(StudentService).artworks()[0].id).toBe('saved-art');
    expect(TestBed.inject(CartService).total()).toBe(120);
    fixtures.forEach((fixture) => fixture.destroy());
  });

  function requiredRetry(page: HTMLElement): HTMLButtonElement {
    const button = [...page.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Retry loading'),
    );
    expect(button).withContext('a required recovery button must exist').toBeDefined();
    return button!;
  }

  function generate(page: HTMLElement): void {
    page
      .querySelector('select')!
      .closest('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  for (const failure of ['unreadable', 'invalid'] as const) {
    it(`blocks payroll report generation and downloads while records are ${failure}`, async () => {
      localStorage.setItem(
        STORAGE_KEY,
        failure === 'invalid' ? 'null' : JSON.stringify(initialState()),
      );
      if (failure === 'unreadable') denyRead(STORAGE_KEY);
      const fixture = TestBed.createComponent(Payroll);
      await fixture.whenStable();
      const page: HTMLElement = fixture.nativeElement;
      const acc = TestBed.inject(AccountingService);
      const download = spyOn(URL, 'createObjectURL').and.returnValue('blob:review');
      expect(acc.generateReport('2026-11')).toBeNull();
      expect(page.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBeTrue();
      expect(page.querySelector('[role=alert]')!.textContent).toContain('reports are unavailable');
      acc.retryLoad();
      await fixture.whenStable();
      expect(page.querySelector('[role=alert]')).not.toBeNull();
      expect(acc.generateReport('2026-11')).toBeNull();
      // Guard the handler as well as the disabled button.
      generate(page);
      (fixture.componentInstance as unknown as { download(): void }).download();
      await fixture.whenStable();
      expect(page.querySelector('pre')).toBeNull();
      expect(page.textContent).not.toContain('Download JSON');
      expect(download).not.toHaveBeenCalled();
      fixture.destroy();
    });

    it(`does not display fabricated Student balances or Unpaid statuses while records are ${failure}`, async () => {
      const saved = studentRecords();
      const original = JSON.stringify(saved);
      localStorage.setItem(key, failure === 'invalid' ? 'null' : original);
      const read = failure === 'unreadable' ? denyRead(key) : null;
      const fixture = TestBed.createComponent(Fees);
      await fixture.whenStable();
      const page: HTMLElement = fixture.nativeElement;
      const student = TestBed.inject(StudentService);
      expect(student.outstanding()).toBeNull();
      expect(student.fees()).toEqual([]);
      expect(page.querySelector('table')).toBeNull();
      expect(page.textContent).not.toContain('Unpaid');
      expect(page.textContent).not.toContain('3,900');
      expect(page.textContent).not.toContain('No payments yet');
      requiredRetry(page).click();
      await fixture.whenStable();
      expect(page.querySelector('[role=alert]')).not.toBeNull();
      expect(student.outstanding()).toBeNull();
      if (read) read.and.callThrough();
      localStorage.setItem(key, original);
      requiredRetry(page).click();
      await fixture.whenStable();
      expect(page.querySelector('[role=alert]')).toBeNull();
      expect(student.outstanding()).toBe(2100);
      expect(student.paymentHistory().map((item) => item.id)).toEqual(['INV-DRAWING']);
      expect(student.fees().find((item) => item.id === 'drawing')!.balance).toBe(0);
      expect(page.textContent).toContain('Paid');
      expect(page.textContent).toContain('2,100');
      fixture.destroy();
    });
  }

  it('invalidates payroll reports on failed and successful reloads, then exports restored values', async () => {
    const saved = initialState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    const fixture = TestBed.createComponent(Payroll);
    await fixture.whenStable();
    const page: HTMLElement = fixture.nativeElement;
    const acc = TestBed.inject(AccountingService);
    generate(page);
    await fixture.whenStable();
    expect(JSON.parse(page.querySelector('pre')!.textContent!).employees.length).toBe(6);
    localStorage.setItem(STORAGE_KEY, 'null');
    acc.retryLoad();
    await fixture.whenStable();
    expect(page.querySelector('pre')).toBeNull();
    const create = spyOn(URL, 'createObjectURL').and.returnValue('blob:review');
    spyOn(URL, 'revokeObjectURL');
    spyOn(HTMLAnchorElement.prototype, 'click');
    (fixture.componentInstance as unknown as { download(): void }).download();
    expect(create).not.toHaveBeenCalled();
    saved.staff[0].baseSalary = 22222;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    acc.retryLoad();
    await fixture.whenStable();
    expect(acc.payroll()[0].baseSalary).toBe(22222);
    expect(page.querySelector('pre')).toBeNull();
    expect(page.textContent).not.toContain('Download JSON');
    generate(page);
    await fixture.whenStable();
    const report = JSON.parse(page.querySelector('pre')!.textContent!);
    expect(report.employees[0].baseSalary).toBe(22222);
    expect(report.totals.netSalary).toBe(acc.totalPayroll());
    [...page.querySelectorAll('button')]
      .find((button) => button.textContent === 'Download JSON')!
      .click();
    expect(create).toHaveBeenCalledTimes(1);
    const blob = create.calls.mostRecent().args[0] as Blob;
    expect(JSON.parse(await blob.text()).employees[0].baseSalary).toBe(22222);
    // Even a successful reload invalidates the previous snapshot.
    acc.retryLoad();
    await fixture.whenStable();
    expect(page.querySelector('pre')).toBeNull();
    fixture.destroy();
  });

  it('keeps mock fees and payroll reports available when records are genuinely missing', async () => {
    const fees = TestBed.createComponent(Fees);
    const payroll = TestBed.createComponent(Payroll);
    await fees.whenStable();
    await payroll.whenStable();
    expect(fees.nativeElement.querySelector('[role=alert]')).toBeNull();
    expect(TestBed.inject(StudentService).outstanding()).toBe(2100);
    expect(fees.nativeElement.textContent).toContain('Paid');
    generate(payroll.nativeElement);
    await payroll.whenStable();
    expect(
      JSON.parse(payroll.nativeElement.querySelector('pre').textContent).employees.length,
    ).toBe(6);
    expect(TestBed.inject(AccountingService).loadStatus()).toBe('missing');
    fees.destroy();
    payroll.destroy();
  });

  for (const component of [Home, Gallery, Profile]) {
    it(`exercises ${component.name}'s own retry control through failed and successful recovery`, async () => {
      localStorage.setItem(key, JSON.stringify(studentRecords()));
      const read = denyRead(key);
      const fixture = TestBed.createComponent<Home | Gallery | Profile>(component);
      await fixture.whenStable();
      const page: HTMLElement = fixture.nativeElement;
      requiredRetry(page).click();
      await fixture.whenStable();
      expect(page.querySelector('[role=alert]')).not.toBeNull();
      expect(TestBed.inject(StudentService).loadStatus()).toBe('unreadable');
      read.and.callThrough();
      requiredRetry(page).click();
      await fixture.whenStable();
      expect(page.querySelector('[role=alert]')).toBeNull();
      if (component === Home) {
        const blocks = await fixture.getDeferBlocks();
        await blocks[0].render(DeferBlockState.Complete);
        await fixture.whenStable();
      }
      expect(page.textContent).toContain('Saved artwork');
      expect(TestBed.inject(StudentService).artworks()[0].id).toBe('saved-art');
      fixture.destroy();
    });
  }

  it('exercises the Cart retry button while preserving quantities and blocking failed recovery', async () => {
    const saved = JSON.stringify([ARTWORKS[0], ARTWORKS[0]]);
    localStorage.setItem('artspace-cart', saved);
    const read = denyRead('artspace-cart');
    const fixture = TestBed.createComponent(Cart);
    await fixture.whenStable();
    const page: HTMLElement = fixture.nativeElement;
    requiredRetry(page).click();
    await fixture.whenStable();
    expect(page.querySelector('[role=alert]')).not.toBeNull();
    expect(page.textContent).not.toContain('Your cart is empty');
    read.and.callThrough();
    requiredRetry(page).click();
    await fixture.whenStable();
    expect(page.querySelector('[role=alert]')).toBeNull();
    expect(page.textContent).toContain('Quantity: 2');
    expect(TestBed.inject(CartService).total()).toBe(240);
    expect(localStorage.getItem('artspace-cart')).toBe(saved);
    fixture.destroy();
  });

  it('retries unavailable Details without claiming not found, restores the artwork and retains Add to Cart', async () => {
    localStorage.setItem(key, JSON.stringify(studentRecords()));
    const read = denyRead(key);
    const harness = await RouterTestingHarness.create('/gallery/saved-art');
    const page = harness.routeNativeElement!;
    expect(page.textContent).toContain('Artwork temporarily unavailable');
    expect(page.textContent).not.toContain('Artwork not found');
    requiredRetry(page).click();
    harness.detectChanges();
    expect(page.querySelector('[role=alert]')).not.toBeNull();
    expect(page.textContent).not.toContain('Artwork not found');
    read.and.callThrough();
    requiredRetry(page).click();
    harness.detectChanges();
    expect(page.querySelector('[role=alert]')).toBeNull();
    expect(page.textContent).toContain('Saved artwork');
    [...page.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === 'Add to Cart')!
      .click();
    harness.detectChanges();
    expect(TestBed.inject(CartService).total()).toBe(125);
    expect(page.querySelector('a')!.getAttribute('href')).toBe('/gallery');
  });

  it('shows not found for genuinely nonexistent artwork after a successful catalogue load', async () => {
    const harness = await RouterTestingHarness.create('/gallery/nonexistent');
    expect(harness.routeNativeElement!.textContent).toContain('Artwork not found');
    expect(harness.routeNativeElement!.textContent).not.toContain(
      'Artwork temporarily unavailable',
    );
    expect(harness.routeNativeElement!.querySelector('[role=alert]')).toBeNull();
  });
});
