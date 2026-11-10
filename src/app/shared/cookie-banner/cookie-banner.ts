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

  choose(value: 'accepted' | 'declined') {
    this.storage.setCookie('artspace_consent', value, 365);
    this.visible.set(false);
  }
}