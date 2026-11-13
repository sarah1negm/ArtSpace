import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CHART_COLORS, ChartComponent } from '../chart/chart';
import { AccountingService } from '../services/accounting.service';

@Component({
  selector: 'app-accounting-dashboard',
  imports: [CurrencyPipe, RouterLink, ChartComponent],
  styleUrl: '../accounting.scss',
  template: `
    <h1>Accounting dashboard</h1>

    <div class="grid">
      <div class="panel">
        <span>Total school income</span>
        <strong class="metric">{{ acc.totals().income | currency: 'EGP' : 'code' : '1.0-0' }}</strong>
      </div>
      <div class="panel">
        <span>Total expenses</span>
        <strong class="metric">{{ acc.totals().expenses | currency: 'EGP' : 'code' : '1.0-0' }}</strong>
      </div>
      <div class="panel">
        <a routerLink="../budget">Gallery revenue</a>
        <strong class="metric">{{ acc.galleryTotals().income | currency: 'EGP' : 'code' : '1.0-0' }}</strong>
        <small class="muted">commission + other income</small>
      </div>
      <div class="panel">
        <a routerLink="../payouts">Pending seller payouts</a>
        <strong class="metric">{{ acc.pendingPayouts() | currency: 'EGP' : 'code' : '1.0-0' }}</strong>
      </div>
    </div>

    <section class="panel">
      <h2>Monthly financial summary</h2>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th class="num">Income</th>
              <th class="num">Expenses</th>
              <th class="num">Net</th>
            </tr>
          </thead>
          <tbody>
            @for (m of acc.monthly(); track m.month) {
              <tr>
                <td>{{ m.label }}</td>
                <td class="num">{{ m.income | currency: 'EGP' : 'code' : '1.0-0' }}</td>
                <td class="num">{{ m.expenses | currency: 'EGP' : 'code' : '1.0-0' }}</td>
                <td class="num" [class.pos]="m.net >= 0" [class.neg]="m.net < 0">
                  {{ m.net | currency: 'EGP' : 'code' : '1.0-0' }}
                </td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <th>Total</th>
              <th class="num">{{ acc.totals().income | currency: 'EGP' : 'code' : '1.0-0' }}</th>
              <th class="num">{{ acc.totals().expenses | currency: 'EGP' : 'code' : '1.0-0' }}</th>
              <th class="num">{{ acc.totals().net | currency: 'EGP' : 'code' : '1.0-0' }}</th>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>

    <div class="charts">
      <section class="panel">
        <h2>Monthly income</h2>
        <app-chart type="bar" label="Monthly income in EGP" [labels]="labels()" [datasets]="income()" />
      </section>
      <section class="panel">
        <h2>Monthly expenses</h2>
        <app-chart type="bar" label="Monthly expenses in EGP" [labels]="labels()" [datasets]="expenses()" />
      </section>
      <section class="panel">
        <h2>Gallery revenue</h2>
        <app-chart type="line" label="Gallery revenue in EGP" [labels]="labels()" [datasets]="gallery()" />
      </section>
      <section class="panel">
        <h2>Salary distribution</h2>
        <app-chart
          type="doughnut"
          label="Net salary by employee"
          [labels]="staffNames()"
          [datasets]="salaries()"
        />
      </section>
      <section class="panel">
        <h2>Sales &amp; commission</h2>
        <app-chart type="bar" label="Gallery sales and commission in EGP" [labels]="labels()" [datasets]="sales()" />
      </section>
    </div>
  `,
})
export class Dashboard {
  protected readonly acc = inject(AccountingService);

  protected readonly labels = computed(() => this.acc.monthly().map((m) => m.label));
  protected readonly staffNames = computed(() => this.acc.payroll().map((p) => p.name));
  protected readonly income = computed(() => [
    { label: 'Income', data: this.acc.monthly().map((m) => m.income), backgroundColor: CHART_COLORS[2] },
  ]);
  protected readonly expenses = computed(() => [
    { label: 'Expenses', data: this.acc.monthly().map((m) => m.expenses), backgroundColor: CHART_COLORS[3] },
  ]);
  protected readonly gallery = computed(() => [
    {
      label: 'Gallery revenue',
      data: this.acc.galleryMonthly().map((m) => m.income),
      borderColor: CHART_COLORS[0],
      backgroundColor: CHART_COLORS[0],
      tension: 0.3,
    },
  ]);
  protected readonly salaries = computed(() => [
    {
      label: 'Net salary',
      data: this.acc.payroll().map((p) => p.netSalary),
      backgroundColor: CHART_COLORS,
    },
  ]);
  protected readonly sales = computed(() => [
    { label: 'Gross sales', data: this.acc.galleryMonthly().map((m) => m.gross), backgroundColor: CHART_COLORS[1] },
    { label: 'Commission', data: this.acc.galleryMonthly().map((m) => m.commission), backgroundColor: CHART_COLORS[0] },
  ]);
}
