import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

import { Subscription } from 'rxjs';

import { AuthService } from '../auth.service';

@Component({
  selector: 'app-logout',
  templateUrl: './logout.component.html',
  styleUrls: ['./logout.component.css']
})
export class LogoutComponent implements OnInit, OnDestroy {
  logout$: Subscription;

  error?: string;

  constructor(private authService: AuthService, private router: Router) { }

  ngOnInit() {
  }

  logout(e: Event) {
    e.preventDefault();

    this.logout$ = this.authService.logout().subscribe(
      d => {
        localStorage.removeItem('uuid');
        localStorage.removeItem('email');
        localStorage.removeItem('name');
        localStorage.removeItem('jwt');

        this.router.navigate([''])
      },
      err => {
        if (err instanceof Error || 'message' in err) { // TypeScript instance of interface check 
          this.error = err.message;
        }
      }
    );
  }

  ngOnDestroy() {
    if (this.logout$) this.logout$.unsubscribe();
  }
}
