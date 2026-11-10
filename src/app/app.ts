import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './shared/navbar/navbar';
import { Footer } from './shared/footer/footer';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Footer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  constructor() {
    const auth = inject(AuthService);
    auth.seedDemoUsers();
    effect(() => {
      document.documentElement.setAttribute('data-theme', auth.currentUser()?.preferences.theme ?? 'light');
    });
  }
}