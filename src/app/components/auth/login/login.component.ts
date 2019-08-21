import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators'

import { AuthService } from '../auth.service';

import { AuthenticationFailedError } from '../../../models/errors/AuthenticationFailedError';

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

  subscriptions$: { [key: string]: Subscription } = { };

  constructor(private authService: AuthService, private router: Router, private route: ActivatedRoute) { }

  ngOnInit() {
    this.subscriptions$['this.route.data'] = this.route.data.subscribe(d => {
      this.form.get('email').setValue(d.email);
    });
  }

  login(e: Event) {
    e.preventDefault();

    this.error = '';
    this.pending = true;

    let email = this.form.get('email').value;
    let password = this.form.get('password').value;

    this.subscriptions$['this.authService.login'] = this.authService.login(email, password).pipe(
      tap(() => this.pending = false)
    ).subscribe(
      d => {
        localStorage.setItem('uuid', d.uuid);
        localStorage.setItem('email', d.email);
        localStorage.setItem('name', d.name);
        localStorage.setItem('jwt', d.jwt);
        localStorage.setItem('last_seen', d.last_seen as unknown as string); // Conversion of type 'number' to type 'string' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.

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
    this.subscriptions$['this.route.url.subscribe'] = this.route.url.subscribe(u => {
      let route = this.router.config.find(r => r.path === u[u.length - 1].path);

      delete route.data.email;
    });

    for (let key in this.subscriptions$) {
      this.subscriptions$[key].unsubscribe();
    }
  }
}