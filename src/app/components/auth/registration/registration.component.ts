import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormControl, Validators, AbstractControl } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

import { Subscription, Subject, zip, of } from 'rxjs';
import { debounceTime, take, map, switchMap, tap, takeUntil } from 'rxjs/operators';

import { CrypterService } from '../../../services/crypter.service';
import { AuthService } from '../auth.service';

import User from '../../../models/user.model';

@Component({
  selector: 'app-registration',
  templateUrl: './registration.component.html',
  styleUrls: ['./registration.component.css'],
})
export class RegistrationComponent implements OnInit, OnDestroy {
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
        Validators.min(1),
        Validators.max(255)
      ]),
      password: new FormControl('', [
        Validators.required,
        Validators.min(6)
      ]),
      retryPassword: new FormControl('', [
        Validators.required,
        Validators.min(6)
      ])
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

  pending: boolean = false;

  error?: string;

  private unsubscribe$ = new Subject<void>();

  constructor(
    private crypterService: CrypterService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) { }

  ngOnInit() {
    this.route.data.pipe(
      takeUntil(this.unsubscribe$)
    ).subscribe(d => {
      if ('email' in d) {
        this.form.get('email').setValue(d['email']);
      }
    });
  }

  registrate(e: Event) {
    e.preventDefault();

    this.error = '';
    this.pending = true;

    let redirect = '';

    let email = this.form.get('email').value;
    let name = this.form.get('name').value;
    let password = this.form.get('password').value;

    this.crypterService.generateKey(name, email, password).pipe(
      switchMap((key) => {
        return this.authService.registrate(
          email,
          name,
          password,
          key.publicKeyArmored,
          key.privateKeyArmored,
          key.revocationCertificate
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
