import { Component, Injector, Inject, OnInit, OnDestroy } from '@angular/core';

import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { TransferState, makeStateKey } from '@angular/platform-browser';

import { Subscription, from, throwError } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { MessengerService } from '../messenger.service';

import { DatabaseService } from '../../../services/database/database.service';
import { ConferenceDocument } from '../../../services/database/documents/conference.document';
import { MessageDocument } from '../../../services/database/documents/message.document';

import { Conference } from '../../../models/Conference';
import { Message } from '../../../models/Message';

const CONFERENCES_STATE_KEY = makeStateKey('conferences');

@Component({
  selector: 'app-conferences',
  templateUrl: './conferences.component.html',
  styleUrls: ['./conferences.component.css']
})
export class ConferencesComponent implements OnInit, OnDestroy {
  searching: boolean = false;

  isConferencesLoading: boolean = false;

  conferences: Conference[] = [];

  subscriptions: { [key: string]: Subscription } = { };
  

  private databaseService: DatabaseService;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private messengerService: MessengerService,
    private state: TransferState,
    private injector: Injector
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.databaseService = injector.get(DatabaseService);
    }
  }

  ngOnInit() {
    this.conferences = this.state.get(CONFERENCES_STATE_KEY, [] as Conference[]);

    if (this.conferences.length === 0) {
      this.isConferencesLoading = true;
    }

    // get Conferences from api
    // if it's a browser push them into indexeDB
    // if it's a server push them into conferences array
    this.subscriptions['this.messengerService.getConferences'] = this.messengerService.getConferences().subscribe(
      (conferences: Conference[]) => {
        for (let conference of conferences) {
          if (isPlatformBrowser(this.platformId)) {
            let c = <Conference> {
              uuid: conference.uuid,
              updated: conference.updated,
              count: conference.count,
              unread: conference.unread,
              participant: conference.participant
            };

            this.databaseService.upsertConference(c).subscribe();
          }
        }

        if (isPlatformServer(this.platformId)) {
          this.conferences = conferences;

          this.conferences.sort((a: Conference, b: Conference) => b.updated - a.updated);
        }

        this.state.set(CONFERENCES_STATE_KEY, conferences as Conference[]);

        this.isConferencesLoading = false;
      },
      // err => {
      //   if (err instanceof Error || 'message' in err) { // TypeScript instance of interface check
      //     this.error = err.message;
      //   }
      // }
    );

    if (isPlatformBrowser(this.platformId)) {
      // if conference doesn't exists in a conferences array, push it, otherwise update entry
      // and then sort conferences in case if some of conferences have been pushed before query
      // (for example before request from api)
      this.subscriptions['this.databaseService.getConferences'] = this.databaseService.getConferences().subscribe(
        (conferences: Conference[]) => {
          this.conferences = conferences.reduce((acc, cur) => {
            if (acc.find((c: Conference) => c.uuid === cur.uuid)) {
              acc[acc.findIndex((c: Conference) => c.uuid === cur.uuid)] = cur;
              
              return acc;
            }
            
            return [ ...acc, cur ];
          }, this.conferences);

          this.conferences.sort((a: Conference, b: Conference) => b.updated - a.updated);

          this.isConferencesLoading = false;
        },
        // err => {
        //   if (err instanceof Error || 'message' in err) { // TypeScript instance of interface check
        //     this.error = err.message;
        //   }
        // }
      );
    }
  }

  onSearch(searching: boolean): void {
    this.searching = searching;
  }

  ngOnDestroy() {
    this.state.remove(CONFERENCES_STATE_KEY);

    for (let key in this.subscriptions) {
      this.subscriptions[key].unsubscribe();
    }
  }
}
