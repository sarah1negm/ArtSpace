import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StudentService } from '../student.service';

@Component({
  selector: 'app-student-dashboard',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  styleUrl: '../student.scss',
  template: `
    @if (student.profile(); as profile) {
      <h1>Welcome, {{ profile.name }}</h1>
      <p>{{ profile.username }} · {{ profile.email }}</p>
    }
    <div class="grid">
      <div class="panel">
        <a routerLink="fees">Outstanding fees</a>
        <strong class="metric">{{ student.outstanding() | currency: 'EGP' : 'code' }}</strong>
      </div>
      <div class="panel">
        <a routerLink="artwork">Artwork listings</a>
        <strong class="metric">{{ student.artworks().length }}</strong>
      </div>
      <div class="panel">
        <a routerLink="sales">Expected earnings</a>
        <strong class="metric">{{ student.earnings | currency: 'EGP' : 'code' }}</strong>
      </div>
    </div>
    <div class="grid">
      <section class="panel">
        <h2>Enrolled courses</h2>
        <ul>
          @for (course of student.courses; track course) {
            <li>{{ course }}</li>
          }
        </ul>
      </section>
      <section class="panel">
        <h2>Studio membership</h2>
        <p>{{ student.membership.name }}</p>
        <p>Expires {{ student.membership.expiresOn | date: 'mediumDate' }}</p>
      </section>
    </div>
  `,
})
export class Dashboard {
  protected readonly student = inject(StudentService);
}
