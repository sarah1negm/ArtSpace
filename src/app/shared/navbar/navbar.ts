import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  auth = inject(AuthService);
  private router = inject(Router);
  menuOpen = signal(false);

  toggle() { this.menuOpen.update(v => !v); }
  logout() {
    this.auth.logout();
    this.menuOpen.set(false);
    this.router.navigate(['/']);
  }
}