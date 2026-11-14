import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ListingsService } from '../../features/marketplace/listings.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  auth = inject(AuthService);
  readonly studentListings = inject(ListingsService).studentListings;

  features = [
    { icon: '🎨', title: 'For students', text: 'Manage your courses and studio fees, and list your artwork for sale.' },
    { icon: '🖼️', title: 'For art lovers', text: 'Browse, search and buy original paintings and prints from student artists.' },
    { icon: '📊', title: 'For the school', text: 'Accounting, payroll, seller payouts and budgets with clear charts.' },
  ];

  artworks = [
    { id: 1, title: 'Morning Light', artist: 'Student Artist', price: 1200, image: 'https://picsum.photos/seed/art1/400/300' },
    { id: 2, title: 'Blue Studio', artist: 'Student Artist', price: 900, image: 'https://picsum.photos/seed/art2/400/300' },
    { id: 3, title: 'City Dreams', artist: 'Student Artist', price: 1500, image: 'https://picsum.photos/seed/art3/400/300' },
    { id: 4, title: 'Quiet Garden', artist: 'Student Artist', price: 750, image: 'https://picsum.photos/seed/art4/400/300' },
  ];
}
