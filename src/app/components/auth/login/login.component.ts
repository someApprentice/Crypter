import { Component, Injector, Inject, OnInit, OnDestroy } from '@angular/core';

import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';

import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

import { Subscription, zip, of } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators'

import { AuthService } from '../auth.service';
import { CrypterService } from '../../../services/crypter.service';
import { DatabaseService } from '../../../services/database/database.service';

import { AuthenticationFailedError } from '../../../models/errors/AuthenticationFailedError';

import { User } from '../../../models/User';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, OnDestroy {
  form = new FormGroup({
    email: new FormControl('', [
      Validators.pattern(/^([^@\s]+@[^@\s]+\.[^@\s]+)$/), //email with top-level domain
      Validators.email,
      Validators.maxLength(255),
      Validators.required
    ]),
    password: new FormControl('', [
      Validators.required
    ])
  });

  pending: boolean = false

  error?: string;

  subscriptions: { [key: string]: Subscription } = { };

  private databaseService: DatabaseService;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private authService: AuthService,
    private crypterService: CrypterService,
    private router: Router,
    private route: ActivatedRoute,
    private injector: Injector
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.databaseService = injector.get(DatabaseService);
    }
  }

  ngOnInit() {
    this.subscriptions['this.route.data'] = this.route.data.subscribe(d => {
      this.form.get('email').setValue(d.email);
    });
  }

  login(e: Event) {
    e.preventDefault();

    this.error = '';
    this.pending = true;

    let email = this.form.get('email').value;
    let password = this.form.get('password').value;

    this.subscriptions['this.authService.login'] = this.authService.login(email, password).pipe(
      switchMap((user: User) => {
        localStorage.setItem('uuid', user.uuid);
        localStorage.setItem('email', user.email);
        localStorage.setItem('name', user.name);
        localStorage.setItem('jwt', user.jwt);
        localStorage.setItem('last_seen', user.last_seen as unknown as string); // Conversion of type 'number' to type 'string' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.

        return zip(of(user), this.crypterService.decryptPrivateKey(user.private_key, password));
      }),
      switchMap(([user, decryptedPrivateKey]) => {
        let u: User = user;

        u.private_key = decryptedPrivateKey;

        return this.databaseService.upsertUser(u);
      }),
      tap(() => this.pending = false)
    ).subscribe(
      d => {
        this.router.navigate(['']);
      },
      err => {
        this.pending = false;

        if (err instanceof AuthenticationFailedError || 'message' in err) { // TypeScript instance of interface check
          this.error = "No matches found"

          return;
        }

        if (err instanceof Error || 'message' in err) { // TypeScript instance of interface check
          this.error = err.message;
        }
      }
    );
  }

  ngOnDestroy() {
    this.subscriptions['this.route.url.subscribe'] = this.route.url.subscribe(u => {
      let route = this.router.config.find(r => r.path === u[u.length - 1].path);

      delete route.data.email;
    });

    for (let key in this.subscriptions) {
      this.subscriptions[key].unsubscribe();
    }
  }
}
