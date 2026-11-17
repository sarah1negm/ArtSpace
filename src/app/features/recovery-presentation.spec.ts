import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { AccountingService } from './accounting/services/accounting.service';
import { initialState, STORAGE_KEY } from './accounting/accounting.mock';
import { Dashboard as AccountingDashboard } from './accounting/dashboard/dashboard';
import { DepartmentBudget } from './accounting/department-budget/department-budget';
import { SellerPayouts } from './accounting/seller-payouts/seller-payouts';
import { StudentService } from './student/student.service';
import { INITIAL_RECORDS } from './student/student.mock';
import { Invoices } from './student/invoices/invoices';
import { ArtworkManagement } from './student/artwork-management/artwork-management';
import { Dashboard as StudentDashboard } from './student/dashboard/dashboard';
import { Profile } from '../pages/profile/profile';
import { Gallery } from './marketplace/gallery/gallery';
import { Cart } from './marketplace/cart/cart';
import { CartService } from './marketplace/cart';
import { ARTWORKS } from './marketplace/artworks';

const records = () => ({
  ...structuredClone(INITIAL_RECORDS),
  artworks: [
    {
      id: 'saved-art',
      title: 'Saved artwork',
      description: 'An original study',
      category: 'Painting',
      price: 125,
      imageUrl: 'https://example.com/art.png',
    },
  ],
});

describe('Unavailable records are never presented as real financial or empty data', () => {
  let studentKey: string;
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const auth = TestBed.inject(AuthService);
    await auth.seedDemoUsers();
    await auth.login('student1', 'Pass1234', false);
    studentKey = `artspace_student_v1_${auth.currentUser()!.id}`;
  });
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  function deny(key: string): jasmine.Spy {
    const read = Storage.prototype.getItem;
    return spyOn(Storage.prototype, 'getItem').and.callFake(function (this: Storage, name: string) {
      if (name === key) throw new DOMException('Blocked', 'SecurityError');
      return read.call(this, name);
    });
  }
  function retry(page: HTMLElement): void {
    const button = [...page.querySelectorAll('button')].find((item) =>
      item.textContent?.includes('Retry loading'),
    );
    expect(button).withContext('required recovery control').toBeDefined();
    button!.click();
  }

  for (const component of [AccountingDashboard, DepartmentBudget, SellerPayouts]) {
    for (const failure of ['unreadable', 'invalid']) {
      it(`${component.name} withholds metrics, tables, statuses and charts while ${failure}, then restores them`, async () => {
        const original = failure === 'invalid' ? 'null' : JSON.stringify(initialState());
        localStorage.setItem(STORAGE_KEY, original);
        const read = failure === 'unreadable' ? deny(STORAGE_KEY) : null;
        const fixture = TestBed.createComponent<
          AccountingDashboard | DepartmentBudget | SellerPayouts
        >(component);
        await fixture.whenStable();
        const page: HTMLElement = fixture.nativeElement;
        for (let attempt = 0; attempt < 2; attempt++) {
          expect(page.querySelector('[role=alert]')).not.toBeNull();
          expect(page.querySelector('.metric')).toBeNull();
          expect(page.querySelector('table')).toBeNull();
          expect(page.querySelector('canvas')).toBeNull();
          expect(page.querySelector('.badge')).toBeNull();
          expect(page.textContent).not.toContain('EGP');
          retry(page);
          await fixture.whenStable();
        }
        if (read) read.and.callThrough();
        expect(localStorage.getItem(STORAGE_KEY)).toBe(original);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState()));
        retry(page);
        await fixture.whenStable();
        expect(page.querySelector('[role=alert]')).toBeNull();
        expect(page.querySelector('table')).not.toBeNull();
        expect(page.querySelector('.metric')).not.toBeNull();
        const acc = TestBed.inject(AccountingService);
        expect(acc.galleryTotals().expenses).toBe(13050);
        expect(acc.totalPayroll()).toBe(62480);
        expect(acc.pendingPayouts()).toBe(3697.5);
        if (component === SellerPayouts) {
          expect(page.querySelectorAll('.badge.paid').length).toBe(2);
          expect(page.textContent).toContain('3,697.5');
        } else {
          expect(page.querySelector('canvas')).not.toBeNull();
          if (component === DepartmentBudget) expect(page.textContent).toContain('13,050');
        }
        fixture.destroy();
      });
    }
    it(`${component.name} retains the normal mock-data view for genuinely missing records`, async () => {
      const fixture = TestBed.createComponent<
        AccountingDashboard | DepartmentBudget | SellerPayouts
      >(component);
      await fixture.whenStable();
      const page: HTMLElement = fixture.nativeElement;
      expect(TestBed.inject(AccountingService).loadStatus()).toBe('missing');
      expect(page.querySelector('[role=alert]')).toBeNull();
      expect(page.querySelector('table')).not.toBeNull();
      expect(page.querySelector('.metric')).not.toBeNull();
      if (component !== SellerPayouts) expect(page.querySelector('canvas')).not.toBeNull();
      else expect(page.querySelectorAll('.badge.paid').length).toBe(2);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      fixture.destroy();
    });
  }

  for (const component of [Invoices, ArtworkManagement]) {
    for (const failure of ['unreadable', 'invalid']) {
      it(`${component.name} does not claim unavailable records are empty (${failure})`, async () => {
        const original = failure === 'invalid' ? '{}' : JSON.stringify(records());
        localStorage.setItem(studentKey, original);
        const read = failure === 'unreadable' ? deny(studentKey) : null;
        const fixture = TestBed.createComponent<Invoices | ArtworkManagement>(component);
        await fixture.whenStable();
        const page: HTMLElement = fixture.nativeElement;
        retry(page);
        await fixture.whenStable();
        expect(page.querySelector('[role=alert]')).not.toBeNull();
        expect(page.textContent).not.toContain('No invoices yet');
        expect(page.textContent).not.toContain('No artwork listings yet');
        expect(page.querySelector('table')).toBeNull();
        expect(page.querySelector('form')).toBeNull();
        if (read) read.and.callThrough();
        expect(localStorage.getItem(studentKey)).toBe(original);
        localStorage.setItem(studentKey, JSON.stringify(records()));
        retry(page);
        await fixture.whenStable();
        expect(page.querySelector('[role=alert]')).toBeNull();
        if (component === Invoices) {
          expect(page.textContent).toContain('INV-DRAWING');
          expect(page.textContent).toContain('INV-PRINTMAKING');
          expect(page.querySelectorAll('tbody tr').length).toBe(2);
        } else {
          expect(page.textContent).toContain('Saved artwork');
          expect(page.querySelector('form')).not.toBeNull();
        }
        fixture.destroy();
      });
    }
  }

  for (const component of [StudentDashboard, Profile]) {
    for (const failure of ['unreadable', 'invalid']) {
      it(`${component.name} withholds unavailable artwork counts/listings (${failure})`, async () => {
        localStorage.setItem(
          studentKey,
          failure === 'invalid' ? 'null' : JSON.stringify(records()),
        );
        const read = failure === 'unreadable' ? deny(studentKey) : null;
        const fixture = TestBed.createComponent<StudentDashboard | Profile>(component);
        await fixture.whenStable();
        const page: HTMLElement = fixture.nativeElement;
        retry(page);
        await fixture.whenStable();
        expect(page.querySelector('[role=alert]')).not.toBeNull();
        expect(page.textContent).not.toContain('No artwork listings yet');
        if (component === StudentDashboard) {
          expect(page.querySelectorAll('.metric')[1].textContent).toBe('Unavailable');
        } else expect(page.querySelector('a[href="/gallery/saved-art"]')).toBeNull();
        if (read) read.and.callThrough();
        localStorage.setItem(studentKey, JSON.stringify(records()));
        retry(page);
        await fixture.whenStable();
        expect(page.querySelector('[role=alert]')).toBeNull();
        if (component === StudentDashboard)
          expect(page.querySelectorAll('.metric')[1].textContent).toBe('1');
        else
          expect(page.querySelector('a[href="/gallery/saved-art"]')!.textContent).toBe(
            'Saved artwork',
          );
        fixture.destroy();
      });
    }
  }

  for (const component of [Invoices, ArtworkManagement, StudentDashboard, Profile]) {
    it(`${component.name} preserves genuine empty-record behavior`, async () => {
      localStorage.setItem(studentKey, JSON.stringify({ invoices: [], artworks: [] }));
      const fixture = TestBed.createComponent<
        Invoices | ArtworkManagement | StudentDashboard | Profile
      >(component);
      await fixture.whenStable();
      const page: HTMLElement = fixture.nativeElement;
      expect(page.querySelector('[role=alert]')).toBeNull();
      expect(TestBed.inject(StudentService).recordsAvailable()).toBeTrue();
      if (component === Invoices) expect(page.textContent).toContain('No invoices yet');
      else if (component === StudentDashboard)
        expect(page.querySelectorAll('.metric')[1].textContent).toBe('0');
      else expect(page.textContent).toContain('No artwork listings yet');
      fixture.destroy();
    });
  }

  for (const failure of ['unreadable', 'invalid']) {
    it(`Gallery withholds incomplete search results and counts while listings are ${failure}`, async () => {
      localStorage.setItem(studentKey, failure === 'invalid' ? 'null' : JSON.stringify(records()));
      const read = failure === 'unreadable' ? deny(studentKey) : null;
      const fixture = TestBed.createComponent(Gallery);
      fixture.componentInstance.search.set('Saved artwork');
      await fixture.whenStable();
      const page: HTMLElement = fixture.nativeElement;
      retry(page);
      await fixture.whenStable();
      expect(page.querySelector('[role=alert]')).not.toBeNull();
      expect(page.textContent).not.toContain('artwork(s) found');
      expect(page.textContent).not.toContain('No artworks match');
      expect(page.textContent).toContain('Cart (Unavailable)');
      if (read) read.and.callThrough();
      localStorage.setItem(studentKey, JSON.stringify(records()));
      retry(page);
      await fixture.whenStable();
      expect(page.querySelector('[role=alert]')).toBeNull();
      expect(page.textContent).toContain('1 artwork(s) found');
      expect(page.querySelector('.artwork-card h2')!.textContent).toBe('Saved artwork');
      fixture.destroy();
    });

    it(`Cart hides partial totals and checkout while student listings are ${failure}`, async () => {
      localStorage.setItem(studentKey, failure === 'invalid' ? 'null' : JSON.stringify(records()));
      const original = JSON.stringify([{ id: 'saved-art' }, ARTWORKS[0], ARTWORKS[0]]);
      localStorage.setItem('artspace-cart', original);
      const read = failure === 'unreadable' ? deny(studentKey) : null;
      const fixture = TestBed.createComponent(Cart);
      await fixture.whenStable();
      const page: HTMLElement = fixture.nativeElement;
      expect(page.querySelector('.cart-list')).toBeNull();
      expect(page.textContent).not.toContain('Total:');
      expect(page.textContent).not.toContain('Your cart is empty');
      expect(page.textContent).not.toContain('Simulated checkout');
      fixture.componentInstance.checkout();
      expect(fixture.componentInstance.receipt()).toBeNull();
      retry(page);
      await fixture.whenStable();
      expect(page.querySelector('[role=alert]')).not.toBeNull();
      expect(localStorage.getItem('artspace-cart')).toBe(original);
      if (read) read.and.callThrough();
      localStorage.setItem(studentKey, JSON.stringify(records()));
      retry(page);
      await fixture.whenStable();
      expect(page.querySelector('[role=alert]')).toBeNull();
      expect(page.textContent).toContain('Quantity: 2');
      expect(page.textContent).toContain('Saved artwork');
      expect(TestBed.inject(CartService).total()).toBe(365);
      expect(page.textContent).toContain('Simulated checkout');
      expect(localStorage.getItem('artspace-cart')).toBe(original);
      fixture.destroy();
    });
  }
});
