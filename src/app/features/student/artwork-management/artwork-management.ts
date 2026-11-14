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
    <section class="panel">
      <h2>{{ editingId() ? 'Edit listing' : 'Add a listing' }}</h2>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <label>Title <input formControlName="title" required maxlength="100" /></label>
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
          >Price (EGP) <input type="number" formControlName="price" required min="0.01" step="0.01"
        /></label>
        <label
          >Image URL
          <input type="text" inputmode="url" formControlName="imageUrl" placeholder="https://"
        /></label>
        <label>
          Or choose an image file (JPEG, PNG, WebP or GIF, up to 500 KB)
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
          <button type="submit" [disabled]="readingImage()">
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
            <button type="button" (click)="edit(artwork)">Edit</button>
            @if (removingId() === artwork.id) {
              <button type="button" (click)="remove(artwork)">Confirm removal</button>
              <button type="button" (click)="removingId.set(null)">Keep listing</button>
            } @else {
              <button type="button" (click)="removingId.set(artwork.id)">Remove</button>
            }
          </div>
        </article>
      } @empty {
        <p>No artwork listings yet.</p>
      }
    </div>
  `,
})
export class ArtworkManagement {
  protected readonly student = inject(StudentService);
  protected readonly editingId = signal<string | null>(null);
  protected readonly removingId = signal<string | null>(null);
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
    price: [0, [Validators.required, Validators.min(0.01)]],
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
      file.size > 500_000 ||
      file.size === 0
    ) {
      this.error.set('Choose a JPEG, PNG, WebP or GIF image up to 500 KB.');
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

  protected submit(): void {
    if (this.readingImage()) return;
    const editingId = this.editingId();
    const draft = this.form.getRawValue();
    const imageUrl = draft.imageUrl.trim() || this.selectedImage;
    this.message.set('');
    if (
      this.form.invalid ||
      !this.student.saveArtwork({ ...draft, imageUrl }, editingId ?? undefined)
    ) {
      this.error.set(
        'Enter a title, description, positive price, and an image file or HTTP(S) URL.',
      );
      return;
    }
    this.reset();
    this.message.set(editingId ? 'Listing updated.' : 'Listing added.');
  }

  protected edit(artwork: Artwork): void {
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
  }

  protected reset(): void {
    this.cancelImageRead();
    this.selectedImage = '';
    this.fileName.set('');
    this.editingId.set(null);
    this.form.reset();
    this.error.set('');
  }

  private selectedImage = '';

  private cancelImageRead(): void {
    this.imageReader?.abort();
    this.readingImage.set(false);
  }

  protected remove(artwork: Artwork): void {
    this.student.removeArtwork(artwork.id);
    if (this.editingId() === artwork.id) this.reset();
    this.removingId.set(null);
    this.message.set('Listing removed.');
  }
}
