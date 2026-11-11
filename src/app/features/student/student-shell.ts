import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-student-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  styleUrl: './student.scss',
  template: `
    <main class="portal">
      <nav aria-label="Student portal">
        <a
          routerLink="."
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
          ariaCurrentWhenActive="page"
          >Dashboard</a
        >
        <a routerLink="fees" routerLinkActive="active" ariaCurrentWhenActive="page">Fees</a>
        <a routerLink="invoices" routerLinkActive="active" ariaCurrentWhenActive="page">Invoices</a>
        <a routerLink="artwork" routerLinkActive="active" ariaCurrentWhenActive="page">Artwork</a>
        <a routerLink="sales" routerLinkActive="active" ariaCurrentWhenActive="page">Sales</a>
      </nav>
      <router-outlet />
    </main>
  `,
})
export class StudentShell {}
