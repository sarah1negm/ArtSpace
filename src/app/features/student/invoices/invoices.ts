import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { StudentService } from '../student.service';

@Component({
  selector: 'app-student-invoices',
  imports: [CurrencyPipe, DatePipe],
  styleUrl: '../student.scss',
  template: `
    <h1>Invoices</h1>
    <p role="status">{{ message() }}</p>
    @if (!student.recordsAvailable()) {
      <p role="alert">Student records are unavailable. {{ student.storageError() }}</p>
      <button type="button" (click)="student.retryLoad()">Retry loading student records</button>
    } @else {
    @if (student.storageError()) { <p role="alert">{{ student.storageError() }}</p> }
    @if (uninvoiced().length) {
      <section class="panel">
        <h2>Create an invoice</h2>
        <form (submit)="$event.preventDefault(); create(fee.value)">
          <label
            >Fee
            <select #fee required>
              @for (item of uninvoiced(); track item.id) {
                <option [value]="item.id">
                  {{ item.label }} · {{ item.amount | currency: 'EGP' : 'code' }}
                </option>
              }
            </select>
          </label>
          <button type="submit" [disabled]="student.busy()">Create invoice</button>
        </form>
      </section>
    }
    <div class="panel scroll" tabindex="0" role="region" aria-label="Invoices">
      <table>
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Fee</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          @for (invoice of student.invoices(); track invoice.id) {
            <tr>
              <td>
                <button type="button" (click)="selectedId.set(invoice.id)">{{ invoice.id }}</button>
              </td>
              <td>{{ invoice.label }}</td>
              <td>{{ invoice.amount | currency: 'EGP' : 'code' }}</td>
              <td>{{ invoice.paidOn ? 'Paid' : 'Unpaid' }}</td>
            </tr>
          } @empty {
            <tr>
              <td colspan="4">No invoices yet.</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    @if (selected(); as invoice) {
      <section class="panel" aria-live="polite">
        <h2>{{ invoice.id }}</h2>
        <dl>
          <dt>Fee</dt>
          <dd>{{ invoice.label }} ({{ invoice.type }})</dd>
          <dt>Amount</dt>
          <dd>{{ invoice.amount | currency: 'EGP' : 'code' }}</dd>
          <dt>Issued</dt>
          <dd>{{ invoice.issuedOn | date: 'mediumDate' }}</dd>
          <dt>Due</dt>
          <dd>{{ invoice.dueDate | date: 'mediumDate' }}</dd>
          <dt>Payment date</dt>
          <dd>{{ (invoice.paidOn | date: 'mediumDate') ?? 'Unpaid' }}</dd>
        </dl>
        @if (!invoice.paidOn) {
          <button type="button" [disabled]="student.busy()" (click)="pay(invoice.id)">Simulate payment</button>
        }
      </section>
    }
    }
  `,
})
export class Invoices {
  protected readonly student = inject(StudentService);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selected = computed(() =>
    this.student.invoices().find((item) => item.id === this.selectedId()),
  );
  protected readonly uninvoiced = computed(() => this.student.fees().filter((fee) => !fee.invoice));

  protected readonly message = signal('');

  protected async create(feeId: string): Promise<void> {
    this.message.set('');
    const id = this.student.api
      ? (await this.student.api.createInvoice(feeId))?.id
      : this.student.createInvoice(feeId);
    if (id) {
      this.selectedId.set(id);
      this.message.set('Invoice created.');
    }
  }

  protected async pay(id: string): Promise<void> {
    this.message.set('');
    const paid = this.student.api ? await this.student.api.payInvoice(id) : this.student.payInvoice(id);
    if (paid) this.message.set('Simulated payment recorded.');
  }
}
