import { environment } from '../../environments/environment';

import { Injectable, OnDestroy } from '@angular/core';

import { Observable, Subject, BehaviorSubject, interval, concat } from 'rxjs';
import { tap, finalize, filter, distinctUntilChanged, ignoreElements, switchMap, shareReplay, takeUntil } from 'rxjs/operators';

import { isEqual } from 'lodash';

import { AuthService } from '../components/auth/auth.service';

import { User } from '../models/user.model';
import { Conference } from '../models/conference.model';
import { Message } from '../models/message.model';

@Injectable()
export class DatabaseService implements OnDestroy {
  private unsubscribe$ = new Subject<void>();

  public isSynchronized$ = new BehaviorSubject<boolean>(false);

  public db$ = (new Observable<IDBDatabase>(subscriber => {
    const db: IDBOpenDBRequest = indexedDB.open('crypter');

    db.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      // Property 'result' does not exist on type 'EventTarget'.
      // https://github.com/microsoft/TypeScript/issues/28293
      let db = (e.target as IDBOpenDBRequest).result;

      db.onerror = (err: Event) => {
        subscriber.error(err);
      };

      let users = db.createObjectStore('users', { keyPath: 'uuid' }) ;

      let conferences = db.createObjectStore('conferences', { keyPath: 'uuid' });
      conferences.createIndex('updated_at', 'updated_at');
      conferences.createIndex('participant', 'participant', { unique: true });

      let messages = db.createObjectStore('messages', { keyPath: 'uuid' });
      messages.createIndex('conference', 'conference');
      messages.createIndex('date', 'date');
      messages.createIndex('readedAt', 'readedAt');
    };

    db.onsuccess = (e: Event) => {
      subscriber.next(db.result);
      subscriber.complete();
    };
  })).pipe(
    shareReplay(1)
  );

  public user$ = concat(
    this.getUser(this.authService.user.uuid),
    interval(333).pipe(
      switchMap(() => this.getUser(this.authService.user.uuid))
    )
  ).pipe(
    filter((user: User) => !!user),
    distinctUntilChanged((x: User, y: User) => isEqual(x, y)),
    takeUntil(this.unsubscribe$),
    shareReplay(1)
  );

  constructor(private authService: AuthService) { }

  synchronize(
    conferences: Conference[] = [],
    messages: Message[] = [],
    read_messages: Message[] = [],
    unread_messages: Message[] = [],
  ): Observable<void> {
    return concat(
      this.bulkConferences(conferences),
      this.bulkMessages(messages),
      this.readMessages(read_messages),
      this.bulkMessages(unread_messages)
    ).pipe(
      ignoreElements(),
      finalize(() => this.isSynchronized$.next(true))
    );
  }

  getUser(uuid: string): Observable<User|null> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<User|null>(subscriber => {
        let transaction: IDBTransaction = db.transaction('users');
        let store: IDBObjectStore = transaction.objectStore('users');

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        store.get(uuid).onsuccess = (e: Event) => {
          let u = (e.target as IDBRequest).result;

          if (!u) {
            subscriber.next(null);

            return;
          }

          let user: User = u;

          subscriber.next(user);
        };

        transaction.oncomplete = (e: Event) => {
          subscriber.complete();
        };
      }))
    );
  }

  upsertUser(user: User): Observable<User> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<User>(subscriber => {
        let transaction: IDBTransaction = db.transaction('users', 'readwrite');
        let store: IDBObjectStore = transaction.objectStore('users');

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        store.get(user.uuid).onsuccess = (e: Event) => {
          let u = (e.target as IDBRequest).result;

          if (u)
            user = Object.assign(u, user);

          store.put(user);
        };

        transaction.oncomplete = (e: Event) => {
          subscriber.next(user);
          subscriber.complete();
        };
      }))
    );
  }

  bulkUsers(users: User[]): Observable<User[]> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<User[]>(subscriber => {
        let transaction: IDBTransaction = db.transaction('users', 'readwrite');
        let store: IDBObjectStore = transaction.objectStore('users');

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        users.map((u: User) => store.put(u));

        transaction.oncomplete = (e: Event) => {
          subscriber.next(users);
          subscriber.complete();
        };
      }))
    );
  }

  getConference(uuid: string): Observable<Conference|null> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Conference|null>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        conferencesStore.get(uuid).onsuccess = (e: Event) => {
          let c = (e.target as IDBRequest).result;

          if (!c) {
            subscriber.next(null);

            return;
          }

          if ('participant' in c) {
            usersStore.get(c.participant).onsuccess = (e: Event) => {
              let participant: User = (e.target as IDBRequest).result;

              let conference: Conference = { ...c, participant };

              subscriber.next(conference);
            };

            return;
          }

          let conference: Conference = c;

          subscriber.next(conference);
        };

        transaction.oncomplete = (e: Event) => {
          subscriber.complete();
        };
      }))
    );
  }

  getConferenceByParticipant(uuid: string): Observable<Conference|null> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Conference|null>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');

        let index: IDBIndex = conferencesStore.index('participant');

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        index.get(uuid).onsuccess = (e: Event) => {
          let c = (e.target as IDBRequest).result;

          if (!c) {
            subscriber.next(null);

            return;
          }

          usersStore.get(c.participant).onsuccess = (e: Event) => {
            let participant: User = (e.target as IDBRequest).result;

            let conference: Conference = { ...c, participant };

            subscriber.next(conference);
          };
        };

        transaction.oncomplete = (e: Event) => {
          subscriber.complete();
        };
      }))
    );
  }

  getConferences(timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Conference[]> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Conference[]>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');

        let index: IDBIndex = conferencesStore.index('updated_at');

        let i = 0;

        let conferences: Conference[] = [] as Conference[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        index
          .openCursor(IDBKeyRange.upperBound(timestamp, true), 'prev')
          .onsuccess = (e: Event) => {
            let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

            if (!cursor || i === limit) {
              return;
            }

            let c = cursor.value;

            if ('participant' in c) {
              usersStore.get(c.participant).onsuccess = (e: Event) => {
                let participant: User = (e.target as IDBRequest).result;

                let conference: Conference = Object.assign(c, { participant });

                conferences.push(conference);

                i++;

                cursor.continue();
              };

              return;
            }

            let conference: Conference = c;

            conferences.push(conference);

            i++;

            cursor.continue();
          };

        transaction.oncomplete = (e: Event) => {
          conferences.sort((a: Conference, b: Conference) => b.updated_at - a.updated_at);

          subscriber.next(conferences);
          subscriber.complete();
        };
      }))
    );
  }

  getOldConferences(timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Conference[]> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Conference[]>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');

        let index: IDBIndex = conferencesStore.index('updated_at');

        let i = 0;

        let conferences: Conference[] = [] as Conference[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };
        
        index
          .openCursor(IDBKeyRange.upperBound(timestamp, true), 'prev')
          .onsuccess = (e: Event) => {
            let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

            if (!cursor || i === limit) {
              return;
            }

            let c = cursor.value;

            if ('participant' in c) {
              usersStore.get(c.participant).onsuccess = (e: Event) => {
                let participant: User = (e.target as IDBRequest).result;

                let conference: Conference = Object.assign(c, { participant });

                conferences.push(conference);

                i++;

                cursor.continue();
              };

              return;
            }

            let conference: Conference = c;

            conferences.push(conference);

            i++;

            cursor.continue();
          };

        transaction.oncomplete = (e: Event) => {
          conferences.sort((a: Conference, b: Conference) => b.updated_at - a.updated_at);

          subscriber.next(conferences);
          subscriber.complete();
        };
      }))
    );
  }

  upsertConference(conference: Conference): Observable<Conference> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Conference>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences' ], 'readwrite');
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        let {
          participants = undefined,
          last_message = undefined,
          ...c
        } = 'participant' in conference ? { ...conference, participant: conference.participant.uuid } : conference;

        conferencesStore.get(conference.uuid).onsuccess = (e: Event) => {
          if (!(e.target as IDBRequest).result) {
            if ('participant' in conference) {
              usersStore.get(conference.participant.uuid).onsuccess = (e: Event) => {
                if (!(e.target as IDBRequest).result) {
                  usersStore.put(conference.participant);
                }
              };
            }

            conferencesStore.put(c).onsuccess = (e: Event) => {
              subscriber.next(conference);
            };

            return;
          }

          conferencesStore.put(Object.assign((e.target as IDBRequest).result, c)).onsuccess = (e: Event) => {
            subscriber.next(conference);
          };
        };

        transaction.oncomplete = (e: Event) => {
          subscriber.complete();
        };
      }))
    );
  }

  bulkConferences(conferences: Conference[]): Observable<Conference[]> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Conference[]>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences' ], 'readwrite');
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        conferences.map((conference: Conference) => {
          let {
            participants = undefined,
            last_message = undefined,
              ...c
          } = 'participant' in conference ? { ...conference, participant: conference.participant.uuid } : conference;

          conferencesStore.get(conference.uuid).onsuccess = (e: Event) => {
            if (!(e.target as IDBRequest).result) {
              if ('participant' in conference) {
                usersStore.get(conference.participant.uuid).onsuccess = (e: Event) => {
                  if (!(e.target as IDBRequest).result) {
                    usersStore.put(conference.participant);
                  }
                };
              }

              conferencesStore.put(c);

              return;
            }

            conferencesStore.put(Object.assign((e.target as IDBRequest).result, c));
          };
        });

        transaction.oncomplete = (e: Event) => {
          subscriber.next(conferences);
          subscriber.complete();
        };
      }))
    );
  }

  getMessage(uuid: string): Observable<Message|null> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Message|null>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        messagesStore.get(uuid).onsuccess = (e: Event) => {
          let m = (e.target as IDBRequest).result;

          if (!m) {
            subscriber.next(null);

            return;
          }

          conferencesStore.get(m.conference).onsuccess = (e: Event) => {
            let c = (e.target as IDBRequest).result;

            if ('participant' in c) {
              usersStore.get(c.participant).onsuccess = (e: Event) => {
                let participant: User = (e.target as IDBRequest).result;

                let conference: Conference = { ...c, participant };

                usersStore.get(m.author).onsuccess = (e: Event) => {
                  let author: User = (e.target as IDBRequest).result;

                  let message: Message = { ...m, conference, author };

                  subscriber.next(message);
                };
              };

              return;
            }

            let conference: Conference = c;

            usersStore.get(m.author).onsuccess = (e: Event) => {
              let author: User = (e.target as IDBRequest).result;

              let message: Message = { ...m, conference, author };

              subscriber.next(message);
            };
          };

          transaction.oncomplete = (e: Event) => {
            subscriber.complete();
          };
        };
      }))
    );
  }

  getMessages(timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Message[]> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Message[]>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        let index: IDBIndex = messagesStore.index('date');

        let i = 0;

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        index
          .openCursor(IDBKeyRange.upperBound(timestamp, true), 'prev') 
          .onsuccess = (e: Event) => {
            let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

            if (!cursor || i === limit) {
              return;
            }

            let m = cursor.value;

            conferencesStore.get(m.conference).onsuccess = (e: Event) => {
              let c = (e.target as IDBRequest).result;

              if ('participant' in c) {
                usersStore.get(c.participant).onsuccess = (e: Event) => {
                  let participant: User = (e.target as IDBRequest).result;

                  let conference: Conference = { ...c, participant };

                  usersStore.get(m.author).onsuccess = (e: Event) => {
                    let author: User = (e.target as IDBRequest).result;

                    let message: Message = { ...m, conference, author };

                    messages.unshift(message);

                    i++;

                    cursor.continue();
                  };
                };

                return;
              }

              let conference: Conference = c;

              usersStore.get(m.author).onsuccess = (e: Event) => {
                let author: User = (e.target as IDBRequest).result;

                let message: Message = { ...m, conference, author };

                messages.unshift(message);

                i++;

                cursor.continue();
              };
            };
          };

          transaction.oncomplete = (e: Event) => {
            messages.sort((a: Message, b: Message) => a.date - b.date);

            subscriber.next(messages);
            subscriber.complete();
          };
      }))
    );
  }

  getUnreadMessages(timestamp: number = 0, limit: number = environment.batch_size): Observable<Message[]> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Message[]>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        let index: IDBIndex = messagesStore.index('date');

        let i = 0;

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        index
          .openCursor(IDBKeyRange.lowerBound(timestamp, true))
          .onsuccess = (e: Event) => {
            let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

            if (!cursor || i === limit) {
              return;
            }

            let m = cursor.value;

            if (m.readed) {
              cursor.continue();

              return;
            }

            conferencesStore.get(m.conference).onsuccess = (e: Event) => {
              let c = (e.target as IDBRequest).result;

              if ('participant' in c) {
                usersStore.get(c.participant).onsuccess = (e: Event) => {
                  let participant: User = (e.target as IDBRequest).result;

                  let conference: Conference = { ...c, participant };

                  usersStore.get(m.author).onsuccess = (e: Event) => {
                    let author: User = (e.target as IDBRequest).result;

                    let message: Message = { ...m, conference, author };

                    messages.push(message);

                    i++;

                    cursor.continue();
                  };
                };

                return;
              }

              let conference: Conference = c;

              usersStore.get(m.author).onsuccess = (e: Event) => {
                let author: User = (e.target as IDBRequest).result;

                let message: Message = { ...m, conference, author };

                messages.push(message);

                i++;

                cursor.continue();
              };
            };
          };

          transaction.oncomplete = (e: Event) => {
            messages.sort((a: Message, b: Message) => a.date - b.date);

            subscriber.next(messages);
            subscriber.complete();
          };
      }))
    );
  }

  getReadMessages(timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Message[]> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Message[]>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        let index: IDBIndex = messagesStore.index('readedAt');

        let i = 0;

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        index
        .openCursor(IDBKeyRange.upperBound(timestamp, true), 'prev') 
        .onsuccess = (e: Event) => {
          let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

          if (!cursor || i === limit) {
            return;
          }

          let m = cursor.value;

          if (!m.readed) {
            cursor.continue();

            return;
          }

          conferencesStore.get(m.conference).onsuccess = (e: Event) => {
            let c = (e.target as IDBRequest).result;

            if ('participant' in c) {
              usersStore.get(c.participant).onsuccess = (e: Event) => {
                let participant: User = (e.target as IDBRequest).result;

                let conference: Conference = { ...c, participant };

                usersStore.get(m.author).onsuccess = (e: Event) => {
                  let author: User = (e.target as IDBRequest).result;

                  let message: Message = { ...m, conference, author };

                  messages.unshift(message);

                  i++;

                  cursor.continue();
                };
              };

              return;
            }

            let conference: Conference = c;

            usersStore.get(m.author).onsuccess = (e: Event) => {
              let author: User = (e.target as IDBRequest).result;

              let message: Message = { ...m, conference, author };

              messages.unshift(message);

              i++;

              cursor.continue();
            };
          };
        };

        transaction.oncomplete = (e: Event) => {
          messages.sort((a: Message, b: Message) => a.date - b.date);

          subscriber.next(messages);
          subscriber.complete();
        };
      }))
    );
  }

  getMessagesByParticipant(uuid: string, timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Message[]> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Message[]>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        let conferenceIndex: IDBIndex = conferencesStore.index('participant');
        let messagesIndex: IDBIndex = messagesStore.index('date');

        let i = 0;

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        conferenceIndex.get(uuid).onsuccess = (e: Event) => {
          let c = (e.target as IDBRequest).result;

          if (!c) {
            return;
          }

          usersStore.get(c.participant).onsuccess = (e: Event) => {
            let participant: User = (e.target as IDBRequest).result;

            let conference: Conference = { ...c, participant };

            messagesIndex
              .openCursor(IDBKeyRange.upperBound(timestamp, true), 'prev') 
              .onsuccess = (e: Event) => {
                let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

                if (!cursor || i === limit) {
                  return;
                }

                let m = cursor.value;

                if (m.conference !== conference.uuid) {
                  cursor.continue();

                  return;
                }

                usersStore.get(m.author).onsuccess = (e: Event) => {
                  let author: User = (e.target as IDBRequest).result;

                  let message: Message = { ...m, conference, author };

                  messages.unshift(message);

                  i++;

                  cursor.continue();
                };
              };
          };
        };

        transaction.oncomplete = (e: Event) => {
          messages.sort((a: Message, b: Message) => a.date - b.date);

          subscriber.next(messages);
          subscriber.complete();
        };
      }))
    );
  }

  getUnreadMessagesByParticipant(uuid: string, timestamp: number = 0, limit: number = environment.batch_size): Observable<Message[]> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Message[]>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        let conferenceIndex: IDBIndex = conferencesStore.index('participant');
        let messagesIndex: IDBIndex = messagesStore.index('date');

        let i = 0;

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        conferenceIndex.get(uuid).onsuccess = (e: Event) => {
          let c = (e.target as IDBRequest).result;

          if (!c) {
            return;
          }

          usersStore.get(c.participant).onsuccess = (e: Event) => {
            let participant: User = (e.target as IDBRequest).result;

            let conference: Conference = { ...c, participant };

            messagesIndex
              .openCursor(IDBKeyRange.lowerBound(timestamp, true)) 
              .onsuccess = (e: Event) => {
                let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

                if (!cursor || i === limit) {
                  return;
                }

                let m = cursor.value;

                if (m.conference !== conference.uuid || m.readed) {
                  cursor.continue();

                  return;
                }

                usersStore.get(m.author).onsuccess = (e: Event) => {
                  let author: User = (e.target as IDBRequest).result;

                  let message: Message = { ...m, conference, author };

                  messages.push(message);

                  i++;

                  cursor.continue();
                };
              };
          };
        };

        transaction.oncomplete = (e: Event) => {
          messages.sort((a: Message, b: Message) => a.date - b.date);

          subscriber.next(messages);
          subscriber.complete();
        };
      }))
    );
  }

  getOldMessagesByParticipant(uuid: string, timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Message[]> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Message[]>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        let conferenceIndex: IDBIndex = conferencesStore.index('participant');
        let messagesIndex: IDBIndex = messagesStore.index('date');

        let i = 0;

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        conferenceIndex.get(uuid).onsuccess = (e: Event) => {
          let c = (e.target as IDBRequest).result;

          if (!c) {
            return;
          }

          usersStore.get(c.participant).onsuccess = (e: Event) => {
            let participant: User = (e.target as IDBRequest).result;

            let conference: Conference = { ...c, participant };

            messagesIndex
              .openCursor(IDBKeyRange.upperBound(timestamp, true), 'prev') 
              .onsuccess = (e: Event) => {
                let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

                if (!cursor || i === limit) {
                  return;
                }

                let m = cursor.value;

                if (m.conference !== conference.uuid) {
                  cursor.continue();

                  return;
                }

                usersStore.get(m.author).onsuccess = (e: Event) => {
                  let author: User = (e.target as IDBRequest).result;

                  let message: Message = { ...m, conference, author };

                  messages.unshift(message);

                  i++;

                  cursor.continue();
                };
              };
          };
        };

        transaction.oncomplete = (e: Event) => {
          messages.sort((a: Message, b: Message) => a.date - b.date);

          subscriber.next(messages);
          subscriber.complete();
        };
      }))
    );
  }

  getNewMessagesByParticipant(uuid: string, timestamp: number = 0, limit: number = environment.batch_size): Observable<Message[]> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Message[]>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        let conferenceIndex: IDBIndex = conferencesStore.index('participant');
        let messagesIndex: IDBIndex = messagesStore.index('date');

        let i = 0;

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        conferenceIndex.get(uuid).onsuccess = (e: Event) => {
          let c = (e.target as IDBRequest).result;

          if (!c) {
            return;
          }

          usersStore.get(c.participant).onsuccess = (e: Event) => {
            let participant: User = (e.target as IDBRequest).result;

            let conference: Conference = { ...c, participant };

            messagesIndex
              .openCursor(IDBKeyRange.lowerBound(timestamp, true)) 
              .onsuccess = (e: Event) => {
                let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

                if (!cursor || i === limit) {
                  return;
                }

                let m = cursor.value;

                if (m.conference !== conference.uuid) {
                  cursor.continue();

                  return;
                }

                usersStore.get(m.author).onsuccess = (e: Event) => {
                  let author: User = (e.target as IDBRequest).result;

                  let message: Message = { ...m, conference, author };

                  messages.push(message);

                  i++;

                  cursor.continue();
                };
              };
          };
        };

        transaction.oncomplete = (e: Event) => {
          messages.sort((a: Message, b: Message) => a.date - b.date);

          subscriber.next(messages);
          subscriber.complete();
        };
      }))
    );
  }

  getMessagesByConference(uuid: string, timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Message[]> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Message[]>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        let index: IDBIndex = messagesStore.index('date');

        let i = 0;

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        conferencesStore.get(uuid).onsuccess = (e: Event) => {
          let c = (e.target as IDBRequest).result;

          if (!c) {
            return;
          }

          if ('participant' in c) {
            usersStore.get(c.participant).onsuccess = (e: Event) => {
              let participant: User = (e.target as IDBRequest).result;

              let conference: Conference = { ...c, participant };

              index
                .openCursor(IDBKeyRange.upperBound(timestamp, true), 'prev') 
                .onsuccess = (e: Event) => {
                  let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

                  if (!cursor || i === limit) {
                    return;
                  }

                  let m = cursor.value;

                  if (m.conference !== conference.uuid) {
                    cursor.continue();

                    return;
                  }

                  usersStore.get(m.author).onsuccess = (e: Event) => {
                    let author: User = (e.target as IDBRequest).result;

                    let message: Message = { ...m, conference, author };

                    messages.unshift(message);

                    i++;

                    cursor.continue();
                  };
                };
            };

            return;
          }

          let conference: Conference = c;

          index
            .openCursor(IDBKeyRange.upperBound(timestamp, true), 'prev') 
            .onsuccess = (e: Event) => {
              let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

              if (!cursor || i === limit) {
                return;
              }

              let m = cursor.value;

              if (m.conference !== conference.uuid) {
                cursor.continue();

                return;
              }

              usersStore.get(m.author).onsuccess = (e: Event) => {
                let author: User = (e.target as IDBRequest).result;

                let message: Message = { ...m, conference, author };

                messages.unshift(message);

                i++;

                cursor.continue();
              };
            };
        };

        transaction.oncomplete = (e: Event) => {
          messages.sort((a: Message, b: Message) => a.date - b.date);

          subscriber.next(messages);
          subscriber.complete();
        };
      }))
    );
  }

  getUnreadMessagesByConference(uuid: string, timestamp: number = 0, limit: number = environment.batch_size): Observable<Message[]> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Message[]>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        let index: IDBIndex = messagesStore.index('date');

        let i = 0;

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        conferencesStore.get(uuid).onsuccess = (e: Event) => {
          let c = (e.target as IDBRequest).result;

          if (!c) {
            return;
          }

          if ('participant' in c) {
            usersStore.get(c.participant).onsuccess = (e: Event) => {
              let participant: User = (e.target as IDBRequest).result;

              let conference: Conference = { ...c, participant };

              index
                .openCursor(IDBKeyRange.lowerBound(timestamp, true)) 
                .onsuccess = (e: Event) => {
                  let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

                  if (!cursor || i === limit) {
                    return;
                  }

                  let m = cursor.value;

                  if (m.conference !== conference.uuid || m.readed) {
                    cursor.continue();

                    return;
                  }

                  usersStore.get(m.author).onsuccess = (e: Event) => {
                    let author: User = (e.target as IDBRequest).result;

                    let message: Message = { ...m, conference, author };

                    messages.push(message);

                    i++;

                    cursor.continue();
                  };
                };
            };

            return;
          }

          let conference: Conference = c;

          index
            .openCursor(IDBKeyRange.lowerBound(timestamp, true)) 
            .onsuccess = (e: Event) => {
              let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

              if (!cursor || i === limit) {
                return;
              }

              let m = cursor.value;

              if (m.conference !== conference.uuid || m.readed) {
                cursor.continue();

                return;
              }

              usersStore.get(m.author).onsuccess = (e: Event) => {
                let author: User = (e.target as IDBRequest).result;

                let message: Message = { ...m, conference, author };

                messages.push(message);

                i++;

                cursor.continue();
              };
            };
        };

        transaction.oncomplete = (e: Event) => {
          messages.sort((a: Message, b: Message) => a.date - b.date);

          subscriber.next(messages);
          subscriber.complete();
        };
      }))
    );
  }

  getOldMessagesByConference(uuid: string, timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Message[]> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Message[]>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        let index: IDBIndex = messagesStore.index('date');

        let i = 0;

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        conferencesStore.get(uuid).onsuccess = (e: Event) => {
          let c = (e.target as IDBRequest).result;

          if (!c) {
            return;
          }

          if ('participant' in c) {
            usersStore.get(c.participant).onsuccess = (e: Event) => {
              let participant: User = (e.target as IDBRequest).result;

              let conference: Conference = { ...c, participant };

              index
                .openCursor(IDBKeyRange.upperBound(timestamp, true), 'prev') 
                .onsuccess = (e: Event) => {
                  let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

                  if (!cursor || i === limit) {
                    return;
                  }

                  let m = cursor.value;

                  if (m.conference !== conference.uuid) {
                    cursor.continue();

                    return;
                  }

                  usersStore.get(m.author).onsuccess = (e: Event) => {
                    let author: User = (e.target as IDBRequest).result;

                    let message: Message = { ...m, conference, author };

                    messages.unshift(message);

                    i++;

                    cursor.continue();
                  };
                };
            };

            return;
          }

          let conference: Conference = c;

          index
            .openCursor(IDBKeyRange.upperBound(timestamp, true), 'prev') 
            .onsuccess = (e: Event) => {
              let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

              if (!cursor || i === limit) {
                return;
              }

              let m = cursor.value;

              if (m.conference !== conference.uuid) {
                cursor.continue();

                return;
              }

              usersStore.get(m.author).onsuccess = (e: Event) => {
                let author: User = (e.target as IDBRequest).result;

                let message: Message = { ...m, conference, author };

                messages.unshift(message);

                i++;

                cursor.continue();
              };
            };
        };

        transaction.oncomplete = (e: Event) => {
          messages.sort((a: Message, b: Message) => a.date - b.date);

          subscriber.next(messages);
          subscriber.complete();
        };
      }))
    );
  }

  getNewMessagesByConference(uuid: string, timestamp: number = 0, limit: number = environment.batch_size): Observable<Message[]> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Message[]>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        let index: IDBIndex = messagesStore.index('date');

        let i = 0;

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        conferencesStore.get(uuid).onsuccess = (e: Event) => {
          let c = (e.target as IDBRequest).result;

          if (!c) {
            return;
          }

          if ('participant' in c) {
            usersStore.get(c.participant).onsuccess = (e: Event) => {
              let participant: User = (e.target as IDBRequest).result;

              let conference: Conference = { ...c, participant };

              index
                .openCursor(IDBKeyRange.lowerBound(timestamp, true)) 
                .onsuccess = (e: Event) => {
                  let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

                  if (!cursor || i === limit) {
                    return;
                  }

                  let m = cursor.value;

                  if (m.conference !== conference.uuid) {
                    cursor.continue();

                    return;
                  }

                  usersStore.get(m.author).onsuccess = (e: Event) => {
                    let author: User = (e.target as IDBRequest).result;

                    let message: Message = { ...m, conference, author };

                    messages.push(message);

                    i++;

                    cursor.continue();
                  };
                };
            };

            return;
          }

          let conference: Conference = c;

          index
            .openCursor(IDBKeyRange.lowerBound(timestamp, true)) 
            .onsuccess = (e: Event) => {
              let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

              if (!cursor || i === limit) {
                return;
              }

              let m = cursor.value;

              if (m.conference !== conference.uuid) {
                cursor.continue();

                return;
              }

              usersStore.get(m.author).onsuccess = (e: Event) => {
                let author: User = (e.target as IDBRequest).result;

                let message: Message = { ...m, conference, author };

                messages.push(message);

                i++;

                cursor.continue();
              };
            };
        };

        transaction.oncomplete = (e: Event) => {
          messages.sort((a: Message, b: Message) => a.date - b.date);

          subscriber.next(messages);
          subscriber.complete();
        };
      }))
    );
  }

  upsertMessage(message: Message): Observable<Message> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Message>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ], 'readwrite');
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        let m = {
          ...message,
          conference: message.conference.uuid,
          author: message.author.uuid
        };

        messagesStore.get(message.uuid).onsuccess = (e: Event) => {
          if (!(e.target as IDBRequest).result) {
            let {
              participants = undefined,
              last_message = undefined,
              ...c
            } = 'participant' in message.conference ? { ...message.conference, participant: message.conference.participant.uuid } : message.conference;

            conferencesStore.get(message.conference.uuid).onsuccess = (e: Event) => {
              if (!(e.target as IDBRequest).result) {
                if ('participant' in message.conference) {
                  usersStore.get(message.conference.participant.uuid).onsuccess = (e: Event) => {
                    if (!(e.target as IDBRequest).result) {
                      usersStore.put(message.conference.participant);
                    }
                  };
                }

                conferencesStore.put(c);

                return;
              }

              conferencesStore.put(Object.assign((e.target as IDBRequest).result, c));
            };

            usersStore.get(message.author.uuid).onsuccess = (e: Event) => {
              if (!(e.target as IDBRequest).result) {
                usersStore.put(message.author);
              }
            };

            messagesStore.put(m).onsuccess = (e: Event) => {
              subscriber.next(message);
            };

            return;
          }

          messagesStore.put(Object.assign((e.target as IDBRequest).result, m)).onsuccess = (e: Event) => {
            subscriber.next(message);
          };
        };

        transaction.oncomplete = (e: Event) => {
          subscriber.complete();
        };
      }))
    );
  }

  bulkMessages(messages: Message[]): Observable<Message[]> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Message[]>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ], 'readwrite');
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        messages.map((message: Message) => {
          let m = {
            ...message,
            conference: message.conference.uuid,
            author: message.author.uuid
          };

          messagesStore.get(message.uuid).onsuccess = (e: Event) => {
            if (!(e.target as IDBRequest).result) {
              let {
                participants = undefined,
                  last_message = undefined,
                  ...c
              } = 'participant' in message.conference ? { ...message.conference, participant: message.conference.participant.uuid } : message.conference;

              conferencesStore.get(message.conference.uuid).onsuccess = (e: Event) => {
                if (!(e.target as IDBRequest).result) {
                  if ('participant' in message.conference) {
                    usersStore.get(message.conference.participant.uuid).onsuccess = (e: Event) => {
                      if (!(e.target as IDBRequest).result) {
                        usersStore.put(message.conference.participant);
                      }
                    };
                  }

                  conferencesStore.put(c);

                  return;
                }

                conferencesStore.put(Object.assign((e.target as IDBRequest).result, c));
              };

              usersStore.get(message.author.uuid).onsuccess = (e: Event) => {
                if (!(e.target as IDBRequest).result) {
                  usersStore.put(message.author);
                }
              };

              messagesStore.put(m);

              return;
            }

            messagesStore.put(Object.assign((e.target as IDBRequest).result, m));
          };
        });

        transaction.oncomplete = (e: Event) => {
          subscriber.next(messages);
          subscriber.complete();
        };
      }))
    );
  }

  readMessage(message: Message): Observable<Message> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Message>(subscriber => {
        let transaction: IDBTransaction = db.transaction('messages', 'readwrite');
        let store: IDBObjectStore = transaction.objectStore('messages');

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        store.get(message.uuid).onsuccess = (e: Event) => {
          let m = (e.target as IDBRequest).result;

          if (!m)
            return;

          store.put({
            ...m,
            readed: message.readed,
            readedAt: message.readedAt
          });
        };

        transaction.oncomplete = (e: Event) => {
          subscriber.next(message);
          subscriber.complete();
        };
      }))
    );
  }

  readMessages(messages: Message[]): Observable<Message[]> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Message[]>(subscriber => {
        let transaction: IDBTransaction = db.transaction('messages', 'readwrite');
        let store: IDBObjectStore = transaction.objectStore('messages');

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        messages.map((message: Message) => {
          store.get(message.uuid).onsuccess = (e: Event) => {
            let m = (e.target as IDBRequest).result;

            if (!m)
              return;

            store.put({
              ...m,
              readed: message.readed,
              readedAt: message.readedAt
            });
          };
        });

        transaction.oncomplete = (e: Event) => {
          subscriber.next(messages);
          subscriber.complete();
        };
      }))
    );
  }

  ngOnDestroy() {
    this.db$.pipe(
      tap(db => db.close()),
      tap(() => indexedDB.deleteDatabase('crypter'))
    ).subscribe();

    this.unsubscribe$.next();
    this.unsubscribe$.complete();

    this.isSynchronized$.complete();
  }
}
