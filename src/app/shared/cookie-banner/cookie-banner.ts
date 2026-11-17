import { Component, inject, signal } from '@angular/core';
import { StorageService } from '../../core/services/storage.service';

@Component({
  selector: 'app-cookie-banner',
  templateUrl: './cookie-banner.html',
  styleUrl: './cookie-banner.scss',
})
export class CookieBanner {
  private storage = inject(StorageService);
  visible = signal(this.storage.getCookie('artspace_consent') === '');
  readonly error = signal('');

  choose(value: 'accepted' | 'declined') {
    this.error.set('');
    if (!this.storage.setCookie('artspace_consent', value, 365)) {
      this.error.set('Your cookie choice could not be saved. Cookies may be blocked. You can keep using ArtSpace; allow site cookies and try again to remember your choice.');
      return;
    }
    this.visible.set(false);
  }
}
