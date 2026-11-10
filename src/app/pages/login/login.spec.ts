import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Login } from './login';

describe('Login', () => {
  let fixture: ComponentFixture<Login>;

  beforeEach(async () => {
    localStorage.clear(); sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('form is invalid when empty', () => {
    expect(fixture.componentInstance.form.invalid).toBeTrue();
  });

  it('shows an error for wrong credentials', async () => {
    fixture.componentInstance.form.setValue({ username: 'nobody', password: 'wrong', remember: false });
    await fixture.componentInstance.submit();
    expect(fixture.componentInstance.error()).toContain('Invalid');
  });
});