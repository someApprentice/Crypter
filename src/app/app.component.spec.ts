import { TestBed, ComponentFixture, async, fakeAsync, inject, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { RouterTestingModule } from '@angular/router/testing';

import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';

import { of } from 'rxjs';

import { AuthService } from './components/auth/auth.service';

import { User } from './models/user.model';


import { AppComponent } from './app.component';

describe('AppComponent', () => {
  let router: Router;
  let activatedRoute: ActivatedRoute;
  let titleService: Title
  let authService: AuthService;

  let activatedRouteStub: Partial<ActivatedRoute>;
  let authServiceStub: Partial<AuthService>;

  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;

  beforeEach(async(() => {
    authServiceStub = {
      user: undefined
    };

    @Component({selector: 'app-main', template: ''})
    class MainStubComponent {}

    @Component({selector: 'app-title-test', template: ''})
    class TitleTestStubComponent {}

    @Component({selector: 'app-logout', template: ''})
    class LogoutStubComponent {}

    TestBed.configureTestingModule({
      imports:      [ 
        RouterTestingModule.withRoutes(
          [
            { path: '', component: MainStubComponent, data: {} },
            { path: 'test', component: MainStubComponent, data: { title: 'Test' } }
          ]
        )
      ],
      declarations: [ AppComponent, MainStubComponent, TitleTestStubComponent, LogoutStubComponent ],
      providers:    [
        { provide: Title, useClass: Title },
        { provide: AuthService, useValue: authServiceStub }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.debugElement.componentInstance;

    router = TestBed.get(Router);
    activatedRoute = TestBed.get(ActivatedRoute);
    titleService = TestBed.get(Title);
    authService = TestBed.get(AuthService);

    fixture.detectChanges();
  }));

  it('should create the app', () => {
    expect(component).toBeTruthy();
  });

  it('should render title in a h1 tag', () => {
    let h1De = fixture.debugElement.query(By.css('h1'));
    let h1 = h1De.nativeElement;

    expect(h1.textContent).toContain(component.title);
  });

  it('should render login and registration links if User is logged off or LogoutComponent if logged in ', () => {
    let loginLinkDe = fixture.debugElement.query(By.css('a[href="/login"]'));
    let registrationLinkDe = fixture.debugElement.query(By.css('a[href="/registration"]'));

    expect(loginLinkDe.nativeElement).not.toBeNull();
    expect(registrationLinkDe.nativeElement).not.toBeNull();


    authService.user = <User> {
      uuid: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email: 'tester@crypter.com',
      name: 'Tester',
      hash: 'BmsjIrAJvqz9V3HD8GlQwMXKMJ4Qm_NHLOQWiUZO_HY'
    };

    fixture.detectChanges();

    let logoutDe = fixture.debugElement.query(By.css('app-logout'));

    expect(logoutDe.nativeElement).not.toBeNull();
  });

  it('should set window title', fakeAsync(inject([Location], (location: Location) => {
    let url;


    url = '';

    router.navigateByUrl(url);

    (<any>location).simulateHashChange(url);
    tick();
    fixture.detectChanges();

    (<any>location).simulateUrlPop(url);
    tick();
    fixture.detectChanges();

    expect(titleService.getTitle()).toEqual(`${component.title}`);


    url = 'test'

    router.navigateByUrl(url);

    (<any>location).simulateHashChange(url);
    tick();
    fixture.detectChanges();
    
    (<any>location).simulateUrlPop(url);
    tick();
    fixture.detectChanges();

    let route = router.config.find(r => r.path === 'test');

    expect(titleService.getTitle()).toEqual(`${component.title} | ${route.data.title}`);
  })));
});
