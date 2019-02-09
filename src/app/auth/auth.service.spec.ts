import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';

import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { AuthService } from './auth.service';

import { StorageService } from '../storage.service';
import { StorageWrapper } from '../models/StorageWrapper';

import { User } from '../models/User';

import { AuthenticationFailedError } from '../models/errors/AuthenticationFailedError';

describe('AuthService', () => {
  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;

  let service: AuthService;

  let storageServiceStub: Partial<StorageService>;

  beforeEach(() => {
    storageServiceStub = {
      storage: new StorageWrapper()
    };

    TestBed.configureTestingModule({
      providers: [ { provide: StorageService, useValue: storageServiceStub } ],
      imports: [ HttpClientTestingModule ]
    });

    httpClient = TestBed.get(HttpClient);
    httpTestingController = TestBed.get(HttpTestingController);

    service = TestBed.get(AuthService);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should set isLoggedIn property to true', () => {
    storageServiceStub.storage = new StorageWrapper(
      {
        uuid: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        email: 'tester@crypter.com',
        name: 'Tester',
        jwt: 'BmsjIrAJvqz9V3HD8GlQwMXKMJ4Qm_NHLOQWiUZO_HY'
      }
    );

    service = new AuthService(httpClient, storageServiceStub as StorageService);

    expect(service.isLoggedIn).toBeTruthy();
  });

  it('should registrate, retrive User and set isLoggedIn property to true', () => {
    let email = 'tester@crypter.com';
    let name = 'Tester';
    let password = 'password';

    let user = <User> {
      uuid: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email,
      name,
      jwt: 'BmsjIrAJvqz9V3HD8GlQwMXKMJ4Qm_NHLOQWiUZO_HY'
    }

    service.registrate(email, name, password).subscribe(d => {
      expect(service.isLoggedIn).toBeTruthy();
      expect(d).toEqual(user);
    });

    let req = httpTestingController.expectOne('/api/registrate');

    expect(req.request.method).toEqual('POST');

    req.flush(user);
  });

  it('should login, retrive User and set isLoggedIn property to true', () => {
    let email = 'tester@crypter.com';
    let password = 'password';

    let user = <User> {
      uuid: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email,
      name,
      jwt: 'BmsjIrAJvqz9V3HD8GlQwMXKMJ4Qm_NHLOQWiUZO_HY'
    }

    service.login(email, password).subscribe(d => {
      expect(service.isLoggedIn).toBeTruthy();
      expect(d).toEqual(user);
    });

    let req = httpTestingController.expectOne('/api/login');

    expect(req.request.method).toEqual('POST');

    req.flush(user);
  });

  it('should throw AuthenticationFailedError while login', () => {
    let email = 'tester@crypter.com';
    let password = 'password';
    
    service.login(email, password).subscribe(
      d => fail('should have failed with the AuthenticationFailedError'),
      err => {
        expect(err).toEqual(jasmine.any(AuthenticationFailedError));
      }
    );

    let req = httpTestingController.expectOne('/api/login');

    expect(req.request.method).toEqual('POST');

    req.flush('Not Found', { status: 404, statusText: 'Not Found' });
  });

  it('should logout, retrive true and set isLoggedIn property to true', () => {

    service.logout().subscribe(d => {
      expect(service.isLoggedIn).toBeFalsy();
      expect(d).toEqual(true);
    });

    let req = httpTestingController.expectOne('/api/logout');

    expect(req.request.method).toEqual('POST');

    req.flush('OK');
  });

  it('should get response of email existence', () => {
    let email = 'tester@crypter.com';
    let exist = true;

    let res = { email, exist };

    service.isEmailExist(email).subscribe(d => {
      expect(typeof d).toEqual('boolean');
    });

    let req = httpTestingController.expectOne(`/api/email/${email}`);

    expect(req.request.method).toEqual('GET');

    req.flush(res);
  });

  it('should catch errors in the right way', () => {
    let dummyNotFoundError = { status: 404, statusText: 'Not Found' };

    service.handleErrors(dummyNotFoundError).subscribe(
      d => fail('should be failed i guess'),
      err => {
        expect(err).toEqual(jasmine.any(AuthenticationFailedError));
      }
    );

    let dummyFatalError = { status: 500, statusText: 'Internal Server Error' };

    service.handleErrors(dummyFatalError).subscribe(
      d => fail('should be failed i guess'),
      err => {
        expect(err).toEqual(dummyFatalError);
      }
    );
  });
});
