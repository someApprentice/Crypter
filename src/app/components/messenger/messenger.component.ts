import { Component, Input, Injector, Inject, OnInit, OnDestroy } from '@angular/core';

import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';

import { RouterOutlet } from '@angular/router';

import {
  animation, trigger, animateChild, group,
  transition, animate, style, query
} from '@angular/animations';

import { Subject, of, concat, zip } from 'rxjs';
import { tap, first, switchMap, concatMap, takeUntil } from 'rxjs/operators';

import { AuthService } from '../auth/auth.service';
import { DatabaseService } from '../../services/database.service';
import { MessengerService } from './messenger.service';
import { RepositoryService } from '../../services/repository.service';
import { CrypterService } from '../../services/crypter.service';

import { SocketService } from '../../services/socket.service'

import { User } from '../../models/user.model';
import { Conference } from '../../models/conference.model';
import { Message } from '../../models/message.model';

@Component({
  selector: 'app-messenger',
  templateUrl: './messenger.component.html',
  styleUrls: ['./messenger.component.css'],
  animations: [
    trigger('routeAnimations', [
      transition('ConferencesPage => ConferencePage', [
        style({ position: 'relative' }),
        query(':enter, :leave', [
          style({
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%'
          })
        ]),
        query(':enter', [
          style({ left: '100%', zIndex: 999 })
        ]),
        query(':leave', animateChild()),
        group([
          query(':enter', [
            animate('333ms ease-out', style({ left: '0%' }))
          ])
        ]),
        query(':enter', animateChild()),
      ]),
      transition('ConferencePage => ConferencesPage', [
        style({ position: 'relative' }),
        query(':enter, :leave', [
          style({
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%'
          })
        ]),
        query(':leave', [
          style({ zIndex: 999 })
        ]),
        query(':leave', animateChild()),
        group([
          query(':leave', [
            animate('333ms ease-out', style({ left: '100%' }))
          ])
        ]),
        query(':enter', animateChild()),
      ])
    ])
  ],
  providers: [ DatabaseService, RepositoryService, SocketService ]
})
export class MessengerComponent implements OnInit, OnDestroy {
  private unsubscribe$ = new Subject<void>();

  private databaseService: DatabaseService;
  private repositoryService: RepositoryService;
  private socketService: SocketService;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private messengerService: MessengerService,
    private crypterService: CrypterService,
    private authService: AuthService,
    private injector: Injector,
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.databaseService = injector.get(DatabaseService);
      this.repositoryService = injector.get(RepositoryService);
      this.socketService = injector.get(SocketService);
    }
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      // Populate IndexeDB
      // The private_key is only has after the User authenticated and
      // decrypted this private_key with a password
      // Otherwise the User will be populated from IndexeDB
      // see operation below
      if ('private_key' in this.authService.user)
        this.databaseService.upsertUser(this.authService.user).subscribe();

      this.databaseService.user$.pipe(
        takeUntil(this.unsubscribe$)
      ).subscribe((user: User) => {
        this.authService.user = user;
      });

      // Synchronize IndexeDB after the client was disconnected
      this.socketService.connected$.pipe(
        concatMap(() => this.repositoryService.synchronize()),
        takeUntil(this.unsubscribe$)
      ).subscribe();

      this.socketService.disconnected$.pipe(
        tap(() => this.databaseService.isSynchronized$.next(false)),
        takeUntil(this.unsubscribe$)
      ).subscribe();

      this.socketService.userUpdated$.pipe(
        tap((user: User) => {
          localStorage.setItem('uuid', user.uuid);
          localStorage.setItem('email', user.email);
          localStorage.setItem('name', user.name);
          localStorage.setItem('hash', user.hash);

          // Conversion of type 'number' to type 'string' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
          localStorage.setItem('conferences_count', user.conferences_count as unknown as string);

          // Conversion of type 'number' to type 'string' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
          localStorage.setItem('last_seen', user.last_seen as unknown as string);

          this.authService.user = Object.assign(this.authService.user, user);
        }),
        switchMap((user: User) => this.databaseService.user$.pipe(
          first(),
          switchMap((u: User) => this.databaseService.upsertUser(Object.assign(u, user)))
        )),
        takeUntil(this.unsubscribe$)
      ).subscribe();

      this.socketService.userConferencesCountUpdated$.pipe(
        tap(conferences_count => {
          // Conversion of type 'number' to type 'string' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
          localStorage.setItem('conferences_count', conferences_count as unknown as string);

          this.authService.user.conferences_count = conferences_count;
        }),
        switchMap(conferences_count => this.databaseService.user$.pipe(
          first(),
          switchMap((u: User) => this.databaseService.upsertUser(Object.assign(u, { conferences_count })))
        )),
        takeUntil(this.unsubscribe$)
      ).subscribe();

      this.socketService.conferenceUpdated$.pipe(
        concatMap((conference: Conference) => this.databaseService.upsertConference(conference)),
        takeUntil(this.unsubscribe$)
      ).subscribe();

      this.socketService.privateMessage$.pipe(
        concatMap((message: Message) => this.databaseService.upsertMessage(message)),
        takeUntil(this.unsubscribe$)
      ).subscribe();

      this.socketService.privateMessageRead$.pipe(
        concatMap((message: Message) => this.databaseService.readMessage(message)),
        takeUntil(this.unsubscribe$)
      ).subscribe();

      this.socketService.privateMessageReadSince$.pipe(
        concatMap((messages: Message[]) => this.databaseService.readMessages(messages)),
        takeUntil(this.unsubscribe$)
      ).subscribe();
    }
  }

  prepareRoute(outlet: RouterOutlet) {
    return outlet && outlet.activatedRouteData && outlet.activatedRouteData['animation'];
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
