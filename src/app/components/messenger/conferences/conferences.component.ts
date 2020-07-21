import { Component, Injector, Inject, OnInit, OnDestroy } from '@angular/core';

import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { TransferState, makeStateKey } from '@angular/platform-browser';

import { Observable, Subject, of, concat } from 'rxjs';
import { map, tap, switchMap, delayWhen, takeUntil } from 'rxjs/operators';

import { DatabaseService } from '../../../services/database.service';
import { MessengerService } from '../messenger.service';
import { RepositoryService } from '../../../services/repository.service';

import { SocketService } from '../../../services/socket.service'

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
  isOldConferencesLoading: boolean = false;

  conferences: Conference[] = [];

  private unsubscribe$ = new Subject<void>();
  
  private databaseService: DatabaseService;
  private repositoryService: RepositoryService;
  private socketService: SocketService;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private messengerService: MessengerService,
    private state: TransferState,
    private injector: Injector
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.databaseService = injector.get(DatabaseService);
      this.repositoryService = injector.get(RepositoryService);
      this.socketService = injector.get(SocketService);
    }
  }

  ngOnInit() {
    if (isPlatformServer(this.platformId)) {
      this.messengerService.getConferences().subscribe((conferences: Conference[]) => {
        this.state.set(CONFERENCES_STATE_KEY, conferences as Conference[]);

        this.conferences = conferences;

        this.conferences.sort((a: Conference, b: Conference) => b.updated - a.updated);
      });
    }

    if (isPlatformBrowser(this.platformId)) {
      this.conferences = this.state.get(CONFERENCES_STATE_KEY, [] as Conference[]);

      this.conferences.sort((a: Conference, b: Conference) => b.updated - a.updated);

      // In case Conferences already loaded from server-side-rendering
      if (!!this.conferences.length)
        this.databaseService.bulkConferences(this.conferences).subscribe();

      if (!this.conferences.length) {
        this.isConferencesLoading = true;

        this.repositoryService.getConferences().pipe(
          takeUntil(this.unsubscribe$)
        ).subscribe((conferences: Conference[]) => {
          this.conferences = conferences.reduce((acc, cur) => {
            if (acc.find((c: Conference) => c.uuid === cur.uuid)) {
              acc[acc.findIndex((c: Conference) => c.uuid === cur.uuid)] = cur;

              return acc;
            }

            return [ ...acc, cur ];
          }, this.conferences);

          this.conferences.sort((a: Conference, b: Conference) => b.updated - a.updated);

          this.isConferencesLoading = false;
        });
      }

      this.socketService.conferenceUpdated$.pipe(
        takeUntil(this.unsubscribe$),
      ).subscribe((conference: Conference) => {
        if (this.conferences.find(c => c.uuid === conference.uuid))
          return this.conferences[this.conferences.findIndex(c => c.uuid === conference.uuid)] = conference;

        return this.conferences.unshift(conference);
      });
    }
  }

  onSearch(searching: boolean): void {
    this.searching = searching;
  }

  onScrollDown(timestamp: number): void {
    if (this.isOldConferencesLoading)
      return;

    this.isOldConferencesLoading = true;

    this.repositoryService.getOldConferences(timestamp).subscribe((conferences: Conference[]) => {
      this.conferences = conferences.reduce((acc, cur) => {
        if (acc.find((c: Conference) => c.uuid === cur.uuid)) {
          acc[acc.findIndex((c: Conference) => c.uuid === cur.uuid)] = cur;

          return acc;
        }

        return [ ...acc, cur ];
      }, this.conferences);

      this.conferences.sort((a: Conference, b: Conference) => b.updated - a.updated);

      this.isOldConferencesLoading = false;
    });
  }

  ngOnDestroy() {
    this.state.remove(CONFERENCES_STATE_KEY);

    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
