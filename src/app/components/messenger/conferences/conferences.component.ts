import { Component, Injector, Inject, OnInit, OnDestroy } from '@angular/core';

import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { TransferState, makeStateKey } from '@angular/platform-browser';

import { Observable, Subject, of, concat, merge, zip } from 'rxjs';
import { map, tap, reduce, ignoreElements, switchMap, concatMap, delayWhen, takeUntil } from 'rxjs/operators';

import { cloneDeep } from 'lodash';

import { CrypterService } from '../../../services/crypter.service';

import { AuthService } from '../../auth/auth.service';
import { DatabaseService } from '../../../services/database/database.service';
import { MessengerService } from '../messenger.service';
import { RepositoryService } from '../../../services/repository.service';

import { SocketService } from '../../../services/socket.service'

import Conference from '../../../models/conference.model';
import Message from '../../../models/message.model';

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
    private crypterService: CrypterService,
    private messengerService: MessengerService,
    public authService: AuthService,
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

        this.conferences.sort((a: Conference, b: Conference) => b.updated_at - a.updated_at);
      });
    }

    if (isPlatformBrowser(this.platformId)) {
      this.conferences = this.state.get(CONFERENCES_STATE_KEY, [] as Conference[]);

      this.conferences.sort((a: Conference, b: Conference) => b.updated_at - a.updated_at);

      // In case Conferences already loaded from server-side-rendering
      if (!!this.conferences.length) {
        let conferences: Conference[] = cloneDeep(this.conferences);

        of(conferences).pipe(
          switchMap((conferences: Conference[]) => concat(...conferences.map((c: Conference) => of(c))).pipe(
            concatMap((conference: Conference) => {
              if (conference.type !== 'private' || !('last_message' in conference))
                return of(conference);

              return zip(of(conference), this.databaseService.user$).pipe(
                switchMap(([ conference, user ]) => {
                  let decrypted$ = this.crypterService.decrypt(conference.last_message.content, user.private_key);

                  return zip(of(conference), decrypted$).pipe(
                    map(([ conference, decrypted ]) => {
                      conference.last_message.content = decrypted;

                      return conference;
                    })
                  );
                })
              );
            }),
            reduce((acc: Conference[], conference: Conference) => [ ...acc, conference ], [] as Conference[])
          )),
          switchMap((conferences: Conference[]) => merge(
            this.databaseService.bulkConferences(conferences).pipe(ignoreElements()),
            of(conferences)
          ))
        ).subscribe((conferences: Conference[]) => {
          this.conferences = conferences.reduce((acc, cur) => {
            if (acc.find((c: Conference) => c.uuid === cur.uuid)) {
              acc[acc.findIndex((c: Conference) => c.uuid === cur.uuid)] = cur;

              return acc;
            }

            return [ ...acc, cur ];
          }, this.conferences);
        });
      }

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

          this.conferences.sort((a: Conference, b: Conference) => b.updated_at - a.updated_at);

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
    if (this.isOldConferencesLoading || this.conferences.length === this.authService.user.conferences_count)
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

      this.conferences.sort((a: Conference, b: Conference) => b.updated_at - a.updated_at);

      this.isOldConferencesLoading = false;
    });
  }

  ngOnDestroy() {
    this.state.remove(CONFERENCES_STATE_KEY);

    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
