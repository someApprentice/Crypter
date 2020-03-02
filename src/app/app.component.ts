import { Component, Injector, Inject, OnInit, OnDestroy } from '@angular/core';

import { Router, NavigationEnd, ActivatedRoute, RouterOutlet } from '@angular/router';
import { Title } from '@angular/platform-browser';
import {
  animation, trigger, animateChild, group,
  transition, animate, style, query
} from '@angular/animations';

import { Subscription } from 'rxjs';
import { filter, map, mergeMap } from 'rxjs/operators';

import { AuthService } from './components/auth/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  animations: [
    trigger('routeAnimations', [
      transition('WelcomePage => SignPage', [
        style({ position: 'relative' }),
        query(':enter, :leave', [
          style({
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%'
          })
        ]),
        query(':enter', [
          style({ left: '100%'})
        ]),
        query(':leave', animateChild()),
        group([
          query(':leave', [
            animate('333ms ease-out', style({ left: '-100%'}))
          ]),
          query(':enter', [
            animate('333ms ease-out', style({ left: '0%'}))
          ])
        ]),
        query(':enter', animateChild()),
      ])
    ])
  ]
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Crypter';
  title$: Subscription;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private titleService: Title,
    public authService: AuthService,
  ) { }

  ngOnInit() {
    // Is there any shorter way to observe route.date.title?
    // https://toddmotto.com/dynamic-page-titles-angular-2-router-events
    this.title$ = this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => this.route),
      map((route) => {
        while (route.firstChild) route = route.firstChild;

        return route;
      }),
      filter((route) => route.outlet === 'primary'),
      mergeMap((route) => route.data),
    ).subscribe((event) => {
      (event['title']) ? this.titleService.setTitle(`${this.title} | ${event['title']}`) : this.titleService.setTitle(this.title);
    });
  }

  prepareRoute(outlet: RouterOutlet) {
    return outlet && outlet.activatedRouteData && outlet.activatedRouteData['animation'];
  }

  ngOnDestroy() {
    this.title$.unsubscribe();
  }
}
