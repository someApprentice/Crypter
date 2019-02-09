import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';

import { Subscription } from 'rxjs';
import { filter, map, mergeMap } from 'rxjs/operators';

import { AuthService } from './auth/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Crypter';
  title$: Subscription;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private titleService: Title,
    public authService: AuthService
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

  ngOnDestroy() {
    this.title$.unsubscribe();
  }
}
