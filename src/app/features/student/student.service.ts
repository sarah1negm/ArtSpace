import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { StorageService, StoredData } from '../../core/services/storage.service';
import { COURSES, FEES, INITIAL_RECORDS, MEMBERSHIP, SALES } from './student.mock';
import { ArtworkDraft, StudentRecords } from './student.models';
import { loadError } from '../../core/services/storage-validation';
import { isStudentRecords } from './student.validation';

@Injectable({ providedIn: 'root' })
export class StudentService {
  private readonly writeError = signal('');
  private readonly retryVersion = signal(0);
  private readonly auth = inject(AuthService);
  private readonly storage = inject(StorageService);
  private readonly student = computed(() => {
    const user = this.auth.currentUser();
    return user?.role === 'student' ? user : null;
  });
  private readonly key = computed(() => {
    const student = this.student();
    return student ? this.storageKey(student.id) : null;
  });
  private readonly saved = signal<{ key: string; records: StudentRecords } | null>(null);
  private readonly loaded = computed<StoredData<StudentRecords>>(() => {
    this.retryVersion();
    const key = this.key();
    const saved = this.saved();
    if (!key) return { status: 'missing' };
    return saved?.key === key ? { status: 'loaded', value: saved.records }
      : this.storage.loadLocal(key, isStudentRecords);
  });
  readonly loadStatus = computed(() => this.loaded().status);
  readonly recordsAvailable = computed(() => ['loaded', 'missing'].includes(this.loadStatus()));
  readonly storageError = computed(() => loadError(this.loadStatus(), 'student records') || this.writeError());
  private readonly records = computed<StudentRecords>(() => {
    if (!this.key()) return { invoices: [], artworks: [] };
    const result = this.loaded();
    return result.status === 'loaded' ? result.value : result.status === 'missing'
      ? INITIAL_RECORDS : { invoices: [], artworks: [] };
  });

  retryLoad(): void {
    this.writeError.set('');
    this.saved.set(null);
    this.retryVersion.update(value => value + 1);
  }
  private canWrite(): boolean {
    return !!this.key() && ['loaded', 'missing'].includes(this.loadStatus());
  }

  readonly profile = computed(() => {
    const student = this.student();
    return student
      ? { name: student.name, email: student.email, username: student.username }
      : null;
  });
  readonly courses = COURSES;
  readonly membership = MEMBERSHIP;
  readonly artworks = computed(() => this.records().artworks);
  private readonly artists = computed(() => {
    this.retryVersion();
    return this.auth.readStudentArtists();
  });
  private readonly listingLoads = computed(() => {
    this.retryVersion();
    const saved = this.saved();
    const artists = this.artists();
    if (!artists.ok) return [];
    return artists.value.map(artist => {
      const key = this.storageKey(artist.id);
      const result = key === this.key() ? this.loaded() : saved?.key === key
        ? { status: 'loaded' as const, value: saved.records }
        : this.storage.loadLocal(key, isStudentRecords);
      return { artist, result };
    });
  });
  readonly listingsError = computed(() => {
    if (!this.artists().ok) return loadError('unreadable', 'student artist accounts');
    const failed = this.listingLoads().find(({ result }) =>
      result.status === 'invalid' || result.status === 'unreadable');
    return failed ? loadError(failed.result.status, 'student artwork listings') : '';
  });
  readonly publicListings = computed(() => this.listingLoads().flatMap(({ artist, result }) =>
    result.status === 'loaded'
      ? result.value.artworks.map(artwork => ({ ...artwork, artist: artist.name })) : []));

  readonly fees = computed(() =>
    !this.recordsAvailable() ? [] : FEES.map((fee) => {
      const invoice = this.records().invoices.find((item) => item.feeId === fee.id);
      return { ...fee, invoice, balance: invoice?.paidOn ? 0 : fee.amount };
    }),
  );
  readonly invoices = computed(() =>
    this.fees().flatMap((fee) =>
      fee.invoice
        ? [
            {
              ...fee.invoice,
              label: fee.label,
              type: fee.type,
              amount: fee.amount,
              dueDate: fee.dueDate,
            },
          ]
        : [],
    ),
  );
  readonly paymentHistory = computed(() =>
    this.invoices()
      .filter((invoice) => invoice.paidOn)
      .sort((a, b) => (b.paidOn ?? '').localeCompare(a.paidOn ?? '')),
  );
  readonly outstanding = computed(() => this.recordsAvailable()
    ? this.fees().reduce((sum, fee) => sum + fee.balance, 0) : null);
  readonly sales = SALES.map((sale) => {
    const commission = Math.round(sale.price * sale.commissionRate * 100) / 100;
    return { ...sale, commission, earnings: sale.price - commission };
  });
  readonly earnings = this.sales.reduce((sum, sale) => sum + sale.earnings, 0);

  createInvoice(feeId: string): string | null {
    this.writeError.set('');
    if (!this.canWrite() || !FEES.some((fee) => fee.id === feeId)) return null;
    const records = this.records();
    const existing = records.invoices.find((invoice) => invoice.feeId === feeId);
    if (existing) return existing.id;
    const id = `INV-${feeId.toUpperCase()}`;
    return this.save({
      ...records,
      invoices: [...records.invoices, { id, feeId, issuedOn: this.today(), paidOn: null }],
    }) ? id : null;
  }

  payInvoice(id: string): boolean {
    this.writeError.set('');
    if (!this.canWrite()) return false;
    const records = this.records();
    return this.save({
      ...records,
      invoices: records.invoices.map((invoice) =>
        invoice.id === id && !invoice.paidOn ? { ...invoice, paidOn: this.today() } : invoice,
      ),
    });
  }

  saveArtwork(draft: ArtworkDraft, id?: string): boolean {
    this.writeError.set('');
    if (!this.canWrite()) return false;
    const title = draft.title.trim();
    const description = draft.description.trim();
    const imageUrl = draft.imageUrl.trim();
    const price = Math.round(draft.price * 100) / 100;
    if (
      !this.key() ||
      !title ||
      !description ||
      !Number.isFinite(price) ||
      price <= 0 ||
      !['Painting', 'Print', 'Other'].includes(draft.category) ||
      !(
        /^https?:\/\/\S+$/i.test(imageUrl) ||
        (imageUrl.length <= 666_700 &&
          /^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(imageUrl))
      )
    ) {
      return false;
    }

    const records = this.records();
    if (id && !records.artworks.some((artwork) => artwork.id === id)) return false;
    const artwork = {
      ...draft,
      id: id ?? crypto.randomUUID(),
      title,
      description,
      price,
      imageUrl,
    };
    return this.save({
      ...records,
      artworks: id
        ? records.artworks.map((item) => (item.id === id ? artwork : item))
        : [...records.artworks, artwork],
    });
  }

  removeArtwork(id: string): boolean {
    this.writeError.set('');
    if (!this.canWrite()) return false;
    const records = this.records();
    return this.save({ ...records, artworks: records.artworks.filter((artwork) => artwork.id !== id) });
  }

  private save(records: StudentRecords): boolean {
    this.writeError.set('');
    const key = this.key();
    if (!key || !this.canWrite()) return false;
    if (!this.storage.setLocal(key, records)) {
      this.writeError.set('Your changes could not be saved. Browser storage may be full or blocked. Your previous data has been kept. Please free storage or allow site storage, then try again.');
      return false;
    }
    this.saved.set({ key, records });
    return true;
  }

  private storageKey(id: string): string {
    return `artspace_student_v1_${id}`;
  }

  private today(): string {
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }
}
