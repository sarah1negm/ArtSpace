import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './shared/navbar/navbar';
import { Footer } from './shared/footer/footer';
import { CookieBanner } from './shared/cookie-banner/cookie-banner';
import { AuthService } from './core/services/auth.service';
import { StorageService } from './core/services/storage.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Footer, CookieBanner],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  constructor() {
    const auth = inject(AuthService);
    const storage = inject(StorageService);
    auth.seedDemoUsers();

    effect(() => {
      const user = auth.currentUser();
      const theme = user?.preferences.theme ?? (storage.getCookie('artspace_theme') || 'light');
      document.documentElement.setAttribute('data-theme', theme);
      if (user && storage.getCookie('artspace_consent') === 'accepted') {
        storage.setCookie('artspace_theme', user.preferences.theme, 30);
      }
    });
  }
}