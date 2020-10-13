import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';

import { Subject } from 'rxjs'
import { tap, takeUntil } from 'rxjs/operators'

import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';

import { AuthService } from '../auth.service';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.css']
})
export class WelcomeComponent implements OnInit, OnDestroy {
  form = new FormGroup({
    email: new FormControl('', [
      Validators.pattern(/^([^@\s]+@[^@\s]+\.[^@\s]+)$/), //email with top-level domain
      Validators.email,
      Validators.maxLength(255),
      Validators.required
     ])
  });

  isSmallScreen: boolean = !this.breakpointObserver.isMatched('(min-width: 1200px)');

  pending: boolean = false;

  error?: string;

  private unsubscribe$ = new Subject<void>();

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private authService: AuthService,
    private router: Router,
    private breakpointObserver: BreakpointObserver
  ) { }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.breakpointObserver.observe('(min-width: 1200px)').pipe(
        tap((state: BreakpointState) => this.isSmallScreen = !state.matches),
        takeUntil(this.unsubscribe$)
      ).subscribe();
    }
  }

  next(e: Event) {
    e.preventDefault();

    this.error = '';
    this.pending = true;

    let email = this.form.get('email').value;

    let redirect = 'registration';

    this.authService.isEmailExist(email).pipe(
      tap(() => this.pending = false)
    ).subscribe(
      d => {
        if (d) {
          redirect = 'login';
        }

        // https://github.com/angular/angular/issues/25658
        let route = this.router.config.find(r => r.path === redirect);
        
        route.data['email'] = email;

        this.router.navigate([redirect]);
      },
      err => {
        this.pending = false;

        if (err instanceof Error || 'message' in err) { // TypeScript instance of interface check
          this.error = err.message;
        }
      }
    );
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
