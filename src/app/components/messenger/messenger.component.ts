import { Component, Input, Injector, Inject, OnInit, OnDestroy } from '@angular/core';

import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';

import { RouterOutlet } from '@angular/router';

import {
  animation, trigger, animateChild, group,
  transition, animate, style, query
} from '@angular/animations';


import { Subject, from, of, concat, zip, throwError } from 'rxjs';
import { tap, map, reduce, switchMap, mergeMap, delayWhen, shareReplay, takeUntil } from 'rxjs/operators';

import { SessionData } from 'thruway.js';

import { WampService } from '../../services/wamp.service'
import { EventMessage } from 'thruway.js/src/Messages/EventMessage';

import { MessengerService } from './messenger.service';
import { CrypterService } from '../../services/crypter.service';
import { DatabaseService } from '../../services/database/database.service';
import { AuthService } from '../auth/auth.service';

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
  providers: [ DatabaseService, WampService ]
})
export class MessengerComponent implements OnInit, OnDestroy {
  private unsubscribe$ = new Subject<void>();

  private wamp: WampService;
  private databaseService: DatabaseService;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private messengerService: MessengerService,
    private crypterService: CrypterService,
    private authService: AuthService,
    private injector: Injector,
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.wamp = injector.get(WampService);
      this.databaseService = injector.get(DatabaseService);
    }
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      // Populate IndexeDB
      // The private_key is only has after the User authenticated and
      // decrypted it with a password
      // Otherwise the User will be populated from IndexeDB
      // see operations below
      if ('private_key' in this.authService.user) {
        this.databaseService.upsertUser(this.authService.user).subscribe();
      }

      this.databaseService.user$ = this.databaseService.getUser(this.authService.user.uuid).pipe(
        takeUntil(this.unsubscribe$),
        shareReplay(1)
      );

      this.databaseService.user$.pipe(takeUntil(this.unsubscribe$)).subscribe((user: User) => {
        this.authService.user = user;
      });

      this.wamp.onOpen.pipe(
        takeUntil(this.unsubscribe$),
        tap(this.onOpen.bind(this)),
        switchMap((session: SessionData) => {
          // update readed messages while client was offline
          return this.messengerService.getReadedMessages(session.welcomeMsg.details.authextra.user.last_seen).pipe(
            switchMap((messages: Message[]) => zip(of(messages), this.databaseService.user$)),
            switchMap(([ messages, user ]) => {
              let decrypted$ = concat(...messages.map(m => this.crypterService.decrypt(m.content, user.private_key)));

              return zip(from(messages), decrypted$).pipe(
                reduce((acc, [ message, decrypted ]) => {
                  message.content = decrypted;

                  acc.push(message);

                  return acc;
                }, [])
              )
            })
          )
        })
      ).subscribe(messages => {
        for (let message of messages) {
          this.databaseService.upsertMessage(message).subscribe();
        }
      });
    }
  }

  onOpen(session: SessionData) {
    let last_seen = session.welcomeMsg.details.authextra.user.last_seen;

    localStorage.setItem('last_seen', last_seen as unknown as string); // Conversion of type 'number' to type 'string' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.

    this.authService.user.last_seen = last_seen;

    // TODO: upsert User in IndexeDB

    this.wamp.topic(`conference.updated.for.${this.authService.user.uuid}`).pipe(
      takeUntil(this.unsubscribe$),
      delayWhen((e: EventMessage) => {
        let user: User = e.args[0].participant;

        return this.databaseService.upsertUser(e.args[0].participant);
      }),
      switchMap((e: EventMessage) => {
        let conference: Conference = e.args[0];

        return this.databaseService.upsertConference(conference);
      })
    ).subscribe();

    this.wamp.topic(`private.message.to.${this.authService.user.uuid}`).pipe(
      takeUntil(this.unsubscribe$),
      mergeMap((e: EventMessage) => {
        let message: Message = e.args[0];

        return zip(of(message), this.databaseService.user$)
      }),
      switchMap(([ message, user ]) => {
        let decrypted$ = this.crypterService.decrypt(message.content, user.private_key);

        return zip(of(message), decrypted$);
      }),
      map(([message, decrypted]) => {
        message.content = decrypted;

        return message;
      }),
      switchMap((message: Message) => this.databaseService.upsertMessage(message))
    ).subscribe();

    this.wamp.topic(`private.message.updated.for.${this.authService.user.uuid}`).pipe(
      takeUntil(this.unsubscribe$),
      mergeMap((e: EventMessage) => {
        let message: Message = e.args[0];

        return zip(of(message), this.databaseService.user$)
      }),
      switchMap(([ message, user ]) => {
        let decrypted$ = this.crypterService.decrypt(message.content, user.private_key);

        return zip(of(message), decrypted$);
      }),
      map(([message, decrypted]) => {
        message.content = decrypted;

        return message;
      }),
      switchMap((message: Message) => this.databaseService.upsertMessage(message))
    ).subscribe();

    return session;
  }

  prepareRoute(outlet: RouterOutlet) {
    return outlet && outlet.activatedRouteData && outlet.activatedRouteData['animation'];
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
