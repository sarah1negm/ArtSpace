import { Component } from '@angular/core';
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
      <router-outlet />
    </main>
  `,
})
export class AccountingShell {}
