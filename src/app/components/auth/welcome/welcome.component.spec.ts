import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { AutofocusModule } from '../../../modules/autofocus/autofocus.module';

import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing'

import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { WelcomeComponent } from './welcome.component';

describe('WelcomeComponent', () => {
  let router: Router;
  let httpTestingController: HttpTestingController;

  let component: WelcomeComponent;
  let fixture: ComponentFixture<WelcomeComponent>;

  @Component({template: ''})
  class DummyLoginComponent {}

  @Component({template: ''})
  class DummyRegistrationComponent {}

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ WelcomeComponent, DummyLoginComponent, DummyRegistrationComponent ],
      imports:      [ 
        HttpClientTestingModule,
        RouterTestingModule.withRoutes(
          [
            { path: 'login', component: DummyLoginComponent, data: {} },
            { path: 'registration', component: DummyRegistrationComponent, data: {} }
          ]
        ),
        ReactiveFormsModule,
        AutofocusModule 
      ]
    })
    .compileComponents();

    router = TestBed.get(Router);
    httpTestingController = TestBed.get(HttpTestingController);

    fixture = TestBed.createComponent(WelcomeComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it("should validate email error", () => {
    let invalidEmail = 'tester.com'

    component.form.get('email').setValue(invalidEmail);

    fixture.detectChanges();

    let inputDe = fixture.debugElement.query(By.css('input[name="email"]'));
    let input = inputDe.nativeElement;

    expect(input.classList.contains('ng-invalid')).toBeTruthy();
  });

  it("should validate required input", () => {
    let email = '';

    component.form.get('email').setValue(email);

    fixture.detectChanges();

    let formDe = fixture.debugElement.query(By.css('form'));
    let form = formDe.nativeElement;

    expect(form.classList.contains('ng-invalid')).toBeTruthy();
  });

  it('should take focus on email input after content init', () => {
    let inputDe = fixture.debugElement.query(By.css('input[name="email"]'));

    let input = inputDe.nativeElement;

    expect(document.activeElement).toBe(input);
  });

  it("should depending on response of email existence set data of respective route and redirect to it", () => {
    let email = 'tester@crypter.com';

    let req;
    let route;
    let navigateSpy;

    router = fixture.debugElement.injector.get(Router);
    navigateSpy = spyOn(router, 'navigate');

    component.form.get('email').setValue(email);

    fixture.detectChanges();

    let formDe = fixture.debugElement.query(By.css('form'));

    formDe.triggerEventHandler('ngSubmit', new Event('submit'));
    req = httpTestingController.expectOne(`/api/auth/email/${email}`);
    req.flush('OK', { status: 200, statusText: 'OK' });
    route = router.config.find(r => r.path === 'login');
    expect(route.data['email']).toEqual(email);
    expect(navigateSpy).toHaveBeenCalledWith(['login']);

    formDe.triggerEventHandler('ngSubmit', new Event('submit'));
    req = httpTestingController.expectOne(`/api/auth/email/${email}`);
    req.flush('Not Found', { status: 404, statusText: 'Not Found' });
    route = router.config.find(r => r.path === 'registration');
    expect(route.data['email']).toEqual(email);
    expect(navigateSpy).toHaveBeenCalledWith(['login']);
  });

  it("should handle any http error", () => {
    let email = 'tester@crypter.com';

    let formDe = fixture.debugElement.query(By.css('form'));
    let form = formDe.nativeElement;


    component.form.get('email').setValue(email);

    fixture.detectChanges();

    formDe.triggerEventHandler('ngSubmit', new Event('submit'));


    let url = `/api/auth/email/${email}`;

    const emsg = 'simulated network error';

    const req = httpTestingController.expectOne(url);

    // Create mock ErrorEvent, raised when something goes wrong at the network level.
    // Connection timeout, DNS error, offline, etc
    const mockError = new ErrorEvent('Network error', {
      message: emsg,
    });

    // Respond with mock error
    req.error(mockError);

    fixture.detectChanges();

    let e = new HttpErrorResponse({ error: mockError, status: 0, url, statusText: '' });

    expect(form.textContent).toContain(e.message);
  });
});
