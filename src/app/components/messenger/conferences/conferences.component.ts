import { Component, Injector, Inject, OnInit, OnDestroy } from '@angular/core';

import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { TransferState, makeStateKey } from '@angular/platform-browser';

import { Subject, from, of, zip, throwError } from 'rxjs';
import { map, switchMap, takeUntil } from 'rxjs/operators';

import { MessengerService } from '../messenger.service';

import { DatabaseService } from '../../../services/database/database.service';
import { ConferenceDocument } from '../../../services/database/documents/conference.document';
import { MessageDocument } from '../../../services/database/documents/message.document';

import { Conference } from '../../../models/conference.model';
import { Message } from '../../../models/message.model';

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

  private unsubscribe$ = new Subject<void>();
  
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

    // Get Conferences from api
    // Then if it's a browser push participants into indexeDB
    // Then if it's a browser push conferences into indexeDB
    this.messengerService.getConferences().pipe(
      switchMap((conferences: Conference[]) => {
        if (isPlatformBrowser(this.platformId)) {
          return zip(...conferences.map(c => this.databaseService.upsertUser(c['participant']))).pipe(
            switchMap(() => of(conferences))
          );
        }

        return of(conferences);
      }),
      switchMap((conferences: Conference[]) => {
        if (isPlatformBrowser(this.platformId)) {
          return zip(...conferences.map(c => this.databaseService.upsertConference(c))).pipe(
            switchMap(() => of(conferences))
          );
        }

        return of(conferences);
      })
    ).subscribe(
      (conferences: Conference[]) => {
        this.conferences = conferences;

        this.conferences.sort((a: Conference, b: Conference) => b.updated - a.updated);

        this.state.set(CONFERENCES_STATE_KEY, conferences as Conference[]);

        this.isConferencesLoading = false;
      }
    );

    if (isPlatformBrowser(this.platformId)) {
      // if conference doesn't exists in a conferences array, push it, otherwise update entry
      // and then sort conferences in case if some of conferences have been pushed before query
      // (for example before request from api)
      this.databaseService.getConferences().pipe(takeUntil(this.unsubscribe$)).subscribe(
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
        }
      );
    }
  }

  onSearch(searching: boolean): void {
    this.searching = searching;
  }

  ngOnDestroy() {
    this.state.remove(CONFERENCES_STATE_KEY);

    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
