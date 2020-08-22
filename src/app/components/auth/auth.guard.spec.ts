import { TestBed, async, inject } from '@angular/core/testing';

import { Router } from '@angular/router';

import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';

import User from '../../models/user.model';

describe('AuthGuard', () => {
  let authServiceStub: Partial<AuthService>;

  let guard: AuthGuard;

  beforeEach(() => {
    authServiceStub = {
      user: undefined
    };

    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceStub },
        { provide: Router, useValue: routerSpy }
      ]
    });

    guard = TestBed.get(AuthGuard);
  });

  it('should inject AuthGuard', () => {
    expect(guard).toBeTruthy();
  });

  it('should let access to route', () => {
    expect(guard.canActivate()).toBeTruthy();
  });

  it('should not let access to route', () => {
    let authService = TestBed.get(AuthService);

    authService.user = <User> {
      uuid: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email: 'tester@crypter.com',
      name: 'Tester',
      hash: 'BmsjIrAJvqz9V3HD8GlQwMXKMJ4Qm_NHLOQWiUZO_HY'
    };

    let router = TestBed.get(Router);

    guard = new AuthGuard(authService, router);

    expect(guard.canActivate()).toBeFalsy();
    expect(router.navigate).toHaveBeenCalled()
  });
});
