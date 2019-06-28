import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormControl, Validators, AbstractControl } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

import { Subscription } from 'rxjs';
import { debounceTime, take, map } from 'rxjs/operators';

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

  error?: string;

  subscriptions$: { [key: string]: Subscription } = { };

  constructor(private authService: AuthService, private router: Router, private route: ActivatedRoute) { }

  ngOnInit() {
    this.subscriptions$['routeData$'] = this.route.data.subscribe(d => {
      this.form.get('email').setValue(d.email);
    });
  }

  registrate(e: Event) {
    e.preventDefault();

    let email = this.form.get('email').value;
    let name = this.form.get('name').value;
    let password = this.form.get('password').value;

    this.subscriptions$['registrate$'] = this.authService.registrate(email, name, password).subscribe(
      d => {
        localStorage.setItem('uuid', d.uuid);
        localStorage.setItem('email', d.email);
        localStorage.setItem('name', d.name);
        localStorage.setItem('jwt', d.jwt);

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
    this.subscriptions$['routeUrl$'] = this.route.url.subscribe(u => {
      // // u.pop() -> undefined???
      // //let route = this.router.config.find(r => r.path === u.pop().path);
      
      // let segment = u.pop();

      // let route = this.router.config.find(r => r.path === segment.path);

      // console.log(u, u[u.length - 1]);

      let route = this.router.config.find(r => r.path === u[u.length - 1].path);

      delete route.data.email;
    });

    for (let key in this.subscriptions$) {
      this.subscriptions$[key].unsubscribe();
    }
  }
}
