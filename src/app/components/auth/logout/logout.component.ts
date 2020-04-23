import { Component } from '@angular/core';

import { Router, ActivatedRoute } from '@angular/router';

import { Subscription } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';

import { AuthService } from '../auth.service';

@Component({
  selector: 'app-logout',
  templateUrl: './logout.component.html',
  styleUrls: ['./logout.component.css']
})
export class LogoutComponent {
  pending: boolean = false;

  error?: string;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) { }

  logout(e: Event) {
    e.preventDefault();

    this.pending = true;

    this.authService.logout().pipe(
      tap(() => this.authService.user = undefined),
      tap(() => this.pending = false)
    ).subscribe(
      d => {
        localStorage.removeItem('uuid');
        localStorage.removeItem('email');
        localStorage.removeItem('name');
        localStorage.removeItem('hash');
        localStorage.removeItem('last_seen');

        this.router.navigate(['']);
      },
      err => {
        this.pending = false;

        if (err instanceof Error || 'message' in err) { // TypeScript instance of interface check 
          this.error = err.message;
        }
      }
    );
  }
}
