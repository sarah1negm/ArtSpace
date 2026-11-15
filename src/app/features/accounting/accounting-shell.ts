import { Component, inject } from '@angular/core';
import { AccountingService } from './services/accounting.service';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-accounting-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  styleUrl: './accounting.scss',
  template: `
    <main class="portal">
      <nav aria-label="Accounting portal">
        <a
          routerLink="."
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
          ariaCurrentWhenActive="page"
          >Dashboard</a
        >
        <a routerLink="payroll" routerLinkActive="active" ariaCurrentWhenActive="page">Payroll</a>
        <a routerLink="payouts" routerLinkActive="active" ariaCurrentWhenActive="page"
          >Seller payouts</a
        >
        <a routerLink="budget" routerLinkActive="active" ariaCurrentWhenActive="page"
          >Department budget</a
        >
      </nav>
      @if (acc.storageError()) { <p role="alert">{{ acc.storageError() }}</p> }
      <router-outlet />
    </main>
  `,
})
export class AccountingShell { readonly acc = inject(AccountingService); }
