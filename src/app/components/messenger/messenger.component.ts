import { Component, Injector, Inject, OnInit, OnDestroy } from '@angular/core';

import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';

import { Subscription, from, throwError } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';


import { WampService } from '../../services/wamp.service'
import { EventMessage } from 'thruway.js/src/Messages/EventMessage'

import { MessengerService } from './messenger.service';

import { RxDatabase } from 'rxdb';
import { DatabaseService } from '../../services/Database/database.service';
import { ConferenceDocument } from '../../services/Database/documents/conference.document';
import { MessageDocument } from '../../services/Database/documents/message.document';

import { AuthService } from '../auth/auth.service';

import { Conference } from '../../models/Conference';
import { Message } from '../../models/Message';


@Component({
  selector: 'app-messenger',
  templateUrl: './messenger.component.html',
  styleUrls: ['./messenger.component.css'],
  providers: [WampService, DatabaseService]
})
export class MessengerComponent implements OnInit, OnDestroy {

  subscriptions$: { [key: string]: Subscription } = { };
  
  private wamp: WampService;
  private databaseService: DatabaseService;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private messengerService: MessengerService,
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
      this.subscriptions$['onOpen'] = this.wamp.onOpen.subscribe(
        session => {
          this.subscriptions$['onConference'] = this.wamp.topic(`conference.updated.for.${this.authService.user.uuid}`).subscribe(this.onConference.bind(this));

          this.subscriptions$['onMessage'] = this.wamp.topic(`private.message.to.${this.authService.user.uuid}`).subscribe(this.onMessage.bind(this));
        },
        err => {
          // if (err instanceof Error || 'message' in err) { // TypeScript instance of interface check
          //   this.error = err.message;
          // }
        }
      );
    }
  }

  onConference(e: EventMessage) {
    let conference: Conference = {
      uuid: e.args[0].uuid,
      updated: e.args[0].updated,
      count: e.args[0].count,
      unread: e.args[0].unread,
      participant: e.args[0].participant
    };

    this.databaseService.$.pipe(switchMap(db => from(db.conferences.atomicUpsert(conference)))).subscribe();
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
      type: e.args[0].type,
      date: e.args[0].date,
      content: e.args[0].content,
      consumed: e.args[0].consumed,
      edited: e.args[0].edited
    };

    this.databaseService.$.pipe(switchMap(db => from(db.messages.atomicUpsert(message)))).subscribe();
  }

  ngOnDestroy() {
    for (let key in this.subscriptions$) {
      this.subscriptions$[key].unsubscribe();
    }
  }
}