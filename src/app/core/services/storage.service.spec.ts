import { TestBed } from '@angular/core/testing';
import { StorageService } from './storage.service';

describe('StorageService write results', () => {
  afterEach(() => {
    localStorage.removeItem('storage-test');
    sessionStorage.removeItem('storage-test');
  });
  it('returns true and keeps the existing JSON format for local and session writes', () => {
    const storage = TestBed.inject(StorageService);
    expect(storage.setLocal('storage-test', { amount: 20 })).toBeTrue();
    expect(storage.getLocal<unknown>('storage-test', null)).toEqual({ amount: 20 });
    expect(storage.setSession('storage-test', [1, 2])).toBeTrue();
    expect(storage.getSession<unknown>('storage-test', null)).toEqual([1, 2]);
  });
  for (const name of ['QuotaExceededError', 'SecurityError']) {
    it(`reports ${name} without throwing or overwriting existing values`, () => {
      localStorage.setItem('storage-test', '"previous"');
      sessionStorage.setItem('storage-test', '"previous"');
      const storage = TestBed.inject(StorageService);
      spyOn(Storage.prototype, 'setItem').and.callFake(() => {
        throw new DOMException('blocked', name);
      });
      expect(storage.setLocal('storage-test', 'new')).toBeFalse();
      expect(storage.setSession('storage-test', 'new')).toBeFalse();
      expect(storage.getLocal<unknown>('storage-test', null)).toBe('previous');
      expect(storage.getSession<unknown>('storage-test', null)).toBe('previous');
    });
  }
  it('reports serialization failure without changing an existing value', () => {
    const storage = TestBed.inject(StorageService);
    storage.setLocal('storage-test', 'previous');
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(storage.setLocal('storage-test', cyclic)).toBeFalse();
    expect(storage.getLocal<unknown>('storage-test', null)).toBe('previous');
  });
});

describe('StorageService cookie reads', () => {
  function cookies(value: string) {
    spyOnProperty(document, 'cookie', 'get').and.returnValue(value);
  }

  it('decodes valid values and preserves embedded equals signs', () => {
    cookies('username=Ada%20Lovelace; token=abc=def');
    const storage = TestBed.inject(StorageService);
    expect(storage.getCookie('username')).toBe('Ada Lovelace');
    expect(storage.getCookie('token')).toBe('abc=def');
  });

  for (const malformed of ['%', '%GG', '%E0%A4%A']) {
    it(`returns an empty fallback for malformed encoding ${malformed} without changing cookies`, () => {
      const raw = `broken=${malformed}; safe=hello%20world`;
      cookies(raw);
      const write = spyOnProperty(document, 'cookie', 'set');
      const storage = TestBed.inject(StorageService);
      expect(storage.getCookie('broken')).toBe('');
      expect(storage.getCookie('safe')).toBe('hello world');
      expect(document.cookie).toBe(raw);
      expect(write).not.toHaveBeenCalled();
    });
  }

  it('handles empty, missing and multiple cookies using exact names', () => {
    cookies('prefix_name=wrong;name=; other=value; name_suffix=wrong');
    const storage = TestBed.inject(StorageService);
    expect(storage.getCookie('name')).toBe('');
    expect(storage.getCookie('missing')).toBe('');
    expect(storage.getCookie('other')).toBe('value');
  });

  it('handles browsers that deny cookie reads', () => {
    spyOnProperty(document, 'cookie', 'get').and.throwError(new DOMException('Blocked', 'SecurityError'));
    expect(TestBed.inject(StorageService).getCookie('artspace_theme')).toBe('');
  });
});

describe('StorageService cookie write results', () => {
  afterEach(() => {
    document.cookie = 'cookie-write-test=; max-age=0; path=/';
    document.cookie = 'cookie-unrelated=; max-age=0; path=/';
  });

  it('confirms encoded writes and deletion without changing unrelated cookies', () => {
    const storage = TestBed.inject(StorageService);
    document.cookie = 'cookie-unrelated=keep; path=/';
    expect(storage.setCookie('cookie-write-test', 'Ada = 100%')).toBeTrue();
    expect(storage.getCookie('cookie-write-test')).toBe('Ada = 100%');
    expect(storage.deleteCookie('cookie-write-test')).toBeTrue();
    expect(storage.getCookie('cookie-write-test')).toBe('');
    expect(storage.getCookie('cookie-unrelated')).toBe('keep');
  });

  for (const operation of ['setCookie', 'deleteCookie'] as const) {
    it(`returns false when ${operation} throws and permits retry`, () => {
      const storage = TestBed.inject(StorageService);
      document.cookie = 'cookie-write-test=previous; path=/';
      const write = spyOnProperty(document, 'cookie', 'set')
        .and.throwError(new DOMException('Blocked', 'SecurityError'));
      const attempt = () => operation === 'setCookie'
        ? storage.setCookie('cookie-write-test', 'next') : storage.deleteCookie('cookie-write-test');
      expect(attempt()).toBeFalse();
      expect(storage.getCookie('cookie-write-test')).toBe('previous');
      write.and.callThrough();
      expect(attempt()).toBeTrue();
      expect(storage.getCookie('cookie-write-test')).toBe(operation === 'setCookie' ? 'next' : '');
    });

    it(`detects silently ignored ${operation} operations`, () => {
      document.cookie = 'cookie-write-test=previous; path=/';
      spyOnProperty(document, 'cookie', 'set').and.stub();
      const storage = TestBed.inject(StorageService);
      expect(operation === 'setCookie'
        ? storage.setCookie('cookie-write-test', 'next') : storage.deleteCookie('cookie-write-test')).toBeFalse();
      expect(storage.getCookie('cookie-write-test')).toBe('previous');
    });
  }

  it('does not report success when read-back verification is blocked', () => {
    spyOnProperty(document, 'cookie', 'set').and.stub();
    spyOnProperty(document, 'cookie', 'get').and.throwError(new DOMException('Blocked', 'SecurityError'));
    const storage = TestBed.inject(StorageService);
    expect(storage.setCookie('cookie-write-test', '')).toBeFalse();
    expect(storage.deleteCookie('cookie-write-test')).toBeFalse();
  });
});
