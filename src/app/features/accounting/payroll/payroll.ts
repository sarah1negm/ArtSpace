import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { PayrollReport } from '../accounting.models';
import { AccountingService } from '../services/accounting.service';

@Component({
  selector: 'app-accounting-payroll',
  imports: [CurrencyPipe],
  styleUrl: '../accounting.scss',
  template: `
    <h1>Staff payroll</h1>

    <section class="panel">
      <h2>Teachers &amp; staff</h2>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th class="num">Base</th>
              <th class="num">Allowances</th>
              <th class="num">Deductions</th>
              <th class="num">Net salary</th>
              <th><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (p of acc.payroll(); track p.id) {
              <tr>
                <td>{{ p.name }}</td>
                <td>{{ p.role }} · {{ p.title }}</td>
                <td class="num">{{ p.baseSalary | currency: 'EGP' : 'code' : '1.0-0' }}</td>
                <td class="num">{{ p.totalAllowances | currency: 'EGP' : 'code' : '1.0-0' }}</td>
                <td class="num">{{ p.totalDeductions | currency: 'EGP' : 'code' : '1.0-0' }}</td>
                <td class="num">
                  <strong>{{ p.netSalary | currency: 'EGP' : 'code' : '1.0-0' }}</strong>
                </td>
                <td>
                  <button type="button" (click)="selectedId.set(p.id)">Manage {{ p.name }}</button>
                </td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <th colspan="5">Total monthly payroll</th>
              <th class="num">{{ acc.totalPayroll() | currency: 'EGP' : 'code' : '1.0-0' }}</th>
              <th></th>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>

    @if (selected(); as s) {
      <section class="panel" aria-live="polite">
        <h2>Manage {{ s.name }}</h2>
        <p>
          Net salary = base + allowances − deductions =
          <strong>{{ s.netSalary | currency: 'EGP' : 'code' : '1.0-2' }}</strong>
        </p>

        <form class="inline-form" (submit)="saveBase($event, base)">
          <label>
            Base salary (EGP)
            <input #base type="number" min="0" step="50" [value]="s.baseSalary" />
          </label>
          <button type="submit">Save base salary</button>
        </form>

        @for (kind of kinds; track kind.key) {
          <h3>{{ kind.title }}</h3>
          <ul>
            @for (a of s[kind.key]; track a.id) {
              <li>
                {{ a.label }}: {{ a.amount | currency: 'EGP' : 'code' : '1.0-2' }}
                <button type="button" (click)="acc.removeAdjustment(s.id, kind.key, a.id)">
                  Remove {{ a.label }}
                </button>
              </li>
            } @empty {
              <li class="muted">None</li>
            }
          </ul>
          <form class="inline-form" (submit)="add($event, s.id, kind.key, lbl, amt)">
            <label>Label <input #lbl type="text" required /></label>
            <label>Amount <input #amt type="number" min="1" step="10" required /></label>
            <button type="submit">{{ kind.add }}</button>
          </form>
        }
        @if (message()) {
          <p role="status">{{ message() }}</p>
        }
      </section>
    }

    <section class="panel">
      <h2>Monthly salary report (JSON)</h2>
      <form class="inline-form" (submit)="generate($event, month.value)">
        <label>
          Month
          <select #month>
            @for (m of acc.months; track m) {
              <option [value]="m" [selected]="m === acc.months[acc.months.length - 1]">{{ m }}</option>
            }
          </select>
        </label>
        <button type="submit">Generate report</button>
        @if (report()) {
          <button type="button" (click)="download()">Download JSON</button>
        }
      </form>
      @if (reportJson(); as json) {
        <pre class="report" tabindex="0" aria-label="Generated salary report">{{ json }}</pre>
      }
    </section>
  `,
})
export class Payroll {
  protected readonly acc = inject(AccountingService);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selected = computed(() => this.acc.payroll().find((p) => p.id === this.selectedId()) ?? null);
  protected readonly message = signal('');
  protected readonly report = signal<PayrollReport | null>(null);
  protected readonly reportJson = computed(() => {
    const r = this.report();
    return r ? JSON.stringify(r, null, 2) : '';
  });
  protected readonly kinds = [
    { key: 'allowances', title: 'Allowances', add: 'Add allowance' },
    { key: 'deductions', title: 'Deductions', add: 'Add deduction' },
  ] as const;

  protected saveBase(e: Event, input: HTMLInputElement): void {
    e.preventDefault();
    const id = this.selectedId();
    const ok = !!id && this.acc.setBaseSalary(id, input.valueAsNumber);
    this.message.set(ok ? 'Base salary updated.' : 'Enter a valid salary.');
  }

  protected add(
    e: Event, id: string, kind: 'allowances' | 'deductions',
    label: HTMLInputElement, amount: HTMLInputElement,
  ): void {
    e.preventDefault();
    if (this.acc.addAdjustment(id, kind, label.value, amount.valueAsNumber)) {
      label.value = '';
      amount.value = '';
      this.message.set('Saved.');
    } else {
      this.message.set('Enter a label and an amount above zero.');
    }
  }

  protected generate(e: Event, month: string): void {
    e.preventDefault();
    this.report.set(this.acc.generateReport(month));
  }

  protected download(): void {
    const r = this.report();
    if (!r) return;
    const url = URL.createObjectURL(new Blob([this.reportJson()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `salary-report-${r.month}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
