import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { AccountingService } from '../services/accounting.service';

@Component({
  selector: 'app-accounting-seller-payouts',
  imports: [CurrencyPipe, DatePipe],
  styleUrl: '../accounting.scss',
  template: `
    <h1>Seller payouts</h1>
    <p>
      ArtSpace keeps a {{ acc.commissionRate * 100 }}% commission on every sale. The rest is paid out to the
      student who sold the artwork (simulated, no real payment).
    </p>

    <div class="grid">
      <div class="panel">
        <span>School commission</span>
        <strong class="metric">{{ acc.totalCommission() | currency: 'EGP' : 'code' : '1.0-2' }}</strong>
      </div>
      <div class="panel">
        <span>Pending payouts</span>
        <strong class="metric">{{ acc.pendingPayouts() | currency: 'EGP' : 'code' : '1.0-2' }}</strong>
      </div>
    </div>

    <section class="panel">
      <h2>Students who sold artwork</h2>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th class="num">Sales</th>
              <th class="num">Gross</th>
              <th class="num">Commission</th>
              <th class="num">Earnings</th>
              <th class="num">Pending</th>
              <th><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (s of acc.sellers(); track s.studentName) {
              <tr>
                <td>{{ s.studentName }}</td>
                <td class="num">{{ s.sales }}</td>
                <td class="num">{{ s.gross | currency: 'EGP' : 'code' : '1.0-2' }}</td>
                <td class="num">{{ s.commission | currency: 'EGP' : 'code' : '1.0-2' }}</td>
                <td class="num">{{ s.earnings | currency: 'EGP' : 'code' : '1.0-2' }}</td>
                <td class="num">{{ s.pending | currency: 'EGP' : 'code' : '1.0-2' }}</td>
                <td>
                  <button type="button" [disabled]="s.pending === 0" (click)="payStudent(s.studentName)">
                    Pay all to {{ s.studentName }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p class="actions">
        <button type="button" [disabled]="acc.pendingPayouts() === 0" (click)="payAll()">
          Process all pending payouts
        </button>
        @if (message()) {
          <span role="status">{{ message() }}</span>
        }
      </p>
    </section>

    <section class="panel">
      <h2>Payout status by sale</h2>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Artwork</th>
              <th>Student</th>
              <th>Sold</th>
              <th class="num">Price</th>
              <th class="num">Commission</th>
              <th class="num">Student earns</th>
              <th>Status</th>
              <th><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (p of acc.payouts(); track p.id) {
              <tr>
                <td>{{ p.artworkTitle }}</td>
                <td>{{ p.studentName }}</td>
                <td>{{ p.soldOn | date: 'mediumDate' }}</td>
                <td class="num">{{ p.price | currency: 'EGP' : 'code' : '1.0-2' }}</td>
                <td class="num">{{ p.commission | currency: 'EGP' : 'code' : '1.0-2' }}</td>
                <td class="num">{{ p.earnings | currency: 'EGP' : 'code' : '1.0-2' }}</td>
                <td>
                  <span class="badge" [class.paid]="p.paidOn">{{ p.status }}</span>
                  @if (p.paidOn) {
                    <small class="muted">{{ p.paidOn | date: 'mediumDate' }}</small>
                  }
                </td>
                <td>
                  @if (!p.paidOn) {
                    <button type="button" (click)="pay(p.id, p.artworkTitle)">Pay {{ p.artworkTitle }}</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class SellerPayouts {
  protected readonly acc = inject(AccountingService);
  protected readonly message = signal('');

  protected pay(id: string, title: string): void {
    if (this.acc.processPayout(id)) this.message.set(`Payout for “${title}” processed.`);
  }
  protected payStudent(name: string): void {
    const n = this.acc.processStudentPayouts(name);
    this.message.set(`${n} payout(s) processed for ${name}.`);
  }
  protected payAll(): void {
    this.message.set(`${this.acc.processAllPayouts()} payout(s) processed.`);
  }
}
