import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Signup } from './signup';

describe('Signup', () => {
  let fixture: ComponentFixture<Signup>;
  let comp: Signup;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Signup],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(Signup);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(comp).toBeTruthy();
  });

  it('rejects a weak password', () => {
    comp.form.controls.password.setValue('abc');
    expect(comp.form.controls.password.invalid).toBeTrue();
  });

  it('rejects a card number that is not 16 digits', () => {
    comp.form.controls.cardNumber.setValue('1234');
    expect(comp.form.controls.cardNumber.invalid).toBeTrue();
  });

  it('flags mismatched passwords', () => {
    comp.form.patchValue({ password: 'Pass1234', confirm: 'Different1' });
    expect(comp.form.hasError('mismatch')).toBeTrue();
  });
});