import { TestBed, ComponentFixture, async } from '@angular/core/testing';

import { Component } from '@angular/core';

import { AuthService } from '../auth/auth.service';
import { StorageService } from '../storage.service';

import { MainComponent } from './main.component';

describe('MainComponent', () => {
  let authService: AuthService;
  let storageService: StorageService;

  let authServiceStub: Partial<AuthService>;
  let storageServiceStub: Partial<StorageService>;

  let component: MainComponent;
  let fixture: ComponentFixture<MainComponent>;

  beforeEach(async(() => {
    authServiceStub = {
      isLoggedIn: true
    };

    storageServiceStub = {
      storage: {
        uuid: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        email: 'tester@crypter.com',
        name: 'Tester',
        jwt: 'BmsjIrAJvqz9V3HD8GlQwMXKMJ4Qm_NHLOQWiUZO_HY'
      }
    };

    @Component({selector: 'app-welcome', template: ''})
    class WelcomeStubComponent {}

    TestBed.configureTestingModule({
      declarations: [ MainComponent, WelcomeStubComponent ],
      providers:    [ 
        { provide: AuthService, useValue: authServiceStub },
        { provide: StorageService, useValue: storageServiceStub }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MainComponent);
    component = fixture.componentInstance;

    authService = TestBed.get(AuthService);
    storageService = TestBed.get(StorageService);

    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render a welcome message with name of logged User', () => {
    let el: HTMLElement = fixture.nativeElement;

    let name = storageService.storage.name;

    expect(el.textContent).toContain(`Welcome, ${name}`);
  });

  it('should render WelcomeComponent if User logged off', () => {
    authService.isLoggedIn = false;

    fixture.detectChanges();

    let el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('app-welcome')).not.toBeNull();
  });
});
