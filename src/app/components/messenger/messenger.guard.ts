import { Injectable } from '@angular/core';
import { Router, CanActivate } from '@angular/router';

import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class MessengerGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) { }

  canActivate(): boolean {
    let canActivate = !!this.authService.user;

    if (!canActivate) {
      this.router.navigate(['']);
    }

    return canActivate;
  }
}
