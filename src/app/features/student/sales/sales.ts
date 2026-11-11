import { CurrencyPipe, DatePipe, PercentPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { StudentService } from '../student.service';

@Component({
  selector: 'app-student-sales',
  imports: [CurrencyPipe, DatePipe, PercentPipe],
  styleUrl: '../student.scss',
  template: `
    <h1>Student sales</h1>
    <p>
      Expected earnings <strong>{{ student.earnings | currency: 'EGP' : 'code' }}</strong>
    </p>
    <div class="panel scroll" tabindex="0" role="region" aria-label="Sales history">
      <table>
        <thead>
          <tr>
            <th>Artwork</th>
            <th>Sold on</th>
            <th>Sale price</th>
            <th>ArtSpace commission</th>
            <th>Earnings</th>
          </tr>
        </thead>
        <tbody>
          @for (sale of student.sales; track sale.id) {
            <tr>
              <th scope="row">{{ sale.artworkTitle }}</th>
              <td>{{ sale.soldOn | date: 'mediumDate' }}</td>
              <td>{{ sale.price | currency: 'EGP' : 'code' }}</td>
              <td>
                {{ sale.commission | currency: 'EGP' : 'code' }} ({{
                  sale.commissionRate | percent
                }})
              </td>
              <td>{{ sale.earnings | currency: 'EGP' : 'code' }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class Sales {
  protected readonly student = inject(StudentService);
}
