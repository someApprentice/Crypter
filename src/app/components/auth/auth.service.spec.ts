import { TestBed } from '@angular/core/testing';

import { Injector  } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { AuthService } from './auth.service';

import { StorageService } from '../../services/storage/storage.service';
import { StorageWrapper } from '../../services/storage/StorageWrapper';

import { User } from '../../models/User';

describe('AuthService', () => {
  let injector: Injector;
  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;

  let service: AuthService;

  let storageService: StorageService;

  let storageServiceStub: Partial<StorageService>;

  beforeEach(() => {
    storageServiceStub = {
      storage: new StorageWrapper()
    };

    TestBed.configureTestingModule({
      providers: [ { provide: StorageService, useValue: storageServiceStub } ],
      imports: [ HttpClientTestingModule ]
    });

    injector = TestBed.get(Injector);
    httpClient = TestBed.get(HttpClient);
    httpTestingController = TestBed.get(HttpTestingController);

    service = TestBed.get(AuthService);

    storageService = TestBed.get(StorageService);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should set User property', () => {
    storageService.storage = new StorageWrapper(
      {
        uuid: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        email: 'tester@crypter.com',
        name: 'Tester',
        jwt: 'BmsjIrAJvqz9V3HD8GlQwMXKMJ4Qm_NHLOQWiUZO_HY'
      }
    );

    service = new AuthService(httpClient, storageService);

    expect(service.user).not.toBeUndefined();
  });

  it('should registrate, retrive User and set User property', () => {
    let email = 'tester@crypter.com';
    let name = 'Tester';
    let password = 'password';
    let publicKey = '-----BEGIN PGP PUBLIC KEY BLOCK ... ';
    let privateKey = '-----BEGIN PGP PRIVATE KEY BLOCK ... ';
    let revocationCertificate = '-----BEGIN PGP PUBLIC KEY BLOCK ... ';

    let user = <User> {
      uuid: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email,
      name,
      jwt: 'BmsjIrAJvqz9V3HD8GlQwMXKMJ4Qm_NHLOQWiUZO_HY',
      public_key: publicKey,
      private_key: privateKey,
      revocation_certificate: revocationCertificate
    }

    service.registrate(email, name, password, publicKey, privateKey, revocationCertificate).subscribe(d => {
      expect(service.user).not.toBeUndefined();
      expect(d).toEqual(user);
    });

    let req = httpTestingController.expectOne('/api/auth/registrate');

    expect(req.request.method).toEqual('POST');

    req.flush(user);
  });

  it('should login, retrive User and set User property', () => {
    let email = 'tester@crypter.com';
    let password = 'password';

    let user = <User> {
      uuid: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email,
      name,
      jwt: 'BmsjIrAJvqz9V3HD8GlQwMXKMJ4Qm_NHLOQWiUZO_HY'
    }

    service.login(email, password).subscribe(d => {
      expect(service.user).not.toBeUndefined();
      expect(d).toEqual(user);
    });

    let req = httpTestingController.expectOne('/api/auth/login');

    expect(req.request.method).toEqual('POST');

    req.flush(user);
  });

  it('should logout, retrive true and set User property to undefined', () => {
    storageService.storage = new StorageWrapper(
      {
        uuid: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        email: 'tester@crypter.com',
        name: 'Tester',
        jwt: 'BmsjIrAJvqz9V3HD8GlQwMXKMJ4Qm_NHLOQWiUZO_HY'
      }
    );

    service = new AuthService(httpClient, storageService);

    service.logout().subscribe(d => {
      expect(service.user).toBeUndefined();
      expect(d).toEqual(true);
    });

    let req = httpTestingController.expectOne('/api/auth/logout');

    expect(req.request.method).toEqual('POST');
    expect(req.request.headers.has('Authorization')).toBeTruthy();
    expect(req.request.headers.get('Authorization')).toEqual(`Bearer ${storageService.storage.jwt}`);

    req.flush('OK');
  });

  it('should get response of email existence', () => {
    let email = 'tester@crypter.com';

    let req;

    let isEmailExist$;

    isEmailExist$ = service.isEmailExist(email).subscribe(d => {
      expect(d).toBeTruthy();
    });
    req = httpTestingController.expectOne(`/api/auth/email/${email}`);
    expect(req.request.method).toEqual('GET');
    req.flush('OK', { status: 200, statusText: 'OK' });
    isEmailExist$.unsubscribe();


    isEmailExist$ = service.isEmailExist(email).subscribe(d => {
      expect(d).toBeFalsy();
    });
    req = httpTestingController.expectOne(`/api/auth/email/${email}`);
    expect(req.request.method).toEqual('GET');
    req.flush('Not Found', { status: 404, statusText: 'Not Found' });
    isEmailExist$.unsubscribe();
  });
});
