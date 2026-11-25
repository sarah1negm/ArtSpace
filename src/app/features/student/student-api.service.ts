import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, InjectionToken, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom, forkJoin } from 'rxjs';
import { AuthService, LOCAL_STUDENT_LOGIN } from '../../core/services/auth.service';
import { Artwork, ArtworkDraft, Fee, Invoice, Sale } from './student.models';

export const USE_STUDENT_API = new InjectionToken<boolean>('Use Laravel student APIs', {
  providedIn: 'root',
  factory: () => false,
});

interface DashboardData {
  profile: { id: string; username: string | null; name: string; email: string };
  courses: string[];
  membership: { name: string; expiresOn: string } | null;
  outstanding: number;
  totalPaid: number;
  earnings: number;
}

export interface InvoiceDetails extends Invoice {
  label: string;
  type: Fee['type'];
  dueDate: string;
  amount: number;
}

interface FeeData {
  fees: (Fee & { invoice: InvoiceDetails | null; balance: number })[];
  outstanding: number;
  paymentHistory: InvoiceDetails[];
}

interface SalesData {
  sales: (Sale & { commission: number; earnings: number; payoutStatus?: string })[];
  earnings: number;
}

export type PublicListing = Artwork & { artist: string };

@Injectable({ providedIn: 'root' })
export class StudentApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly localLogin = inject(LOCAL_STUDENT_LOGIN) && !inject(USE_STUDENT_API);
  private readonly base = '/api/student';
  private readonly studentId = computed(() => {
    const user = this.auth.currentUser();
    return user?.role === 'student' && (!this.localLogin || this.auth.serverStudent()) ? user.id : null;
  });
  private readonly data = signal<{
    studentId: string;
    dashboard: DashboardData;
    billing: FeeData;
    sales: SalesData;
    artworks: Artwork[];
    invoices: InvoiceDetails[];
  } | null>(null);

  readonly current = computed(() => {
    const data = this.data();
    return data && data.studentId === this.studentId() ? data : null;
  });
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly catalogueReady = signal(false);
  readonly catalogue = signal<PublicListing[]>([]);
  readonly catalogueError = signal('');
  private catalogueRequest = 0;
  private loadRequest = 0;

  constructor() {
    effect(() => {
      const studentId = this.studentId();
      untracked(() => {
        this.data.set(null);
        void this.load(studentId);
      });
    });
    void this.loadCatalogue();
  }

  async load(studentId = this.studentId()): Promise<void> {
    const request = ++this.loadRequest;
    this.error.set('');
    this.loading.set(studentId !== null);
    if (!studentId) return;

    try {
      const data = await firstValueFrom(forkJoin({
        dashboard: this.http.get<DashboardData>(this.base + '/dashboard'),
        billing: this.http.get<FeeData>(this.base + '/fees'),
        invoices: this.http.get<InvoiceDetails[]>(this.base + '/invoices'),
        sales: this.http.get<SalesData>(this.base + '/sales'),
        artworks: this.http.get<Artwork[]>(this.base + '/artworks'),
      }));
      if (request === this.loadRequest && studentId === this.studentId()) {
        if (this.localLogin && data.dashboard.profile.id !== studentId) {
          this.data.set(null);
          this.error.set('The Laravel account changed. Reload the page to restore the current session.');
          return;
        }
        this.data.set({ ...data, studentId });
      }
    } catch (error) {
      if (request === this.loadRequest) this.handleError(error);
    } finally {
      if (request === this.loadRequest) this.loading.set(false);
    }
  }

  async loadCatalogue(): Promise<void> {
    const request = ++this.catalogueRequest;
    this.catalogueError.set('');
    try {
      const listings = await firstValueFrom(this.http.get<PublicListing[]>('/api/artworks'));
      if (request === this.catalogueRequest) {
        this.catalogue.set(listings);
        this.catalogueReady.set(true);
      }
    } catch {
      if (request === this.catalogueRequest)
        this.catalogueError.set('Student artwork listings could not be loaded.');
    }
  }

  createInvoice(feeId: string) {
    return this.mutate(() =>
      firstValueFrom(this.http.post<InvoiceDetails>(this.base + '/invoices', { feeId })),
    );
  }

  payInvoice(id: string) {
    return this.mutate(() =>
      firstValueFrom(this.http.post<InvoiceDetails>(this.base + '/invoices/' + id + '/payments', {})),
    );
  }

  saveArtwork(draft: ArtworkDraft, id?: string, image?: File) {
    const form = new FormData();
    form.set('title', draft.title);
    form.set('description', draft.description);
    form.set('category', draft.category);
    form.set('price', String(draft.price));
    if (image) form.set('image', image);
    else if (draft.imageUrl && !draft.imageUrl.startsWith('/api/artwork-images/'))
      form.set('imageUrl', draft.imageUrl);
    if (id) form.set('_method', 'PATCH');
    return this.mutate(() =>
      firstValueFrom(this.http.post<Artwork>(this.base + '/artworks' + (id ? '/' + id : ''), form)),
      true,
    );
  }

  removeArtwork(id: string) {
    return this.mutate(async () => {
      await firstValueFrom(this.http.delete(this.base + '/artworks/' + id));
      return true;
    }, true);
  }

  private async mutate<T>(request: () => Promise<T>, refreshCatalogue = false): Promise<T | null> {
    const studentId = this.studentId();
    if (!studentId || this.busy()) return null;
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await request();
      await Promise.all([
        studentId === this.studentId() ? this.load(studentId) : undefined,
        refreshCatalogue ? this.loadCatalogue() : undefined,
      ]);
      return studentId === this.studentId() ? result : null;
    } catch (error) {
      if (studentId === this.studentId()) this.handleError(error);
      return null;
    } finally {
      this.busy.set(false);
    }
  }

  private handleError(error: unknown): void {
    if (error instanceof HttpErrorResponse && [401, 403, 419].includes(error.status)) {
      this.data.set(null);
    }
    this.error.set(this.describe(error));
  }

  private describe(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if ([401, 419].includes(error.status)) return 'Your server session has expired. Sign in and try again.';
      if (error.status === 422 && typeof error.error?.message === 'string') return error.error.message;
      if (error.status === 403) return 'This action requires a student account.';
    }
    return 'The student server request failed. Try again.';
  }
}
