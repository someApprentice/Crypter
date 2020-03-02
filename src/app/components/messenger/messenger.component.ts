import { Component, Input, Injector, Inject, OnInit, OnDestroy } from '@angular/core';

import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';

import { RouterOutlet } from '@angular/router';

import {
  animation, trigger, animateChild, group,
  transition, animate, style, query
} from '@angular/animations';


import { Subscription, from, of, zip, throwError } from 'rxjs';
import { tap, map, switchMap, mergeMap, delayWhen, shareReplay } from 'rxjs/operators';

import { SessionData } from 'thruway.js';

import { WampService } from '../../services/wamp.service'
import { EventMessage } from 'thruway.js/src/Messages/EventMessage';

import { MessengerService } from './messenger.service';
import { CrypterService } from '../../services/crypter.service';
import { DatabaseService } from '../../services/database/database.service';
import { AuthService } from '../auth/auth.service';

import { User } from '../../models/User';
import { Conference } from '../../models/Conference';
import { Message } from '../../models/Message';

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
  @Input() user?: User;

  subscriptions: { [key: string]: Subscription } = { };
  
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
      if (this.user) {
        this.databaseService.upsertUser(this.user).subscribe();
      }

      this.databaseService.user$ = this.databaseService.getUser(this.authService.user.uuid).pipe(
        shareReplay(1)
      );

      this.subscriptions['this.databaseService.user$'] = this.databaseService.user$.subscribe((user: User) => {
        this.authService.user = user;
      });

      this.subscriptions['this.wamp.onOpen'] = this.wamp.onOpen.pipe(
        tap(this.onOpen.bind(this)),
        switchMap((session: SessionData) => this.messengerService.getReadedMessages(session.welcomeMsg.details.authextra.user.last_seen)) // update messages readed while client was offline
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

    this.subscriptions[`this.wamp.topic(conference.updated.for.${this.authService.user.uuid})`] = this.wamp.topic(`conference.updated.for.${this.authService.user.uuid}`).subscribe(this.onConference.bind(this));

    let user$ = this.databaseService.getUser(this.authService.user.uuid);

    this.subscriptions[`this.wamp.topic(private.message.to.${this.authService.user.uuid}`] = this.wamp.topic(`private.message.to.${this.authService.user.uuid}`).pipe(
      mergeMap((e: EventMessage) => {
        let message: Message = e.args[0];

        return zip(of(message), user$)
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

    this.subscriptions[`this.wamp.topic(private.message.updated.for.${this.authService.user.uuid}`] = this.wamp.topic(`private.message.updated.for.${this.authService.user.uuid}`).pipe(
      mergeMap((e: EventMessage) => {
        let message: Message = e.args[0];

        return zip(of(message), user$)
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

  onConference(e: EventMessage) {
    let conference: Conference = {
      uuid: e.args[0].uuid,
      updated: e.args[0].updated,
      count: e.args[0].count,
      unread: e.args[0].unread,
      participant: e.args[0].participant
    };

    this.databaseService.upsertConference(conference).subscribe();
  }

  onMessage(e: EventMessage) { 
    let message: Message = {
      uuid: e.args[0].uuid,
      author: {
        uuid: e.args[0].author.uuid,
        name: e.args[0].author.name
      },
      conference: e.args[0].conference,
      readed: e.args[0].readed,
      readedAt: e.args[0].readedAt,
      type: e.args[0].type,
      date: e.args[0].date,
      content: e.args[0].content,
      consumed: e.args[0].consumed,
      edited: e.args[0].edited
    };

    this.databaseService.upsertMessage(message).subscribe();
  }

  prepareRoute(outlet: RouterOutlet) {
    return outlet && outlet.activatedRouteData && outlet.activatedRouteData['animation'];
  }

  ngOnDestroy() {
    for (let key in this.subscriptions) {
      this.subscriptions[key].unsubscribe();
    }
  }
}
