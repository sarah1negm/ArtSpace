import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { StorageService } from '../../core/services/storage.service';
import { COURSES, FEES, INITIAL_RECORDS, MEMBERSHIP, SALES } from './student.mock';
import { ArtworkDraft, StudentRecords } from './student.models';

@Injectable({ providedIn: 'root' })
export class StudentService {
  private readonly auth = inject(AuthService);
  private readonly storage = inject(StorageService);
  private readonly student = computed(() => {
    const user = this.auth.currentUser();
    return user?.role === 'student' ? user : null;
  });
  private readonly key = computed(() => {
    const student = this.student();
    return student ? `artspace_student_v1_${student.id}` : null;
  });
  private readonly saved = signal<{ key: string; records: StudentRecords } | null>(null);
  private readonly records = computed(() => {
    const key = this.key();
    const saved = this.saved();
    if (!key) return { invoices: [], artworks: [] };
    return saved?.key === key ? saved.records : this.storage.getLocal(key, INITIAL_RECORDS);
  });

  readonly profile = computed(() => {
    const student = this.student();
    return student
      ? { name: student.name, email: student.email, username: student.username }
      : null;
  });
  readonly courses = COURSES;
  readonly membership = MEMBERSHIP;
  readonly artworks = computed(() => this.records().artworks);
  readonly fees = computed(() =>
    FEES.map((fee) => {
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
  readonly outstanding = computed(() => this.fees().reduce((sum, fee) => sum + fee.balance, 0));
  readonly sales = SALES.map((sale) => {
    const commission = Math.round(sale.price * sale.commissionRate * 100) / 100;
    return { ...sale, commission, earnings: sale.price - commission };
  });
  readonly earnings = this.sales.reduce((sum, sale) => sum + sale.earnings, 0);

  createInvoice(feeId: string): string | null {
    if (!this.key() || !FEES.some((fee) => fee.id === feeId)) return null;
    const records = this.records();
    const existing = records.invoices.find((invoice) => invoice.feeId === feeId);
    if (existing) return existing.id;
    const id = `INV-${feeId.toUpperCase()}`;
    this.save({
      ...records,
      invoices: [...records.invoices, { id, feeId, issuedOn: this.today(), paidOn: null }],
    });
    return id;
  }

  payInvoice(id: string): void {
    const records = this.records();
    this.save({
      ...records,
      invoices: records.invoices.map((invoice) =>
        invoice.id === id && !invoice.paidOn ? { ...invoice, paidOn: this.today() } : invoice,
      ),
    });
  }

  saveArtwork(draft: ArtworkDraft, id?: string): boolean {
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
      !/^https?:\/\/\S+$/i.test(imageUrl)
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
    this.save({
      ...records,
      artworks: id
        ? records.artworks.map((item) => (item.id === id ? artwork : item))
        : [...records.artworks, artwork],
    });
    return true;
  }

  removeArtwork(id: string): void {
    const records = this.records();
    this.save({ ...records, artworks: records.artworks.filter((artwork) => artwork.id !== id) });
  }

  private save(records: StudentRecords): void {
    const key = this.key();
    if (!key) return;
    this.storage.setLocal(key, records);
    this.saved.set({ key, records });
  }

  private today(): string {
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }
}
