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
          >Image URL <input type="url" formControlName="imageUrl" required placeholder="https://"
        /></label>
        @if (error()) {
          <p role="alert">{{ error() }}</p>
        }
        <div class="actions">
          <button type="submit">{{ editingId() ? 'Save changes' : 'Add listing' }}</button>
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
          <img [src]="artwork.imageUrl" [alt]="artwork.title" loading="lazy" />
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
  protected readonly form = inject(NonNullableFormBuilder).group({
    title: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.required, Validators.maxLength(1000)]],
    category: ['Painting' as ArtworkDraft['category'], Validators.required],
    price: [0, [Validators.required, Validators.min(0.01)]],
    imageUrl: ['', Validators.required],
  });

  protected submit(): void {
    const editingId = this.editingId();
    this.message.set('');
    if (
      this.form.invalid ||
      !this.student.saveArtwork(this.form.getRawValue(), editingId ?? undefined)
    ) {
      this.error.set('Enter a title, description, positive price, and an HTTP or HTTPS image URL.');
      return;
    }
    this.reset();
    this.message.set(editingId ? 'Listing updated.' : 'Listing added.');
  }

  protected edit(artwork: Artwork): void {
    this.editingId.set(artwork.id);
    this.form.patchValue(artwork);
    this.error.set('');
    this.message.set('');
  }

  protected reset(): void {
    this.editingId.set(null);
    this.form.reset();
    this.error.set('');
  }

  protected remove(artwork: Artwork): void {
    this.student.removeArtwork(artwork.id);
    if (this.editingId() === artwork.id) this.reset();
    this.removingId.set(null);
    this.message.set('Listing removed.');
  }
}
