import { Component, ViewChild, ElementRef, Inject, Injector, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormControl, Validators, AbstractControl } from '@angular/forms';

import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { TransferState, makeStateKey } from '@angular/platform-browser';

import { Subject, of, merge, zip, empty } from 'rxjs';
import { tap, map, switchMap, first, ignoreElements, catchError, takeUntil } from 'rxjs/operators';

import { AuthService } from '../../auth/auth.service';
import { DatabaseService } from '../../../services/database/database.service';
import { RepositoryService } from '../../../services/repository.service';
import { CrypterService } from '../../../services/crypter.service';

import User from '../../../models/user.model';

const USER_STATE_KEY = makeStateKey('user');

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit, OnDestroy {
  private unsubscribe$ = new Subject<void>();

  user?: User;

  changePasswordForm = new FormGroup(
    {
      currentPassword: new FormControl('', [
        Validators.required,
        Validators.minLength(6)
      ]),
      newPassword: new FormControl('', [
        Validators.required,
        Validators.minLength(6)
      ]),
      retryPassword: new FormControl('', [
        Validators.required,
        Validators.minLength(6)
      ])
    },
    [
      function validatePasswordsMatch(control: AbstractControl): void | null {
        let newPassword = control.get('newPassword').value;
        let retryPassword = control.get('retryPassword').value;

        if (newPassword !== retryPassword) {
          control.get('retryPassword').setErrors({ passwordsNotMatch: true });
        } else {
          return null;
        }
      }.bind(this)
    ]
  );

  @ViewChild('currentPassword') currentPasswordEl: ElementRef;

  isChangePasswordPending: boolean = false;
  isChangePasswordSuccessful: boolean = false;

  changePasswordError?: string;

  databaseService: DatabaseService;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private crypterService: CrypterService,
    private authService: AuthService,
    private state: TransferState,
    private injector: Injector,
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.databaseService = injector.get(DatabaseService);
    }
  }

  ngOnInit() {
    if (isPlatformServer(this.platformId)) {
      this.authService.getSelf().subscribe((user: User) => {
        this.state.set(USER_STATE_KEY, user);

        this.user = user;
      });
    }

    if (isPlatformBrowser(this.platformId)) {
      this.user = this.state.get(USER_STATE_KEY, undefined);

      this.databaseService.user$.pipe(
        tap((user: User) => this.user = user),
        takeUntil(this.unsubscribe$)
      ).subscribe();
    }
  }

  changePassword(e: Event): void {
    e.preventDefault();

    this.changePasswordError = '';
    this.isChangePasswordPending = true;
    this.isChangePasswordSuccessful = false;

    let currentPassword = this.changePasswordForm.get('currentPassword').value;
    let newPassword = this.changePasswordForm.get('newPassword').value;

    this.databaseService.user$.pipe(
      first(),
      switchMap((user: User) => this.crypterService.changePassphrase(newPassword, user.private_key)),
      switchMap((newPrivateKey: string) => this.authService.changePassword(currentPassword, newPassword, newPrivateKey)),
      tap((user: User) => {
        this.authService.user.hash = user.hash;

        localStorage.setItem('hash', user.hash);

        this.isChangePasswordPending = false;
        
        this.changePasswordForm.reset();

        this.isChangePasswordSuccessful = true;
      }),
      switchMap((user: User) => merge(
        zip(of(user), this.databaseService.user$.pipe(first())).pipe(
          map(([ user, u ]) => {
            u.hash = user.hash;

            return u;
          }),
          switchMap((user: User) => this.databaseService.upsertUser(user)),
          ignoreElements()
        ),
        of(user)
      )),
      catchError(err => {
        this.isChangePasswordPending = false;
        this.isChangePasswordSuccessful = false;

        if (err.status === 403) {
          this.changePasswordError = "Current password is wrong";

          this.changePasswordForm.reset();

          this.currentPasswordEl.nativeElement.focus();

          return empty();
        }

        if (err instanceof Error || 'message' in err) { // TypeScript instance of interface check
          this.changePasswordError = err.message;
        }

        return empty();
      })
    ).subscribe();
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
