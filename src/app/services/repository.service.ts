import { environment } from '../../environments/environment';

import { Injectable, OnDestroy } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { Observable, Subject, of, from, concat, zip, throwError } from 'rxjs';
import { tap, map, reduce, switchMap, first, delayWhen, catchError, takeUntil } from 'rxjs/operators';

import { AuthService } from '../components/auth/auth.service';
import { DatabaseService } from './database/database.service';
import { MessengerService } from '../components/messenger/messenger.service';
import { CrypterService } from './crypter.service';

import { User } from '../models/user.model';
import { Conference } from '../models/conference.model';
import { Message } from '../models/message.model';

// The purpose of this repository is to encapsulate the logic of getting records from either API or IndexeDB.
// Most of the methods get records straight from IndexeDB, if the application is synchronized
// and fallback on API in case the count of records < BATCH_SIZE, to get rest of them.
// And otherwise, if the application is not synchronized, these methods get at least a last records from IndexeDB
// and fallback on API, to get a fresh records.

@Injectable()
export class RepositoryService implements OnDestroy {
  private unsubscribe$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private databaseService: DatabaseService,
    private messengerService: MessengerService,
    private crypterService: CrypterService
  ) { }

  synchronize(): Observable<void> {
    // Get a timestamp from the last record
    // Then get the updates older than that timestamp
    return zip(
      this.databaseService.getConferences(Date.now() / 1000, 1).pipe(first()),
      this.databaseService.getMessages(Date.now() / 1000, 1).pipe(first()),
      this.databaseService.getUnreadMessages(0, 1).pipe(first())
    ).pipe(
      map(([ conferences, messages, unreadMessages ]) => {
        let minTimestamp = Date.now() / 1000;
        let maxTimestamp = 0;

        let conference = null;
        let message = null;
        let unreadMessage = null;

        if (conferences.length === 1)
          conference = conferences[0];

        if (messages.length === 1)
          message = messages[0];

        if (unreadMessages.length === 1)
          unreadMessage = unreadMessages[0];
          
        maxTimestamp = Math.min(
          maxTimestamp,
          conference ? conference.updated : 0,
          message ? message.date : 0
        );

        minTimestamp = Math.max(
          minTimestamp,
          unreadMessage ? unreadMessage.date : 0
        );

        return [ minTimestamp, maxTimestamp ];
      }),
      switchMap(([ minTimestamp, maxTimestamp ]) => this.messengerService.synchronize(minTimestamp, maxTimestamp)),
      delayWhen(() => this.databaseService.user$),
      switchMap((data: { conferences: Conference[], messages: Message[], read_messages: Message[], unread_messages: Message[] }) => zip(
        of(data['conferences']),
        zip(
          from(data['messages']),
          concat(...data['messages'].map(m => this.crypterService.decrypt(m.content, this.authService.user.private_key)))
        ).pipe(
          reduce((acc, [ message, decrypted ]) => {
            message.content = decrypted;

            return [ ...acc, message ];
          }, [] as Message[]),
        ),
        of(data['read_messages']),
        zip(
          from(data['unread_messages']),
          concat(...data['unread_messages'].map(m => this.crypterService.decrypt(m.content, this.authService.user.private_key)))
        ).pipe(
          reduce((acc, [ message, decrypted ]) => {
            message.content = decrypted;

            return [ ...acc, message ];
          }, [] as Message[]),
        ),
      )),
      switchMap(([ conferences, messages, read_messages, unread_messages ]) => this.databaseService.synchronize(conferences, messages, read_messages, unread_messages)),
      takeUntil(this.unsubscribe$)
    );
  }

  getUser(uuid: string): Observable<User> {
    return this.databaseService.getUser(uuid).pipe(
      first(),
      switchMap((user: User|null) => {
        if (!user)
          return this.authService.getUser(uuid);

        return of(user);
      }),
      takeUntil(this.unsubscribe$)
    );
  }

  getConferences(timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Conference[]> {
    return this.databaseService.isSynchronized$.pipe(
      first(),
      switchMap((isSynchronized: boolean) => {
        if (isSynchronized) {
          return this.databaseService.getConferences(timestamp, limit).pipe(
            first(),
            switchMap((conferences: Conference[]) => {
              if (conferences.length === limit)
                return of(conferences);

              timestamp = !!conferences.length ? conferences[conferences.length - 1].updated : timestamp;

              return this.messengerService.getConferences(timestamp, limit - conferences.length).pipe(
                // In order to store a records into the IndexeDB in the background, you have to apply a nested subscribes anti-pattern
                // Let me know if you know a solution how to avoid this
                tap((conferences: Conference[]) => this.databaseService.bulkUpsertConferences(conferences).subscribe()),
                map((c: Conference[]) => c.reduce((acc, cur) => {
                  if (acc.find((conference: Conference) => conference.uuid === cur.uuid)) {
                    acc[acc.findIndex((conference: Conference) => conference.uuid === cur.uuid)] = cur;

                    return acc;
                  }

                  return [ ...acc, cur ];
                }, conferences)),
                catchError((err: HttpErrorResponse) => {
                  // What status codes responsable for timeout errors? 408, 504 what else?
                  if (err.status === 408 || err.status === 504)
                    return of(conferences);

                  return throwError(err);
                })
              );
            })
          );
        }

        return this.databaseService.getConferences(timestamp, limit).pipe(
          first(),
          switchMap((conferences: Conference[]) => this.messengerService.getConferences(timestamp, limit).pipe(
            // In order to store a records into the IndexeDB in the background, you have to apply a nested subscribes anti-pattern
            // Let me know if you know a solution how to avoid this
            tap((conferences: Conference[]) => this.databaseService.bulkUpsertConferences(conferences).subscribe()),
              catchError((err: HttpErrorResponse) => {
              // What status codes responsable for timeout errors? 408, 504 what else?
              if (err.status === 408 || err.status === 504)
                return of(conferences);

              return throwError(err);
            })
          ))
        );
      }),
      map((conferences: Conference[]) => conferences.sort((a: Conference, b: Conference) => b.updated - a.updated)),
      takeUntil(this.unsubscribe$)
    );
  }

  getOldConferences(timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Conference[]> {
    return this.databaseService.isSynchronized$.pipe(
      first(),
      switchMap((isSynchronized: boolean) => {
        if (isSynchronized) {
          return this.databaseService.getOldConferences(timestamp, limit).pipe(
            first(),
            switchMap((conferences: Conference[]) => {
              if (conferences.length === limit)
                return of(conferences);

              timestamp = !!conferences.length ? conferences[conferences.length - 1].updated : timestamp;

              return this.messengerService.getOldConferences(timestamp, limit - conferences.length).pipe(
                // In order to store a records into the IndexeDB in the background, you have to apply a nested subscribes anti-pattern
                // Let me know if you know a solution how to avoid this
                tap((conferences: Conference[]) => this.databaseService.bulkUpsertConferences(conferences).subscribe()),
                map((c: Conference[]) => c.reduce((acc, cur) => {
                  if (acc.find((conference: Conference) => conference.uuid === cur.uuid)) {
                    acc[acc.findIndex((conference: Conference) => conference.uuid === cur.uuid)] = cur;

                    return acc;
                  }

                  return [ ...acc, cur ];
                }, conferences)),
                catchError((err: HttpErrorResponse) => {
                  // What status codes responsable for timeout errors? 408, 504 what else?
                  if (err.status === 408 || err.status === 504)
                    return of(conferences);

                  return throwError(err);
                })
              );
            })
          );
        }

        return this.databaseService.getOldConferences(timestamp, limit).pipe(
          first(),
          switchMap((conferences: Conference[]) => this.messengerService.getOldConferences(timestamp, limit).pipe(
            // In order to store a records into the IndexeDB in the background, you have to apply a nested subscribes anti-pattern
            // Let me know if you know a solution how to avoid this
            tap((conferences: Conference[]) => this.databaseService.bulkUpsertConferences(conferences).subscribe()),
            catchError((err: HttpErrorResponse) => {
              // What status codes responsable for timeout errors? 408, 504 what else?
              if (err.status === 408 || err.status === 504)
                return of(conferences);

              return throwError(err);
            })
          ))
        );
      }),
      map((conferences: Conference[]) => conferences.sort((a: Conference, b: Conference) => b.updated - a.updated)),
      takeUntil(this.unsubscribe$)
    );
  } 

  getConferenceByParticipant(uuid: string): Observable<Conference|null> {
    return this.databaseService.getConferenceByParticipant(uuid).pipe(
      first(),
      switchMap((conference: Conference|null) => {
        if (!conference) {
          return this.messengerService.getConferenceByParticipant(uuid).pipe(
            // In order to store a records into the IndexeDB in the background, you have to apply a nested subscribes anti-pattern
            // Let me know if you know a solution how to avoid this
            tap((conference: Conference|null) => {
              if (conference)
                this.databaseService.upsertConference(conference).subscribe();
            }),
            catchError((err: HttpErrorResponse) => {
              // What status codes responsable for timeout errors? 408, 504 what else?
              if (err.status === 408 || err.status === 504)
                return of(null);

              return throwError(err);
            })
          );
        }

        return of(conference);
      }),
      takeUntil(this.unsubscribe$)
    );
  }

  getMessagesByParticipant(uuid: string, timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Message[]> {
    return this.databaseService.isSynchronized$.pipe(
      first(),
      switchMap((isSynchronized: boolean) => {
        if (isSynchronized) {
          return this.databaseService.getMessagesByParticipant(uuid, timestamp, limit).pipe(
            first(),
            switchMap((messages: Message[]) => {
              if (messages.length === limit)
                return of(messages);

              timestamp = !!messages.length ? messages[0].date : timestamp;

              return this.messengerService.getMessagesByParticipant(uuid, timestamp, limit - messages.length).pipe(
                delayWhen(() => this.databaseService.user$),
                switchMap((messages: Message[]) => {
                  let decrypted$ = concat(...messages.map(m => this.crypterService.decrypt(m.content, this.authService.user.private_key)));

                  return zip(from(messages), decrypted$).pipe(
                    reduce((acc, [ message, decrypted ]) => {
                      message.content = decrypted;

                      return [ ...acc, message ];
                    }, [] as Message[])
                  );
                }),
                // In order to store a records into the IndexeDB in the background, you have to apply a nested subscribes anti-pattern
                // Let me know if you know a solution how to avoid this
                tap((messages: Message[]) => this.databaseService.bulkUpsertMessages(messages).subscribe()),
                map((m: Message[]) => m.reduce((acc, cur) => {
                  if (acc.find((m: Message) => m.uuid === cur.uuid)) {
                    acc[acc.findIndex((m: Message) => m.uuid === cur.uuid)] = cur;

                    return acc;
                  }

                  return [ ...acc, cur ];
                }, messages)),
                catchError((err: HttpErrorResponse) => {
                  // What status codes responsable for timeout errors? 408, 504 what else?
                  if (err.status === 408 || err.status === 504)
                    return of(messages);

                  return throwError(err);
                })
              )
            })
          );
        }

        return this.databaseService.getMessagesByParticipant(uuid, timestamp, limit).pipe(
          first(),
          switchMap((messages: Message[]) => this.messengerService.getMessagesByParticipant(uuid, timestamp, limit).pipe(
            delayWhen(() => this.databaseService.user$),
            switchMap((messages: Message[]) => {
              let decrypted$ = concat(...messages.map(m => this.crypterService.decrypt(m.content, this.authService.user.private_key)));

              return zip(from(messages), decrypted$).pipe(
                reduce((acc, [ message, decrypted ]) => {
                  message.content = decrypted;

                  return [ ...acc, message ];
                }, [] as Message[])
              );
            }),
            // In order to store a records into the IndexeDB in the background, you have to apply a nested subscribes anti-pattern
            // Let me know if you know a solution how to avoid this
            tap((messages: Message[]) => this.databaseService.bulkUpsertMessages(messages).subscribe()),
            catchError((err: HttpErrorResponse) => {
              // What status codes responsable for timeout errors? 408, 504 what else?
              if (err.status === 408 || err.status === 504)
                return of(messages);

              return throwError(err);
            })
          ))
        );
      }),
      map((messages: Message[]) => messages.sort((a: Message, b: Message) => a.date - b.date)),
      takeUntil(this.unsubscribe$)
    );
  }

  getUnreadMessagesByParticipant(uuid: string, timestamp: number = 0, limit: number = environment.batch_size): Observable<Message[]> {
    return this.databaseService.isSynchronized$.pipe(
      first(),
      switchMap((isSynchronized: boolean) => {
        if (isSynchronized) {
          return this.databaseService.getUnreadMessagesByParticipant(uuid, timestamp, limit).pipe(
            first(),
            switchMap((messages: Message[]) => {
              if (messages.length === limit)
                return of(messages);

              timestamp = !!messages.length ? messages[messages.length - 1].date : timestamp;

              return this.messengerService.getUnreadMessagesByParticipant(uuid, timestamp, limit - messages.length).pipe(
                delayWhen(() => this.databaseService.user$),
                switchMap((messages: Message[]) => {
                  let decrypted$ = concat(...messages.map(m => this.crypterService.decrypt(m.content, this.authService.user.private_key)));

                  return zip(from(messages), decrypted$).pipe(
                    reduce((acc, [ message, decrypted ]) => {
                      message.content = decrypted;

                      return [ ...acc, message ];
                    }, [] as Message[])
                  )
                }),
                // In order to store a records into the IndexeDB in the background, you have to apply a nested subscribes anti-pattern
                // Let me know if you know a solution how to avoid this
                tap((messages: Message[]) => this.databaseService.bulkUpsertMessages(messages).subscribe()),
                map((m: Message[]) => m.reduce((acc, cur) => {
                  if (acc.find((m: Message) => m.uuid === cur.uuid)) {
                    acc[acc.findIndex((m: Message) => m.uuid === cur.uuid)] = cur;

                    return acc;
                  }

                  return [ ...acc, cur ];
                }, messages)),
                catchError((err: HttpErrorResponse) => {
                  // What status codes responsable for timeout errors? 408, 504 what else?
                  if (err.status === 408 || err.status === 504)
                    return of(messages);

                  return throwError(err);
                })
              );
            })
          );
        }

        return this.messengerService.getUnreadMessagesByParticipant(uuid, timestamp, limit).pipe(
          delayWhen(() => this.databaseService.user$),
          switchMap((messages: Message[]) => {
            let decrypted$ = concat(...messages.map(m => this.crypterService.decrypt(m.content, this.authService.user.private_key)));

            return zip(from(messages), decrypted$).pipe(
              reduce((acc, [ message, decrypted ]) => {
                message.content = decrypted;

                return [ ...acc, message ];
              }, [] as Message[])
            );
          }),
          // In order to store a records into the IndexeDB in the background, you have to apply a nested subscribes anti-pattern
          // Let me know if you know a solution how to avoid this
          tap((messages: Message[]) => this.databaseService.bulkUpsertMessages(messages).subscribe()),
          catchError((err: HttpErrorResponse) => {
            // What status codes responsable for timeout errors? 408, 504 what else?
            if (err.status === 408 || err.status === 504)
              return of([] as Message[]);

            return throwError(err);
          })
        );
      }),
      map((messages: Message[]) => messages.sort((a: Message, b: Message) => a.date - b.date)),
      takeUntil(this.unsubscribe$)
    );
  }

  getOldMessagesByParticipant(uuid: string, timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Message[]> {
    return this.databaseService.isSynchronized$.pipe(
      first(),
      switchMap((isSynchronized: boolean) => {
        if (isSynchronized) {
          return this.databaseService.getOldMessagesByParticipant(uuid, timestamp, limit).pipe(
            first(),
            switchMap((messages: Message[]) => {
              if (messages.length === limit)
                return of(messages);

              timestamp = !!messages.length ? messages[0].date : timestamp;
              
              return this.messengerService.getOldMessagesByParticipant(uuid, timestamp, limit - messages.length).pipe(
                delayWhen(() => this.databaseService.user$),
                switchMap((messages: Message[]) => {
                  let decrypted$ = concat(...messages.map(m => this.crypterService.decrypt(m.content, this.authService.user.private_key)));

                  return zip(from(messages), decrypted$).pipe(
                    reduce((acc, [ message, decrypted ]) => {
                      message.content = decrypted;

                      return [ ...acc, message ];
                    }, [] as Message[])
                  );
                }),
                // In order to store a records into the IndexeDB in the background, you have to apply a nested subscribes anti-pattern
                // Let me know if you know a solution how to avoid this
                tap((messages: Message[]) => this.databaseService.bulkUpsertMessages(messages).subscribe()),
                map((m: Message[]) => m.reduce((acc, cur) => {
                  if (acc.find((m: Message) => m.uuid === cur.uuid)) {
                    acc[acc.findIndex((m: Message) => m.uuid === cur.uuid)] = cur;

                    return acc;
                  }

                  return [ ...acc, cur ];
                }, messages)),
                catchError((err: HttpErrorResponse) => {
                  // What status codes responsable for timeout errors? 408, 504 what else?
                  if (err.status === 408 || err.status === 504)
                    return of(messages);

                  return throwError(err);
                })
              );
            })
          );
        }

        return this.databaseService.getOldMessagesByParticipant(uuid, timestamp, limit).pipe(
          first(),
          switchMap((messages: Message[]) => {
            return this.messengerService.getOldMessagesByParticipant(uuid, timestamp, limit).pipe(
              delayWhen(() => this.databaseService.user$),
              switchMap((messages: Message[]) => {
                let decrypted$ = concat(...messages.map(m => this.crypterService.decrypt(m.content, this.authService.user.private_key)));

                return zip(from(messages), decrypted$).pipe(
                  reduce((acc, [ message, decrypted ]) => {
                    message.content = decrypted;

                    return [ ...acc, message ];
                  }, [] as Message[])
                );
              }),
              // In order to store a records into the IndexeDB in the background, you have to apply a nested subscribes anti-pattern
              // Let me know if you know a solution how to avoid this
              tap((messages: Message[]) => this.databaseService.bulkUpsertMessages(messages).subscribe()),
              catchError((err: HttpErrorResponse) => {
                // What status codes responsable for timeout errors? 408, 504 what else?
                if (err.status === 408 || err.status === 504)
                  return of(messages);

                return throwError(err);
              })
            )
          })
        );
      }),
      map((messages: Message[]) => messages.sort((a: Message, b: Message) => a.date - b.date)),
      takeUntil(this.unsubscribe$)
    );
  }

  getNewMessagesByParticipant(uuid: string, timestamp: number = 0, limit: number = environment.batch_size): Observable<Message[]> {
    return this.databaseService.isSynchronized$.pipe(
      first(),
      switchMap((isSynchronized: boolean) => {
        if (isSynchronized) {
          return this.databaseService.getNewMessagesByParticipant(uuid, timestamp, limit).pipe(
            first(),
            switchMap((messages: Message[]) => {
              if (messages.length === limit)
                return of(messages);

              timestamp = !!messages.length ? messages[messages.length - 1].date : timestamp;

              return this.messengerService.getNewMessagesByParticipant(uuid, timestamp, limit - messages.length).pipe(
                delayWhen(() => this.databaseService.user$),
                switchMap((messages: Message[]) => {
                  let decrypted$ = concat(...messages.map(m => this.crypterService.decrypt(m.content, this.authService.user.private_key)));

                  return zip(from(messages), decrypted$).pipe(
                    reduce((acc, [ message, decrypted ]) => {
                      message.content = decrypted;

                      return [ ...acc, message ];
                    }, [] as Message[])
                  );
                }),
                // In order to store a records into the IndexeDB in the background, you have to apply a nested subscribes anti-pattern
                // Let me know if you know a solution how to avoid this
                tap((messages: Message[]) => this.databaseService.bulkUpsertMessages(messages)),
                map((m: Message[]) => m.reduce((acc, cur) => {
                  if (acc.find((m: Message) => m.uuid === cur.uuid)) {
                    acc[acc.findIndex((m: Message) => m.uuid === cur.uuid)] = cur;

                    return acc;
                  }

                  return [ ...acc, cur ];
                }, messages)),
                catchError((err: HttpErrorResponse) => {
                  // What status codes responsable for timeout errors? 408, 504 what else?
                  if (err.status === 408 || err.status === 504)
                    return of(messages);

                  return throwError(err);
                })
              );
            })
          );
        }

        return this.databaseService.getNewMessagesByParticipant(uuid, timestamp, limit).pipe(
          first(),
          switchMap((messages: Message[]) => {
            return this.messengerService.getNewMessagesByParticipant(uuid, timestamp, limit).pipe(
              delayWhen(() => this.databaseService.user$),
              switchMap((messages: Message[]) => {
                let decrypted$ = concat(...messages.map(m => this.crypterService.decrypt(m.content, this.authService.user.private_key)));

                return zip(from(messages), decrypted$).pipe(
                  reduce((acc, [ message, decrypted ]) => {
                    message.content = decrypted;

                    return [ ...acc, message ];
                  }, [] as Message[])
                );
              }),
              // In order to store a records into the IndexeDB in the background, you have to apply a nested subscribes anti-pattern
              // Let me know if you know a solution how to avoid this
              tap((messages: Message[]) => this.databaseService.bulkUpsertMessages(messages).subscribe()),
              catchError((err: HttpErrorResponse) => {
                // What status codes responsable for timeout errors? 408, 504 what else?
                if (err.status === 408 || err.status === 504)
                  return of(messages);

                return throwError(err);
              })
            );
          })
        );
      }),
      map((messages: Message[]) => messages.sort((a: Message, b: Message) => a.date - b.date)),
      takeUntil(this.unsubscribe$)
    );
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
