import { Component, OnInit, OnDestroy } from '@angular/core';

import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

import { Subject, zip, of } from 'rxjs';
import { map, tap, switchMap, takeUntil } from 'rxjs/operators'

import { AuthService } from '../auth.service';
import { CrypterService } from '../../../services/crypter.service';

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

  private unsubscribe$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private crypterService: CrypterService,
    private router: Router,
    private route: ActivatedRoute,
  ) { }

  ngOnInit() {
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

    this.authService.login(email, password).pipe(
      switchMap((user: User) => zip(of(user), this.crypterService.decryptPrivateKey(user.private_key, password))),
      map(([user, decryptedPrivateKey]) => {
        user.private_key = decryptedPrivateKey;

        return user;
      }),
      tap((user: User) => {
        this.authService.user = user;

        let route = this.router.config.find(r => r.path === redirect);

        route.data['user'] = user;
      }),
      tap(() => this.pending = false)
    ).subscribe(
      d => {
        this.router.navigate([redirect]);
      },
      err => {
        this.pending = false;

        if (err.status === 404) {
          this.error = "No matches found";

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
