import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../core/services/auth.service';
import { StudentService } from '../student.service';
import { ArtworkManagement } from './artwork-management';

describe('Student artwork form', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({ imports: [ArtworkManagement] });
    const auth = TestBed.inject(AuthService);
    await auth.seedDemoUsers();
    await auth.login('student1', 'Pass1234', false);
  });
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('accepts an uploaded image, edits its listing and confirms deletion', async () => {
    const fixture = TestBed.createComponent(ArtworkManagement);
    fixture.detectChanges();
    const page: HTMLElement = fixture.nativeElement;
    const fileInput = page.querySelector<HTMLInputElement>('input[type=file]')!;
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([new Uint8Array([137, 80, 78, 71])], 'art.png', { type: 'image/png' }),
    );
    const read = FileReader.prototype.readAsDataURL;
    const completed = new Promise<void>((resolve) => {
      spyOn(FileReader.prototype, 'readAsDataURL').and.callFake(function (
        this: FileReader,
        blob: Blob,
      ) {
        this.addEventListener('loadend', () => resolve(), { once: true });
        read.call(this, blob);
      });
    });
    fileInput.files = transfer.files;
    fileInput.dispatchEvent(new Event('change'));
    await completed;
    fixture.detectChanges();
    expect(page.textContent).toContain('Selected image: art.png');
    const fill = (name: string, value: string) => {
      const input = page.querySelector<HTMLInputElement>(`[formControlName="${name}"]`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    fill('title', 'Uploaded art');
    fill('description', 'A study');
    fill('price', '123.45');
    const submit = () => {
      page
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      fixture.detectChanges();
    };
    submit();
    const students = TestBed.inject(StudentService);
    expect(students.artworks()[0].imageUrl).toMatch(/^data:image\/png;base64,/);
    const click = (text: string) => {
      Array.from(page.querySelectorAll('button'))
        .find((b) => b.textContent?.trim() === text)!
        .click();
      fixture.detectChanges();
    };
    click('Edit');
    expect(document.activeElement).toBe(page.querySelector('[formControlName="title"]'));
    expect(page.textContent).toContain('Edit listing');
    fill('title', 'Updated upload');
    submit();
    expect(students.artworks().length).toBe(1);
    expect(students.artworks()[0].title).toBe('Updated upload');
    click('Remove');
    expect(page.textContent).toContain('Remove this listing from the Gallery?');
    click('Keep listing');
    expect(page.textContent).not.toContain('Confirm removal');
    click('Remove');
    expect(students.artworks().length).toBe(1);
    click('Confirm removal');
    expect(students.artworks()).toEqual([]);
    fixture.destroy();
  });

  it('rejects unsupported, oversized and empty image files', () => {
    const fixture = TestBed.createComponent(ArtworkManagement);
    fixture.detectChanges();
    const page: HTMLElement = fixture.nativeElement;
    const input = page.querySelector<HTMLInputElement>('input[type=file]')!;
    for (const file of [
      new File(['bad'], 'art.svg', { type: 'image/svg+xml' }),
      new File([new Uint8Array(500001)], 'large.png', { type: 'image/png' }),
      new File([], 'empty.png', { type: 'image/png' }),
    ]) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(page.querySelector('[role=alert]')!.textContent).toContain('up to 500 KB');
      expect(TestBed.inject(StudentService).artworks()).toEqual([]);
    }
    fixture.destroy();
  });
});
