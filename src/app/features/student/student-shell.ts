import { Component, inject } from '@angular/core';
import { StudentService } from './student.service';
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
      @if (student.loading()) {
        <p role="status">Loading student records…</p>
      } @else if (student.loadStatus() === 'unreadable' || student.loadStatus() === 'invalid') {
        <p role="alert">{{ student.storageError() }}</p>
        <button type="button" (click)="student.retryLoad()">Retry loading student records</button>
      }
      <router-outlet />
    </main>
  `,
})
export class StudentShell { readonly student = inject(StudentService); }
