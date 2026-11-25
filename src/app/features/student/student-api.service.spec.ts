import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/services/auth.service';
import { ArtworkCatalog } from '../marketplace/artwork-catalog';
import { CartService } from '../marketplace/cart';
import { InvoiceDetails, USE_STUDENT_API } from './student-api.service';
import { StudentService } from './student.service';

describe('Laravel student data through the Angular portal', () => {
  const user = signal<{ id: string; role: 'student' } | null>({ id: '1', role: 'student' });
  const draft = {
    title: 'Studio drawing',
    description: 'Graphite on paper',
    category: 'Other' as const,
    price: 23.45,
    imageUrl: '/api/artwork-images/upload.png',
  };
  const artwork = { ...draft, id: '2575a557-db75-4d07-b248-4a99344330cf' };
  let http: HttpTestingController;
  let students: StudentService;

  beforeEach(() => {
    localStorage.clear();
    user.set({ id: '1', role: 'student' });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: USE_STUDENT_API, useValue: true },
        { provide: AuthService, useValue: { currentUser: user } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    students = TestBed.inject(StudentService);
    TestBed.tick();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  function respondToStudentReads(artworks = [artwork], invoice?: InvoiceDetails) {
    const outstanding = invoice?.paidOn ? 0 : 100;
    http.expectOne('/api/student/dashboard').flush({
      profile: { name: 'Student', email: 'student@example.com', username: 'student' },
      courses: ['Drawing'],
      membership: { name: 'Open Studio', expiresOn: '2027-01-31' },
      outstanding,
      totalPaid: invoice?.paidOn ? invoice.amount : 0,
      earnings: 12,
    });
    http.expectOne('/api/student/fees').flush({
      fees: [],
      outstanding,
      paymentHistory: invoice?.paidOn ? [invoice] : [],
    });
    http.expectOne('/api/student/invoices').flush(invoice ? [invoice] : []);
    http.expectOne('/api/student/sales').flush({ sales: [], earnings: 12 });
    http.expectOne('/api/student/artworks').flush(artworks);
  }

  it('shares uploaded artwork changes with the existing catalogue and cart', async () => {
    const catalogue = TestBed.inject(ArtworkCatalog);
    const cart = TestBed.inject(CartService);
    http.expectOne('/api/artworks').flush([]);
    respondToStudentReads([]);
    await Promise.resolve();

    const image = new File(['image'], 'upload.png', { type: 'image/png' });
    const pending = students.api!.saveArtwork({ ...draft, imageUrl: '' }, undefined, image);
    const create = http.expectOne({ method: 'POST', url: '/api/student/artworks' });
    expect(create.request.body.get('image')).toBe(image);
    create.flush(artwork);
    await Promise.resolve();
    respondToStudentReads();
    http.expectOne('/api/artworks').flush([{ ...artwork, artist: 'Student' }]);
    await pending;

    expect(students.artworks()).toEqual([artwork]);
    expect(students.courses).toEqual(['Drawing']);
    const listing = catalogue.artworks().find((item) => item.id === artwork.id)!;
    expect(cart.addToCart(listing)).toBeTrue();
    expect(cart.total()).toBe(23.45);

    const removing = students.api!.removeArtwork(artwork.id);
    http.expectOne({ method: 'DELETE', url: '/api/student/artworks/' + artwork.id })
      .flush(null, { status: 204, statusText: 'No Content' });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    respondToStudentReads([]);
    http.expectOne('/api/artworks').flush([]);
    await removing;
    expect(cart.items()).toEqual([]);
  });

  it('refreshes the invoice, balance, and payment history after a simulated payment', async () => {
    http.expectOne('/api/artworks').flush([]);
    respondToStudentReads();
    await Promise.resolve();

    const invoice: InvoiceDetails = {
      id: '2',
      feeId: '1',
      label: 'Studio fee',
      type: 'Studio',
      amount: 100,
      dueDate: '2026-12-01',
      issuedOn: '2026-11-24',
      paidOn: null,
    };
    const creating = students.api!.createInvoice(invoice.feeId);
    const create = http.expectOne({ method: 'POST', url: '/api/student/invoices' });
    expect(create.request.body).toEqual({ feeId: invoice.feeId });
    create.flush(invoice);
    await Promise.resolve();
    respondToStudentReads([artwork], invoice);
    expect(await creating).toEqual(invoice);
    expect(students.invoices()).toEqual([invoice]);
    expect(students.outstanding()).toBe(100);

    const paid = { ...invoice, paidOn: '2026-11-24' };
    const paying = students.api!.payInvoice(invoice.id);
    http.expectOne({ method: 'POST', url: '/api/student/invoices/2/payments' }).flush(paid);
    await Promise.resolve();
    respondToStudentReads([artwork], paid);
    expect(await paying).toEqual(paid);
    expect(students.invoices()).toEqual([paid]);
    expect(students.paymentHistory()).toEqual([paid]);
    expect(students.outstanding()).toBe(0);
  });

  it('clears private records on logout while retaining the public catalogue', async () => {
    http.expectOne('/api/artworks').flush([{ ...artwork, artist: 'Student' }]);
    respondToStudentReads();
    await Promise.resolve();
    expect(students.outstanding()).toBe(100);

    user.set(null);
    TestBed.tick();
    expect(students.artworks()).toEqual([]);
    expect(students.outstanding()).toBeNull();
    expect(students.publicListings().length).toBe(1);
  });
});
