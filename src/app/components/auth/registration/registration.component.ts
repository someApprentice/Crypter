import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormControl, Validators, AbstractControl } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

import { Subscription } from 'rxjs';
import { debounceTime, take, map, tap } from 'rxjs/operators';

import { AuthService } from '../auth.service';

@Component({
  selector: 'app-registration',
  templateUrl: './registration.component.html',
  styleUrls: ['./registration.component.css']
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

  subscriptions: { [key: string]: Subscription } = { };
  constructor(private authService: AuthService, private router: Router, private route: ActivatedRoute) { }

  ngOnInit() {
    this.subscriptions['this.route.data'] = this.route.data.subscribe(d => {
      this.form.get('email').setValue(d.email);
    });
  }

  registrate(e: Event) {
    e.preventDefault();

    this.error = '';
    this.pending = true;

    let email = this.form.get('email').value;
    let name = this.form.get('name').value;
    let password = this.form.get('password').value;

    this.subscriptions['this.authService.registrate'] = this.authService.registrate(email, name, password).pipe(
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
        if (err instanceof Error || 'message' in err) { // TypeScript instance of interface check 
          this.error = err.message;
        }
      }
    );
  }

  ngOnDestroy() {
    this.subscriptions['this.route.url'] = this.route.url.subscribe(u => {
      let route = this.router.config.find(r => r.path === u[u.length - 1].path);

      delete route.data.email;
    });

    for (let key in this.subscriptions) {
      this.subscriptions[key].unsubscribe();
    }
  }
}
