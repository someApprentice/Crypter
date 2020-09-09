import { environment } from '../../../../environments/environment';

import { Component, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core';

import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

import { Subject, zip, of } from 'rxjs';
import { map, tap, switchMap, takeUntil } from 'rxjs/operators'

import { AuthService } from '../auth.service';
import { CrypterService } from '../../../services/crypter.service';

import User from '../../../models/user.model';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, OnDestroy {
  environments = environment;

  @ViewChild('password') passwordEl: ElementRef;

  form = new FormGroup({
    email: new FormControl('', [
      Validators.pattern(/^([^@\s]+@[^@\s]+\.[^@\s]+)$/), //email with top-level domain
      Validators.email,
      Validators.maxLength(255),
      Validators.required
    ]),
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(6)
    ]),
    recaptcha: new FormControl('')
  });

  pending: boolean = false

  error?: string;

  private unsubscribe$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private crypterService: CrypterService,
    private router: Router,
    private route: ActivatedRoute,
  ) { }

  ngOnInit() {
    if (this.environments.production) {
      this.form.get('recaptcha').setValidators([ Validators.required ]);
    }

    this.route.data.pipe(takeUntil(this.unsubscribe$)).subscribe(d => {
      if ('email' in d) {
        this.form.get('email').setValue(d['email']);
      }
    });
  }

  login(e: Event) {
    e.preventDefault();

    this.error = '';
    this.pending = true;

    let redirect = '';

    let email = this.form.get('email').value;
    let password = this.form.get('password').value;
    let recaptcha_token = this.form.get('recaptcha').value;

    this.authService.login(email, password, recaptcha_token).pipe(
      switchMap((user: User) =>  {
        return zip(of(user), this.crypterService.decryptPrivateKey(user.private_key, password)).pipe(
          map(([user, decryptedPrivateKey]) => {
            user.private_key = decryptedPrivateKey;

            return user;
          })
        );
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
        this.pending = false;

        if (err.status === 404) {
          this.error = "No matches found";

          this.form.get('password').reset();
          this.form.get('recaptcha').reset();

          this.passwordEl.nativeElement.focus();

          return;
        }

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
