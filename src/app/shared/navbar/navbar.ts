import { Component, inject, linkedSignal, signal } from '@angular/core';
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
  readonly logoutError = linkedSignal({
    source: () => this.auth.currentUser(),
    computation: () => '',
  });

  toggle() { this.menuOpen.update(v => !v); }
  logout() {
    this.logoutError.set('');
    const result = this.auth.logout();
    if (!result.ok) { this.logoutError.set(result.error); return; }
    this.menuOpen.set(false);
    this.router.navigate(['/']);
  }
}
