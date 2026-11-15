import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { StorageService } from '../../core/services/storage.service';
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
  private storage = inject(StorageService);
  readonly submitting = signal(false);

  error = signal('');
  private remembered = this.auth.getRememberedUsername();

  form = this.fb.nonNullable.group({
    username: [this.remembered, [Validators.required, Validators.pattern(/\S/)]],
    password: ['', Validators.required],
    remember: [!!this.remembered],
  });

  async submit() {
    if (this.submitting()) return;
    this.error.set('');
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    try {
      const { username, password, remember } = this.form.getRawValue();
      const res = await this.auth.login(username, password, remember);
      if (!res.ok) { this.error.set(res.error); return; }
      // A return-page hint is optional and must not break a persisted login.
      const back = this.storage.readSessionString('artspace_return');
      this.storage.removeSession('artspace_return');
      this.router.navigateByUrl(back.ok && back.value ? back.value : '/profile');
    } finally { this.submitting.set(false); }
  }
}