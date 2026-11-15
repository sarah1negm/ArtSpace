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
