import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { RouterLink } from '@angular/router';
import { StudentService } from '../../features/student/student.service';

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile implements OnDestroy {
  private savedTimer?: ReturnType<typeof setTimeout>;
  auth = inject(AuthService);
  readonly student = inject(StudentService);
  readonly listings = this.student.artworks;
  private fb = inject(FormBuilder);

  editing = signal(false);
  saved = signal(false);
  picture = signal('');
  error = signal('');

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/)]],
    email: ['', [Validators.required, Validators.email]],
    theme: ['light' as 'light' | 'dark'],
    newsletter: [false],
  });

  roleAccess = computed(() => {
    switch (this.auth.role()) {
      case 'student': return ['Student dashboard', 'Course and studio fees', 'Invoices', 'Artwork listings', 'Sales and earnings'];
      case 'accountant': return ['Accounting dashboard', 'Staff payroll', 'Seller payouts', 'Department budget', 'Financial charts'];
      case 'admin': return ['Everything accountants can access', 'User management overview', 'School-wide reports'];
      default: return [];
    }
  });

  startEdit() {
    const u = this.auth.currentUser();
    if (!u) return;
    this.form.setValue({ name: u.name, email: u.email, theme: u.preferences.theme, newsletter: u.preferences.newsletter });
    this.picture.set(u.picture);
    this.error.set('');
    this.saved.set(false);
    this.editing.set(true);
  }

  onFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 300 * 1024) { this.error.set('Picture must be under 300 KB'); return; }
    this.error.set('');
    const reader = new FileReader();
    reader.onload = () => this.picture.set(reader.result as string);
    reader.onerror = () => this.error.set('The picture could not be read. Please choose it again.');
    reader.readAsDataURL(file);
  }

  save() {
    clearTimeout(this.savedTimer);
    this.saved.set(false);
    this.error.set('');
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const result = this.auth.updateProfile({
      name: v.name, email: v.email, picture: this.picture(),
      preferences: { theme: v.theme, newsletter: v.newsletter },
    });
    if (!result.ok) { this.error.set(result.error); return; }
    this.editing.set(false);
    this.saved.set(true);
    this.savedTimer = setTimeout(() => this.saved.set(false), 3000);
  }

  cancel() { this.editing.set(false); }
  ngOnDestroy(): void { clearTimeout(this.savedTimer); }
}
