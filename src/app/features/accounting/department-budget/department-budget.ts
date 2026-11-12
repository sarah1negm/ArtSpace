import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { CHART_COLORS, ChartComponent } from '../chart/chart';
import { AccountingService, monthLabel } from '../services/accounting.service';

@Component({
  selector: 'app-accounting-department-budget',
  imports: [CurrencyPipe, ChartComponent],
  styleUrl: '../accounting.scss',
  template: `
    <h1>Department budget</h1>
    <p>Gallery department: marketplace commission plus other income, minus running costs.</p>

    <div class="grid">
      <div class="panel">
        <span>Gallery income</span>
        <strong class="metric">{{ acc.galleryTotals().income | currency: 'EGP' : 'code' : '1.0-0' }}</strong>
      </div>
      <div class="panel">
        <span>Gallery expenses</span>
        <strong class="metric">{{ acc.galleryTotals().expenses | currency: 'EGP' : 'code' : '1.0-0' }}</strong>
      </div>
      <div class="panel">
        <span>Profit</span>
        <strong class="metric" [class.pos]="acc.galleryTotals().profit >= 0" [class.neg]="acc.galleryTotals().profit < 0">
          {{ acc.galleryTotals().profit | currency: 'EGP' : 'code' : '1.0-0' }}
        </strong>
      </div>
    </div>

    <section class="panel">
      <h2>Monthly summary</h2>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th class="num">Gross sales</th>
              <th class="num">Commission</th>
              <th class="num">Other income</th>
              <th class="num">Expenses</th>
              <th class="num">Profit</th>
            </tr>
          </thead>
          <tbody>
            @for (m of acc.galleryMonthly(); track m.month) {
              <tr>
                <td>{{ m.label }}</td>
                <td class="num">{{ m.gross | currency: 'EGP' : 'code' : '1.0-0' }}</td>
                <td class="num">{{ m.commission | currency: 'EGP' : 'code' : '1.0-0' }}</td>
                <td class="num">{{ m.otherIncome | currency: 'EGP' : 'code' : '1.0-0' }}</td>
                <td class="num">{{ m.expenses | currency: 'EGP' : 'code' : '1.0-0' }}</td>
                <td class="num" [class.pos]="m.profit >= 0" [class.neg]="m.profit < 0">
                  {{ m.profit | currency: 'EGP' : 'code' : '1.0-0' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>Income vs expenses</h2>
      <app-chart type="bar" label="Gallery income and expenses per month" [labels]="labels()" [datasets]="datasets()" />
    </section>

    <section class="panel">
      <h2>Income &amp; expense entries</h2>
      <form class="inline-form" (submit)="add($event, type.value, month.value, desc, amount)">
        <label>
          Type
          <select #type>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </label>
        <label>
          Month
          <select #month>
            @for (m of acc.months; track m) {
              <option [value]="m" [selected]="m === acc.months[acc.months.length - 1]">{{ m }}</option>
            }
          </select>
        </label>
        <label>Description <input #desc type="text" required /></label>
        <label>Amount (EGP) <input #amount type="number" min="1" step="50" required /></label>
        <button type="submit">Add entry</button>
      </form>
      @if (message()) {
        <p role="status">{{ message() }}</p>
      }
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Type</th>
              <th>Description</th>
              <th class="num">Amount</th>
              <th><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (e of entries(); track e.id) {
              <tr>
                <td>{{ monthName(e.month) }}</td>
                <td>{{ e.type }}</td>
                <td>{{ e.label }}</td>
                <td class="num">{{ e.amount | currency: 'EGP' : 'code' : '1.0-2' }}</td>
                <td><button type="button" (click)="acc.removeLedgerEntry(e.id)">Remove {{ e.label }}</button></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class DepartmentBudget {
  protected readonly acc = inject(AccountingService);
  protected readonly message = signal('');
  protected readonly monthName = monthLabel;

  protected readonly labels = computed(() => this.acc.galleryMonthly().map((m) => m.label));
  protected readonly datasets = computed(() => [
    { label: 'Income', data: this.acc.galleryMonthly().map((m) => m.income), backgroundColor: CHART_COLORS[2] },
    { label: 'Expenses', data: this.acc.galleryMonthly().map((m) => m.expenses), backgroundColor: CHART_COLORS[3] },
  ]);
  protected readonly entries = computed(() =>
    [...this.acc.ledger()].sort((a, b) => b.month.localeCompare(a.month)),
  );

  protected add(
    e: Event, type: string, month: string, desc: HTMLInputElement, amount: HTMLInputElement,
  ): void {
    e.preventDefault();
    const ok = this.acc.addLedgerEntry({
      type: type === 'income' ? 'income' : 'expense',
      month,
      label: desc.value,
      amount: amount.valueAsNumber,
    });
    if (ok) {
      desc.value = '';
      amount.value = '';
    }
    this.message.set(ok ? 'Entry added.' : 'Enter a description and an amount above zero.');
  }
}
