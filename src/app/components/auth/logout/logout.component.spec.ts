import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { HttpClient, HttpErrorResponse } from '@angular/common/http';

import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { Router } from '@angular/router';

import { User } from '../../../models/user.model'

import { LogoutComponent } from './logout.component';

describe('LogoutComponent', () => {
  let router: Router;
  let httpTestingController: HttpTestingController;

  let routerSpy;

  let component: LogoutComponent;
  let fixture: ComponentFixture<LogoutComponent>;

  let user = <User> {
    uuid: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    email: 'tester@crypter.com',
    name: 'Tester',
    jwt: 'BmsjIrAJvqz9V3HD8GlQwMXKMJ4Qm_NHLOQWiUZO_HY'
  };

  beforeEach(async(() => {
    localStorage.setItem('uuid', user.uuid);
    localStorage.setItem('email', user.email);
    localStorage.setItem('name', user.name);
    localStorage.setItem('jwt', user.jwt);

    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      declarations: [ LogoutComponent ],
      imports:      [ HttpClientTestingModule ],
      providers:    [ { provide: Router, useValue: routerSpy} ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LogoutComponent);
    component = fixture.componentInstance;

    router = TestBed.get(Router);
    httpTestingController = TestBed.get(HttpTestingController);

    fixture.detectChanges();
  }));

  afterEach(() => {
    localStorage.removeItem('uuid');
    localStorage.removeItem('email');
    localStorage.removeItem('name');
    localStorage.removeItem('jwt');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should logout by setting localStorage and navigate to root url', () => {
    let formDe = fixture.debugElement.query(By.css('form'));

    formDe.triggerEventHandler('ngSubmit', new Event('submit'));


    let req = httpTestingController.expectOne('/api/auth/logout');

    expect(req.request.method).toEqual('POST');
    expect(req.request.headers.has('Authorization')).toBeTruthy();
    expect(req.request.headers.get('Authorization')).toEqual(`Bearer ${user.jwt}`);

    req.flush('OK');

    expect(localStorage.getItem('uuid')).toBeNull();
    expect(localStorage.getItem('email')).toBeNull();
    expect(localStorage.getItem('name')).toBeNull();
    expect(localStorage.getItem('jwt')).toBeNull();

    expect(router.navigate).toHaveBeenCalledWith(['']);
  });

  it('should handle any http error', () => {
    let formDe = fixture.debugElement.query(By.css('form'));

    let form = formDe.nativeElement;

    formDe.triggerEventHandler('ngSubmit', new Event('submit'));


    let url = '/api/auth/logout';

    const emsg = 'simulated network error';

    const req = httpTestingController.expectOne(url);

    expect(req.request.method).toEqual('POST');
    expect(req.request.headers.has('Authorization')).toBeTruthy();
    // expect(req.request.headers.get('Authorization')).toEqual(`Bearer ${user.jwt}`);

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
