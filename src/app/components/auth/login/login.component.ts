import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

import { Subscription } from 'rxjs';

import { AuthService } from '../auth.service';


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

  error?: string;

  subscriptions$: { [key: string]: Subscription } = { };

  constructor(private authService: AuthService, private router: Router, private route: ActivatedRoute) { }

  ngOnInit() {
    this.subscriptions$['routeData$'] = this.route.data.subscribe(d => {
      this.form.get('email').setValue(d.email);
    });
  }

  login(e: Event) {
    e.preventDefault();

    let email = this.form.get('email').value;
    let password = this.form.get('password').value;

    this.subscriptions$['login$'] = this.authService.login(email, password).subscribe(
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
      let route = this.router.config.find(r => r.path === u[u.length - 1].path);

      delete route.data.email;
    });

    for (let key in this.subscriptions$) {
      this.subscriptions$[key].unsubscribe();
    }
  }
}
