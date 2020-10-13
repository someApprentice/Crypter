import { environment } from '../../../../environments/environment';

import { Component, Inject, OnInit, OnDestroy } from '@angular/core';

import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';

import { FormGroup, FormControl, Validators, AbstractControl } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

import { Subscription, Subject, zip, of } from 'rxjs';
import { debounceTime, take, map, switchMap, tap, takeUntil } from 'rxjs/operators';

import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';

import { CrypterService } from '../../../services/crypter.service';
import { AuthService } from '../auth.service';

import User from '../../../models/user.model';

@Component({
  selector: 'app-registration',
  templateUrl: './registration.component.html',
  styleUrls: ['./registration.component.css'],
})
export class RegistrationComponent implements OnInit, OnDestroy {
  environments = environment;

  form = new FormGroup(
    {
      email: new FormControl(
        '', 
        [
          Validators.pattern(/^([^@\s]+@[^@\s]+\.[^@\s]+)$/), //email with top-level domain
          Validators.email,
          Validators.maxLength(255),
          Validators.required
        ],
        [
          function validateEmailExistence(control: AbstractControl): Subscription {
            let email = control.value;

            return this.authService.isEmailExist(email).pipe(
              debounceTime(666), // 2/3 of second
              take(1),
              map(d => {
                return d ? { emailExist: true } : null;
              })
            );
          }.bind(this)
        ]
      ),
      name: new FormControl('', [
        Validators.required,
        Validators.minLength(1),
        Validators.maxLength(255)
      ]),
      password: new FormControl('', [
        Validators.required,
        Validators.minLength(6)
      ]),
      retryPassword: new FormControl('', [
        Validators.required,
        Validators.minLength(6)
      ]),
      recaptcha: new FormControl('')
    },
    [
      function validatePasswordsMatch(control: AbstractControl): void | null {
        let password = control.get('password').value;
        let retryPassword = control.get('retryPassword').value;

        if (password !== retryPassword) {
          control.get('retryPassword').setErrors({ passwordsNotMatch: true });
        } else {
          return null;
        }
      }.bind(this)
    ]
  );

  isSmallScreen: boolean = !this.breakpointObserver.isMatched('(min-width: 1200px)');

  pending: boolean = false;

  error?: string;

  private unsubscribe$ = new Subject<void>();

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private crypterService: CrypterService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private breakpointObserver: BreakpointObserver
  ) { }

  ngOnInit() {
    if (this.environments.production) {
      this.form.get('recaptcha').setValidators([ Validators.required ]);
    }

    this.route.data.pipe(
      takeUntil(this.unsubscribe$)
    ).subscribe(d => {
      if ('email' in d) {
        this.form.get('email').setValue(d['email']);
      }
    });

    if (isPlatformBrowser(this.platformId)) {
      this.breakpointObserver.observe('(min-width: 1200px)').pipe(
        tap((state: BreakpointState) => this.isSmallScreen = !state.matches),
        takeUntil(this.unsubscribe$)
      ).subscribe();
    }
  }

  registrate(e: Event) {
    e.preventDefault();

    this.error = '';
    this.pending = true;

    let redirect = '';

    let email = this.form.get('email').value;
    let name = this.form.get('name').value;
    let password = this.form.get('password').value;
    let recaptcha_token = this.form.get('recaptcha').value;

    this.crypterService.generateKey(name, email, password).pipe(
      switchMap((keys) => {
        return this.authService.registrate(
          email,
          name,
          password,
          keys.key.getFingerprint(),
          keys.publicKeyArmored,
          keys.privateKeyArmored,
          keys.revocationCertificate,
          recaptcha_token
        ).pipe(
          switchMap((user: User) => {
            return zip(of(user), this.crypterService.decryptPrivateKey(user.private_key, password));
          }),
          map(([user, decryptedPrivateKey]) => {
            user.private_key = decryptedPrivateKey;

            return user;
          })
        )
      }),
      tap((user: User) => this.authService.user = user),
      tap(() => this.pending = false)
    ).subscribe(
      (user: User) => {
        localStorage.setItem('uuid', user.uuid);
        localStorage.setItem('email', user.email);
        localStorage.setItem('name', user.name);
        localStorage.setItem('hash', user.hash);

        // Conversion of type 'number' to type 'string' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
        localStorage.setItem('conferences_count', user.conferences_count as unknown as string);

        // Conversion of type 'number' to type 'string' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
        localStorage.setItem('last_seen', user.last_seen as unknown as string);

        this.router.navigate([redirect]);
      },
      err => {
        this.form.get('recaptcha').reset();

        if (err instanceof Error || 'message' in err) { // TypeScript instance of interface check 
          this.error = err.message;
        }
      }
    );
  }

  ngOnDestroy() {
    let route = this.router.config.find(r => this instanceof r.component);

    delete route.data['email'];

    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
