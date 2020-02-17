import { Component, Injector, Inject } from '@angular/core';

import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';

import { Router, ActivatedRoute } from '@angular/router';

import { Subscription } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';

import { AuthService } from '../auth.service';
import { DatabaseService } from '../../../services/database/database.service';

@Component({
  selector: 'app-logout',
  templateUrl: './logout.component.html',
  styleUrls: ['./logout.component.css']
})
export class LogoutComponent {
  logout$: Subscription;

  pending: boolean = false;

  error?: string;

  private databaseService: DatabaseService;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private authService: AuthService,
    private router: Router,
    private injector: Injector
  ) {
    if (isPlatformBrowser(platformId)) {
      this.databaseService = this.injector.get(DatabaseService); 
    }
  }

  logout(e: Event) {
    e.preventDefault();

    this.pending = true;

    this.authService.logout().pipe(
      switchMap(res => {
        localStorage.removeItem('uuid');
        localStorage.removeItem('email');
        localStorage.removeItem('name');
        localStorage.removeItem('jwt');
        localStorage.removeItem('last_seen');

        return this.databaseService.destroy();
      }),
      switchMap(() => this.databaseService.create()),
      tap(() => this.pending = false)
    ).subscribe(
      d => {
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
