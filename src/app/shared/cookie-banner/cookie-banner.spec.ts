import { TestBed } from '@angular/core/testing';
import { CookieBanner } from './cookie-banner';
import { StorageService } from '../../core/services/storage.service';

describe('CookieBanner', () => {
  beforeEach(async () => {
    document.cookie = 'artspace_consent=; max-age=0; path=/';
    await TestBed.configureTestingModule({ imports: [CookieBanner] }).compileComponents();
  });

  afterEach(() => {
    document.cookie = 'artspace_consent=; max-age=0; path=/';
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

  it('shows the choice for malformed consent without changing unrelated cookies', () => {
    spyOnProperty(document, 'cookie', 'get').and.returnValue('artspace_consent=%; unrelated=keep');
    const write = spyOnProperty(document, 'cookie', 'set');
    const fixture = TestBed.createComponent(CookieBanner);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeTruthy();
    expect(write).not.toHaveBeenCalled();
  });

  for (const choice of ['accepted', 'declined'] as const) {
    for (const failure of ['throws', 'silently ignores']) {
      it(`retains the banner and accurate feedback when the browser ${failure} ${choice}, then allows retry`, () => {
        const fixture = TestBed.createComponent(CookieBanner);
        fixture.detectChanges();
        const write = spyOnProperty(document, 'cookie', 'set');
        if (failure === 'throws') write.and.throwError(new DOMException('Blocked', 'SecurityError'));
        else write.and.stub();
        const button = fixture.nativeElement.querySelector(choice === 'accepted' ? '.yes' : 'button:not(.yes)') as HTMLButtonElement;
        expect(button).not.toBeNull();
        button.click();
        fixture.detectChanges();
        expect(fixture.componentInstance.visible()).toBeTrue();
        expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('could not be saved');
        expect(TestBed.inject(StorageService).getCookie('artspace_consent')).toBe('');
        write.and.callThrough();
        button.click();
        fixture.detectChanges();
        expect(fixture.componentInstance.visible()).toBeFalse();
        expect(fixture.componentInstance.error()).toBe('');
        expect(TestBed.inject(StorageService).getCookie('artspace_consent')).toBe(choice);
        expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
      });
    }

    it(`recognizes encoded ${choice} consent`, () => {
      document.cookie = `artspace_consent=${choice === 'accepted' ? '%61ccepted' : '%64eclined'}; path=/`;
      expect(TestBed.createComponent(CookieBanner).componentInstance.visible()).toBeFalse();
    });

    it(`allows ${choice} after malformed consent`, () => {
      document.cookie = 'artspace_consent=%; path=/';
      const comp = TestBed.createComponent(CookieBanner).componentInstance;
      expect(comp.visible()).toBeTrue();
      comp.choose(choice);
      expect(TestBed.inject(StorageService).getCookie('artspace_consent')).toBe(choice);
      expect(comp.visible()).toBeFalse();
    });
  }
});
