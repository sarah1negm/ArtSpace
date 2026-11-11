import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StudentService } from '../student.service';

@Component({
  selector: 'app-student-fees',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  styleUrl: '../student.scss',
  template: `
    <h1>Student fees</h1>
    <p>
      Outstanding balance <strong>{{ student.outstanding() | currency: 'EGP' : 'code' }}</strong>
    </p>
    <div class="panel scroll" tabindex="0" role="region" aria-label="Fees and balances">
      <table>
        <thead>
          <tr>
            <th>Fee</th>
            <th>Type</th>
            <th>Due</th>
            <th>Amount</th>
            <th>Balance</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          @for (fee of student.fees(); track fee.id) {
            <tr>
              <th scope="row">{{ fee.label }}</th>
              <td>{{ fee.type }}</td>
              <td>{{ fee.dueDate | date: 'mediumDate' }}</td>
              <td>{{ fee.amount | currency: 'EGP' : 'code' }}</td>
              <td>{{ fee.balance | currency: 'EGP' : 'code' }}</td>
              <td>{{ fee.balance ? 'Unpaid' : 'Paid' }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <p><a routerLink="../invoices">Manage invoices</a></p>
    <section class="panel">
      <h2>Payment history</h2>
      <ul>
        @for (payment of student.paymentHistory(); track payment.id) {
          <li>
            {{ payment.paidOn | date: 'mediumDate' }} · {{ payment.label }} ·
            {{ payment.amount | currency: 'EGP' : 'code' }}
          </li>
        } @empty {
          <li>No payments yet.</li>
        }
      </ul>
    </section>
  `,
})
export class Fees {
  protected readonly student = inject(StudentService);
}
