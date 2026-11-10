import { TestBed } from '@angular/core/testing';
import { CookieBanner } from './cookie-banner';

describe('CookieBanner', () => {
  beforeEach(async () => {
    document.cookie = 'artspace_consent=; max-age=0; path=/';
    await TestBed.configureTestingModule({ imports: [CookieBanner] }).compileComponents();
  });

  it('is visible until the user chooses', () => {
    const comp = TestBed.createComponent(CookieBanner).componentInstance;
    expect(comp.visible()).toBeTrue();
  });

  it('stores the choice in a cookie and hides', () => {
    const comp = TestBed.createComponent(CookieBanner).componentInstance;
    comp.choose('accepted');
    expect(document.cookie).toContain('artspace_consent=accepted');
    expect(comp.visible()).toBeFalse();
  });
});