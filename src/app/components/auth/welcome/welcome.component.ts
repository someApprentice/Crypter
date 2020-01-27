import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators'


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

  pending: boolean = false;

  error?: string;

  subscriptions: { [key: string]: Subscription } = { };

  constructor(private authService: AuthService, private router: Router) { }

  ngOnInit() {
  }

  next(e: Event) {
    e.preventDefault();

    this.error = '';
    this.pending = true;

    let email = this.form.get('email').value;

    let redirect = 'registration';

    this.subscriptions['this.authService.isEmailExist'] = this.authService.isEmailExist(email).pipe(
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
    for (let key in this.subscriptions) {
      this.subscriptions[key].unsubscribe();
    }
  }
}
