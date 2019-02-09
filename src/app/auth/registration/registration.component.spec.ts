import { TestBed, ComponentFixture, async, fakeAsync, inject, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';


import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { AutofocusModule } from '../../modules/autofocus/autofocus.module';

import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing'

import { Location } from '@angular/common';
import { Router, ActivatedRoute, Data, UrlSegment } from '@angular/router';

import { of } from 'rxjs';


import { RegistrationComponent } from './registration.component';

describe('RegistrationComponent', () => {
  let router: Router;
  let activatedRoute: ActivatedRoute;
  let httpTestingController: HttpTestingController;

  let activatedRouteStub: Partial<ActivatedRoute>;

  let component: RegistrationComponent;
  let fixture: ComponentFixture<RegistrationComponent>;

  beforeEach(async(() => {
    activatedRouteStub = {
      data: of<Data>({}),
      url: of<UrlSegment[]>([ new UrlSegment('registration', {}) ])
    }

    TestBed.configureTestingModule({
      declarations: [ RegistrationComponent ],
      imports:      [ 
        HttpClientTestingModule,
        RouterTestingModule.withRoutes(
          [
            { path: 'registration', component: RegistrationComponent, data: {} }
          ]
        ),
        ReactiveFormsModule,
        AutofocusModule 
      ],
      // https://github.com/angular/angular/issues/15779
      providers: [ { provide: ActivatedRoute, useValue: activatedRouteStub} ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegistrationComponent);
    component = fixture.componentInstance;

    router = TestBed.get(Router);
    activatedRoute = TestBed.get(ActivatedRoute);
    httpTestingController = TestBed.get(HttpTestingController);

    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // should there be a tests of every validation behavior?

  it('should validate email existance error', () => {
    let email = 'tester@crypter.com'

    component.form.get('email').setValue(email);

    fixture.detectChanges();


    let inputDe = fixture.debugElement.query(By.css('input[name="email"]'));
    let input = inputDe.nativeElement;


    let req = httpTestingController.expectOne(`/api/email/${email}`);
    req.flush({ email, exist: true });

    fixture.detectChanges();

    expect(input.classList.contains('ng-invalid')).toBeTruthy();
  });

  it('should validate password match error', () => {
    let password = 'secret';
    let retryPassword = 'not-secret';

    component.form.get('password').setValue(password);
    component.form.get('retryPassword').setValue(retryPassword);

    fixture.detectChanges();


    let inputDe = fixture.debugElement.query(By.css('input[name="retryPassword"]'));
    let input = inputDe.nativeElement;

    expect(input.classList.contains('ng-invalid')).toBeTruthy();
  });

  it('should take focus on email input if email route data is empty after content init', () => {
    let inputDe = fixture.debugElement.query(By.css('input[name="email"]'));

    let input = inputDe.nativeElement;

    expect(document.activeElement).toBe(input);
  });


  it('should fill email input and take focus on name input if email route data is filled after component init', () => {
    let email = 'tester@crypter.com';

    let route = router.config.find(r => r.path === 'registration');

    route.data['email'] = email;

    activatedRoute.data = of<Data>(route.data);

    fixture = TestBed.createComponent(RegistrationComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();


    let emailInputDe = fixture.debugElement.query(By.css('input[name="email"]'));
    let emailInput = emailInputDe.nativeElement;

    let nameInputDe = fixture.debugElement.query(By.css('input[name="name"]'));
    let nameInput = nameInputDe.nativeElement;


    expect(emailInput.value).toBe(email);
    expect(document.activeElement).toBe(nameInput);
  });

  it('should registrate and login by setting localStorage and navigate to root url', () => {
    let email = 'tester@crypter.com';
    let name = "Tester";
    let password = 'secret';
    let retryPassword = 'secret';

    let req;
    let navigateSpy;

    router = fixture.debugElement.injector.get(Router);
    navigateSpy = spyOn(router, 'navigate');

    component.form.get('email').setValue(email);
    component.form.get('name').setValue(name);
    component.form.get('password').setValue(password);
    component.form.get('retryPassword').setValue(retryPassword);

    fixture.detectChanges();


    let formDe = fixture.debugElement.query(By.css('form'));

    formDe.triggerEventHandler('ngSubmit', new Event('submit'));

    req = httpTestingController.expectOne('/api/registrate');

    let user = {
      uuid: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email,
      name: 'Tester',
      jwt: 'BmsjIrAJvqz9V3HD8GlQwMXKMJ4Qm_NHLOQWiUZO_HY'
    };

    req.flush(user);

    expect(localStorage.getItem('uuid')).toEqual(user.uuid);
    expect(localStorage.getItem('email')).toEqual(user.email);
    expect(localStorage.getItem('name')).toEqual(user.name);
    expect(localStorage.getItem('jwt')).toEqual(user.jwt);

    expect(navigateSpy).toHaveBeenCalledWith(['']);
  });

  it('should handle any http error', () => {
    let email = 'tester@crypter.com';
    let name = "Tester";
    let password = 'secret';
    let retryPassword = 'secret';

    component.form.get('email').setValue(email);
    component.form.get('name').setValue(name);
    component.form.get('password').setValue(password);
    component.form.get('retryPassword').setValue(retryPassword);

    fixture.detectChanges();


    let formDe = fixture.debugElement.query(By.css('form'));

    let form = formDe.nativeElement;

    formDe.triggerEventHandler('ngSubmit', new Event('submit'));


    let url = '/api/registrate';

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
