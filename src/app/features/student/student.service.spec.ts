import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { User } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { StorageService } from '../../core/services/storage.service';
import { ArtworkDraft } from './student.models';
import { StudentService } from './student.service';

describe('StudentService', () => {
  const user: User = {
    id: 'test-student',
    username: 'student',
    name: 'Test Student',
    email: 'student@example.com',
    role: 'student',
    picture: '',
    cardLast4: '0000',
    passwordHash: '',
    preferences: { theme: 'light', newsletter: false },
  };
  const draft: ArtworkDraft = {
    title: 'Morning Light',
    description: 'A landscape',
    price: 450,
    category: 'Painting',
    imageUrl: 'https://example.com/painting.jpg',
  };

  let service: StudentService;
  const currentUser = signal<User | null>(null);
  const storage = new Map<string, unknown>();

  beforeEach(() => {
    storage.clear();
    currentUser.set(user);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { currentUser } },
        {
          provide: StorageService,
          useValue: {
            getLocal: (key: string, fallback: unknown) => storage.get(key) ?? fallback,
            setLocal: (key: string, value: unknown) => storage.set(key, structuredClone(value)),
          },
        },
      ],
    });
    service = TestBed.inject(StudentService);
  });

  it('creates one invoice per fee and records payment in fees and payment history', () => {
    const id = service.createInvoice('studio');
    expect(id).toBe('INV-STUDIO');
    expect(service.createInvoice('studio')).toBe(id);
    expect(service.invoices().filter((invoice) => invoice.feeId === 'studio').length).toBe(1);
    service.payInvoice(id!);
    expect(service.outstanding()).toBe(1500);
    expect(service.paymentHistory().some((payment) => payment.id === id)).toBeTrue();
  });

  it('adds, edits, and removes a listing', () => {
    expect(service.saveArtwork(draft)).toBeTrue();
    const id = service.artworks()[0].id;
    expect(service.saveArtwork({ ...draft, price: 500 }, id)).toBeTrue();
    expect(service.artworks()[0].price).toBe(500);
    service.removeArtwork(id);
    expect(service.artworks()).toEqual([]);
    expect(service.saveArtwork({ ...draft, price: -5 })).toBeFalse();
  });

  it('keeps changes separate for each account', () => {
    service.saveArtwork(draft);
    currentUser.set({ ...user, id: 'other-student' });
    expect(service.artworks()).toEqual([]);
    service.createInvoice('studio');
    currentUser.set(user);
    expect(service.artworks().length).toBe(1);
    expect(service.invoices().some((invoice) => invoice.feeId === 'studio')).toBeFalse();
  });

  it('calculates commissions and expected earnings', () => {
    expect(service.sales[0].commission).toBe(180);
    expect(service.earnings).toBe(1700);
  });
});
