import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

function matchPasswords(group: AbstractControl): ValidationErrors | null {
  return group.get('password')?.value === group.get('confirm')?.value ? null : { mismatch: true };
}

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.scss',
})
export class Signup {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  picture = signal('');
  serverError = signal('');
  readonly submitting = signal(false);

  form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3), Validators.pattern(/^[a-zA-Z0-9_]+$/)]],
    name: ['', [Validators.required, Validators.pattern(/\S/)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/)]],
    confirm: ['', Validators.required],
    cardNumber: ['', [Validators.required, Validators.pattern(/^\d{16}$/)]],
    theme: ['light' as 'light' | 'dark'],
    newsletter: [false],
  }, { validators: matchPasswords });

  get f() { return this.form.controls; }

  onFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 300 * 1024) { this.serverError.set('Picture must be under 300 KB'); return; }
    this.serverError.set('');
    const reader = new FileReader();
    reader.onload = () => this.picture.set(reader.result as string);
    reader.onerror = () => this.serverError.set('The picture could not be read. Please choose it again.');
    reader.readAsDataURL(file);
  }

  async submit() {
    if (this.submitting()) return;
    this.serverError.set('');
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    try {
      const v = this.form.getRawValue();
      const res = await this.auth.signup({
        username: v.username, name: v.name, email: v.email, picture: this.picture(),
        password: v.password, cardNumber: v.cardNumber, newsletter: v.newsletter, theme: v.theme,
      });
      if (res.ok) this.router.navigate(['/login']);
      else this.serverError.set(res.error);
    } finally { this.submitting.set(false); }
  }
}