import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Artwork, ArtworkDraft } from '../student.models';
import { StudentService } from '../student.service';

@Component({
  selector: 'app-student-artwork',
  imports: [CurrencyPipe, ReactiveFormsModule],
  styleUrl: '../student.scss',
  template: `
    <h1>Artwork listings</h1>
    @if (!student.recordsAvailable()) {
      <p role="alert">Student records are unavailable. {{ student.storageError() }}</p>
      <button type="button" (click)="student.retryLoad()">Retry loading student records</button>
    } @else {
    <section class="panel">
      <h2>{{ editingId() ? 'Edit listing' : 'Add a listing' }}</h2>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <label>Title <input #listingTitle formControlName="title" required maxlength="100" /></label>
        <label
          >Description
          <textarea formControlName="description" required maxlength="1000" rows="3"></textarea>
        </label>
        <label
          >Category
          <select formControlName="category">
            <option>Painting</option>
            <option>Print</option>
            <option>Other</option>
          </select>
        </label>
        <label
          >Price (EGP)
          <input type="number" formControlName="price" required min="0.01"
            [max]="maxPrice" step="0.01" aria-describedby="listing-price-limit" />
          <span id="listing-price-limit">Maximum {{ maxPrice | currency: 'EGP' : 'code' : '1.0-0' }}</span>
        </label>
        <label
          >Image URL
          <input type="text" inputmode="url" formControlName="imageUrl" placeholder="https://"
        /></label>
        <label>
          Or choose an image file (JPEG, PNG, WebP or GIF, up to {{ imageLimitLabel }})
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            (change)="chooseImage($event)"
          />
        </label>
        @if (fileName()) {
          <p>Selected image: {{ fileName() }}</p>
        }
        @if (error()) {
          <p role="alert">{{ error() }}</p>
        }
        <div class="actions">
          <button type="submit" [disabled]="readingImage() || student.busy()">
            {{ editingId() ? 'Save changes' : 'Add listing' }}
          </button>
          @if (editingId()) {
            <button type="button" (click)="reset()">Cancel edit</button>
          }
        </div>
      </form>
    </section>
    <p role="status">{{ message() }}</p>
    <div class="grid">
      @for (artwork of student.artworks(); track artwork.id) {
        <article class="panel">
          @if (failedImages().get(artwork.id) === artwork.imageUrl) {
            <div
              class="image-placeholder"
              role="img"
              [attr.aria-label]="'Image unavailable for ' + artwork.title"
            >
              Image unavailable
            </div>
          } @else {
            <img
              [src]="artwork.imageUrl"
              [alt]="artwork.title"
              loading="lazy"
              (error)="imageFailed(artwork)"
            />
          }
          <h2>{{ artwork.title }}</h2>
          <p>{{ artwork.category }} · {{ artwork.price | currency: 'EGP' : 'code' }}</p>
          <p>{{ artwork.description }}</p>
          <div class="actions">
            <a [href]="'/gallery/' + artwork.id">View in Gallery</a>
            <button type="button" (click)="edit(artwork, listingTitle)">Edit</button>
            @if (removingId() === artwork.id) {
              <button type="button" [disabled]="student.busy()" (click)="remove(artwork)">Confirm removal</button>
              <button type="button" [disabled]="student.busy()" (click)="confirmRemoval(null)">Keep listing</button>
            } @else {
              <button type="button" [disabled]="student.busy()" (click)="confirmRemoval(artwork.id)">Remove</button>
            }
          </div>
          @if (removingId() === artwork.id) {
            <p role="status">Remove this listing from the Gallery?</p>
            @if (removalError()) {
              <p role="alert">{{ removalError() }}</p>
            }
          }
        </article>
      } @empty {
        <p>No artwork listings yet.</p>
      }
    </div>
    }
  `,
})
export class ArtworkManagement {
  protected readonly student = inject(StudentService);
  protected readonly maxPrice = 10_000_000;
  private readonly imageLimit = this.student.api ? 2 * 1024 * 1024 : 500_000;
  protected readonly imageLimitLabel = this.student.api ? '2 MB' : '500 KB';
  protected readonly editingId = signal<string | null>(null);
  protected readonly removingId = signal<string | null>(null);
  protected readonly removalError = signal('');
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly fileName = signal('');
  protected readonly readingImage = signal(false);
  protected readonly failedImages = signal(new Map<string, string>());
  private imageReader?: FileReader;
  protected readonly form = inject(NonNullableFormBuilder).group({
    title: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.required, Validators.maxLength(1000)]],
    category: ['Painting' as ArtworkDraft['category'], Validators.required],
    price: [0, [Validators.required, Validators.min(0.01), Validators.max(this.maxPrice)]],
    imageUrl: [''],
  });

  protected chooseImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.cancelImageRead();
    if (
      !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) ||
      file.size > this.imageLimit ||
      file.size === 0
    ) {
      this.error.set(`Choose a JPEG, PNG, WebP or GIF image up to ${this.imageLimitLabel}.`);
      return;
    }
    if (this.student.api) {
      this.selectedFile = file;
      this.fileName.set(file.name);
      this.error.set('');
      this.form.controls.imageUrl.setValue('');
      return;
    }
    const reader = new FileReader();
    this.imageReader = reader;
    this.readingImage.set(true);
    this.error.set('');
    reader.onload = () => {
      this.selectedImage = String(reader.result);
      this.readingImage.set(false);
      this.fileName.set(file.name);
      this.form.controls.imageUrl.setValue('');
    };
    reader.onerror = () => {
      this.readingImage.set(false);
      this.error.set('The image file could not be read.');
    };
    reader.readAsDataURL(file);
  }

  protected imageFailed(artwork: Artwork): void {
    this.failedImages.update((images) => new Map(images).set(artwork.id, artwork.imageUrl));
  }

  protected async submit(): Promise<void> {
    if (this.readingImage()) return;
    const editingId = this.editingId();
    const draft = this.form.getRawValue();
    const imageUrl = draft.imageUrl.trim() || this.selectedImage;
    this.message.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set(this.form.controls.price.hasError('max')
        ? 'Enter a price of EGP 10,000,000 or less.'
        : 'Enter a title, description, and positive price.');
      return;
    }
    if (!editingId && !imageUrl && !this.selectedFile) {
      if (!this.error()) this.error.set('Choose an image file or enter an HTTP(S) image URL.');
      return;
    }
    const id = editingId ?? undefined;
    const saved = this.student.api
      ? await this.student.api.saveArtwork({ ...draft, imageUrl }, id, imageUrl ? undefined : this.selectedFile)
      : this.student.saveArtwork({ ...draft, imageUrl }, id);
    if (!saved) {
      this.error.set(this.student.storageError() || 'Enter a title, description, positive price, and an image file or HTTP(S) URL.');
      return;
    }
    this.reset();
    this.message.set(editingId ? 'Listing updated.' : 'Listing added.');
  }

  protected edit(artwork: Artwork, titleInput: HTMLInputElement): void {
    this.reset();
    this.editingId.set(artwork.id);
    this.form.patchValue(artwork);
    if (artwork.imageUrl.startsWith('data:')) {
      this.selectedImage = artwork.imageUrl;
      this.fileName.set('Current uploaded image');
      this.form.controls.imageUrl.setValue('');
    }
    this.error.set('');
    this.message.set('');
    titleInput.focus({ preventScroll: true });
    titleInput.scrollIntoView({ block: 'center' });
  }

  protected confirmRemoval(id: string | null): void {
    this.removalError.set('');
    this.removingId.set(id);
  }

  protected reset(): void {
    this.cancelImageRead();
    this.selectedImage = '';
    this.selectedFile = undefined;
    this.fileName.set('');
    this.editingId.set(null);
    this.form.reset();
    this.error.set('');
  }

  private selectedImage = '';
  private selectedFile?: File;

  private cancelImageRead(): void {
    this.imageReader?.abort();
    this.readingImage.set(false);
  }

  protected async remove(artwork: Artwork): Promise<void> {
    this.message.set('');
    this.removalError.set('');
    const removed = this.student.api ? await this.student.api.removeArtwork(artwork.id) : this.student.removeArtwork(artwork.id);
    if (!removed) {
      this.removalError.set(this.student.storageError() || 'The listing could not be removed. Try again.');
      return;
    }
    this.error.set('');
    if (this.editingId() === artwork.id) this.reset();
    this.confirmRemoval(null);
    this.message.set('Listing removed.');
  }
}
