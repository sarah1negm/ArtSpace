import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile {
  auth = inject(AuthService);
  private fb = inject(FormBuilder);

  editing = signal(false);
  saved = signal(false);
  picture = signal('');
  error = signal('');

  form = this.fb.nonNullable.group({
    name: ['', Validators.required],
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
    this.editing.set(true);
  }

  onFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 300 * 1024) { this.error.set('Picture must be under 300 KB'); return; }
    this.error.set('');
    const reader = new FileReader();
    reader.onload = () => this.picture.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    this.auth.updateProfile({
      name: v.name, email: v.email, picture: this.picture(),
      preferences: { theme: v.theme, newsletter: v.newsletter },
    });
    this.editing.set(false);
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 3000);
  }

  cancel() { this.editing.set(false); }
}