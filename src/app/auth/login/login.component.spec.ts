import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { AutofocusModule } from '../../modules/autofocus/autofocus.module';

import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing'

import { Router, ActivatedRoute, Data, UrlSegment } from '@angular/router';

import { of } from 'rxjs';

import { LoginComponent } from './login.component';

import { AuthenticationFailedError } from '../../models/errors/AuthenticationFailedError';

describe('LoginComponent', () => {
  let router: Router;
  let activatedRoute: ActivatedRoute;
  let httpTestingController: HttpTestingController;

  let activatedRouteStub: Partial<ActivatedRoute>;

  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  beforeEach(async(() => {
    activatedRouteStub = {
      data: of<Data>({}),
      url: of<UrlSegment[]>([ new UrlSegment('login', {}) ])
    }

    TestBed.configureTestingModule({
      declarations: [ LoginComponent ],
      imports:      [ 
        HttpClientTestingModule,
        RouterTestingModule.withRoutes(
          [
            { path: 'login', component: LoginComponent, data: {} }
          ]
        ),
        ReactiveFormsModule,
        AutofocusModule 
      ],
      // https://github.com/angular/angular/issues/15779
      providers: [ { provide: ActivatedRoute, useValue: activatedRouteStub} ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
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

  it('should take focus on email input if email route data is empty after content init', () => {
    let inputDe = fixture.debugElement.query(By.css('input[name="email"]'));

    let input = inputDe.nativeElement;

    expect(document.activeElement).toBe(input);
  });

  it('should fill email input and take focus on password input if email route data is filled after component init', () => {
    let email = 'tester@crypter.com';

    let route = router.config.find(r => r.path === 'login');

    route.data['email'] = email;

    activatedRoute.data = of<Data>(route.data);

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();


    let emailInputDe = fixture.debugElement.query(By.css('input[name="email"]'));
    let emailInput = emailInputDe.nativeElement;

    let passwordInputDe = fixture.debugElement.query(By.css('input[name="password"]'));
    let passwordInput = passwordInputDe.nativeElement;

    expect(emailInput.value).toBe(email);
    expect(document.activeElement).toBe(passwordInput);
  });

  it('should login by setting localStorage and navigate to root url', () => {
    let email = 'tester@crypter.com';
    let password = 'secret';

    let req;
    let navigateSpy;

    router = fixture.debugElement.injector.get(Router);
    navigateSpy = spyOn(router, 'navigate');

    component.form.get('email').setValue(email);
    component.form.get('password').setValue(password);

    fixture.detectChanges();


    let formDe = fixture.debugElement.query(By.css('form'));

    formDe.triggerEventHandler('ngSubmit', new Event('submit'));

    req = httpTestingController.expectOne('/api/login');

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

  it('should handle AuthenticationError', () => {
    let email = 'tester@crypter.com';
    let password = 'secret';

    component.form.get('email').setValue(email);
    component.form.get('password').setValue(password);

    fixture.detectChanges();


    let formDe = fixture.debugElement.query(By.css('form'));

    let form = formDe.nativeElement;

    formDe.triggerEventHandler('ngSubmit', new Event('submit'));


    let req = httpTestingController.expectOne('/api/login');

    req.flush('Not Found', { status: 404, statusText: 'Not Found' });

    fixture.detectChanges();

    expect(form.textContent).toContain(new AuthenticationFailedError().message);
  });

  it('should handle any http error', () => {
    let email = 'tester@crypter.com';
    let password = 'secret';

    component.form.get('email').setValue(email);
    component.form.get('password').setValue(password);

    fixture.detectChanges();


    let formDe = fixture.debugElement.query(By.css('form'));

    let form = formDe.nativeElement;

    formDe.triggerEventHandler('ngSubmit', new Event('submit'));


    let url = '/api/login';

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