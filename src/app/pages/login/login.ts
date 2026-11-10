import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  error = signal('');
  private remembered = this.auth.getRememberedUsername();

  form = this.fb.nonNullable.group({
    username: [this.remembered, Validators.required],
    password: ['', Validators.required],
    remember: [!!this.remembered],
  });

  async submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const { username, password, remember } = this.form.getRawValue();
    const res = await this.auth.login(username, password, remember);
    if (res.ok) this.router.navigate(['/profile']);
    else this.error.set(res.error);
  }
}