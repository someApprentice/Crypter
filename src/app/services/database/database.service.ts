import { environment } from '../../../environments/environment';

import { Injectable, OnDestroy } from '@angular/core';

import { Observable, Subject, BehaviorSubject, interval, concat } from 'rxjs';
import { tap, finalize, filter, distinctUntilChanged, ignoreElements, switchMap, shareReplay, takeUntil } from 'rxjs/operators';

import { isEqual, omit } from 'lodash';

import { AuthService } from '../../components/auth/auth.service';

import User from '../../models/user.model';
import Conference from '../../models/conference.model';
import Message from '../../models/message.model';

import UserSchema from './schemas/user.schema';
import ConferenceSchema from './schemas/conference.schema';
import MessageSchema from './schemas/message.schema';

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
      conferences.createIndex('participant', 'participant');

      let messages = db.createObjectStore('messages', { keyPath: 'uuid' });
      messages.createIndex('conference', 'conference');
      messages.createIndex('date', 'date');
      messages.createIndex('readAt', 'readAt');
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

        let u: UserSchema|undefined;

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        store.get(uuid).onsuccess = (e: Event) => {
          u = (e.target as IDBRequest).result;
        };

        transaction.oncomplete = (e: Event) => {
          if (!u) {
            subscriber.next(null);
            subscriber.complete();

            return;
          }

          let user: User = u;

          subscriber.next(user);
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
          let u: UserSchema|undefined = (e.target as IDBRequest).result;

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

        users.map((user: User) => {
          store.get(user.uuid).onsuccess = (e: Event) => {
            let u: UserSchema|undefined = (e.target as IDBRequest).result;

            if (u)
              user = Object.assign(u, user);

            store.put(user);
          };
        });

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
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        let c: ConferenceSchema|undefined;
        let p: UserSchema|undefined;
        let l: MessageSchema|undefined;
        let a: UserSchema|undefined;

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        conferencesStore.get(uuid).onsuccess = (e: Event) => {
          c = (e.target as IDBRequest).result;

          if (!c)
            return;

          if ('participant' in c) {
            usersStore.get(c.participant).onsuccess = (e: Event) => {
              p = (e.target as IDBRequest).result;
            };
          }

          if ('last_message' in c) {
            messagesStore.get(c.last_message).onsuccess = (e: Event) => {
              l = (e.target as IDBRequest).result;

              usersStore.get(l.author).onsuccess = (e: Event) => {
                a = (e.target as IDBRequest).result;
              };
            };
          }
        };

        transaction.oncomplete = (e: Event) => {
          if (!c) {
            subscriber.next(null);
            subscriber.complete();

            return;
          }

          let conference: Conference = omit(c, [ 'participant', 'last_message' ]);

          if (p)
            conference.participant = p as User;

          if (l) {
            let author: User = a;

            let last_message: Message = {
              ...omit(l, [ 'conference', 'author' ]),
              conference,
              author
            };

            conference.last_message = last_message;
          }

          subscriber.next(conference);
          subscriber.complete();
        };
      }))
    );
  }

  getConferenceByParticipant(uuid: string): Observable<Conference|null> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Conference|null>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        let index: IDBIndex = conferencesStore.index('participant');

        let c: ConferenceSchema|undefined;
        let p: UserSchema|undefined;
        let l: MessageSchema|undefined;
        let a: UserSchema|undefined;

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        index
          .openCursor(IDBKeyRange.only(uuid))
          .onsuccess = (e: Event) => {
            let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

            if (!cursor)
              return;

            if (cursor.value.type !== 'private') {
              cursor.continue();

              return;
            }

            c = cursor.value;

            usersStore.get(c.participant).onsuccess = (e: Event) => {
              p = (e.target as IDBRequest).result;
            };

            if ('last_message' in c) {
              messagesStore.get(c.last_message).onsuccess = (e: Event) => {
                l = (e.target as IDBRequest).result;

                usersStore.get(l.author).onsuccess = (e: Event) => {
                  a = (e.target as IDBRequest).result;
                };
              };
            }
          };

        transaction.oncomplete = (e: Event) => {
          if (!c) {
            subscriber.next(null);
            subscriber.complete();

            return;
          }

          let participant: User = p;

          let conference: Conference = {
            ...omit(c, [ 'participant', 'last_message' ]),
            participant
          };

          if ('last_message' in c) {
            let author: User = a;

            let last_message: Message = {
              ...omit(l, [ 'conference', 'author' ]),
              conference,
              author
            };

            conference.last_message = last_message;
          }

          subscriber.next(conference);
          subscriber.complete();
        };
      }))
    );
  }

  getSecretConferenceByParticipant(uuid: string): Observable<Conference|null> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Conference|null>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        let index: IDBIndex = conferencesStore.index('participant');

        let c: ConferenceSchema|undefined;
        let p: UserSchema|undefined;
        let l: MessageSchema|undefined;
        let a: UserSchema|undefined;

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        index
          .openCursor(IDBKeyRange.only(uuid))
          .onsuccess = (e: Event) => {
            let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

            if (!cursor)
              return;

            if (cursor.value.type !== 'secret') {
              cursor.continue();

              return;
            }

            c = cursor.value;

            usersStore.get(c.participant).onsuccess = (e: Event) => {
              p = (e.target as IDBRequest).result;
            };

            if ('last_message' in c) {
              messagesStore.get(c.last_message).onsuccess = (e: Event) => {
                l = (e.target as IDBRequest).result;

                usersStore.get(l.author).onsuccess = (e: Event) => {
                  a = (e.target as IDBRequest).result;
                };
              };
            }
          };

        transaction.oncomplete = (e: Event) => {
          if (!c) {
            subscriber.next(null);
            subscriber.complete();

            return;
          }

          let participant: User = p;
          
          let conference: Conference = {
            ...omit(c, [ 'participant', 'last_message' ]),
            participant
          };

          if ('last_message' in c) {
            let author: User = a;

            let last_message: Message = {
              ...omit(l, [ 'conference', 'author' ]),
              conference,
              author
            };

            conference.last_message = last_message;
          }

          subscriber.next(conference);
          subscriber.complete();
        };
      }))
    );
  }

  getConferences(timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Conference[]> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Conference[]>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        let index: IDBIndex = conferencesStore.index('updated_at');

        let i = 0;

        let cs: ConferenceSchema[] = [] as ConferenceSchema[];
        let ps: UserSchema[] = [] as UserSchema[];
        let ls: MessageSchema[] = [] as MessageSchema[];
        let as: UserSchema[] = [] as UserSchema[];

        let conferences: Conference[] = [] as Conference[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        transaction.onabort = (e: Event) => {
          subscriber.error(e);
        };

        index
          .openCursor(IDBKeyRange.upperBound(timestamp, true), 'prev')
          .onsuccess = (e: Event) => {
            let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

            if (!cursor || i === limit)
              return;

            let c: ConferenceSchema = cursor.value;

            cs.push(c);

            if ('participant' in c) {
              usersStore.get(c.participant).onsuccess = (e: Event) => {
                if (!(e.target as IDBRequest).result) {
                  transaction.abort();

                  return;
                }

                let p: UserSchema = (e.target as IDBRequest).result;

                ps.push(p);
              };
            }

            if ('last_message' in c) {
              messagesStore.get(c.last_message).onsuccess = (e: Event) => {
                if (!(e.target as IDBRequest).result) {
                  transaction.abort();

                  return;
                }

                let l: MessageSchema = (e.target as IDBRequest).result;

                ls.push(l);

                usersStore.get(l.author).onsuccess = (e: Event) => {
                  if (!(e.target as IDBRequest).result) {
                    transaction.abort();

                    return;
                  }

                  let a: UserSchema = (e.target as IDBRequest).result;

                  as.push(a);
                };
              }
            }

            i++;

            cursor.continue();
          };

        transaction.oncomplete = (e: Event) => {
          conferences = cs.map((c: ConferenceSchema) => {
            let conference: Conference = omit(c, [ 'participant', 'last_message' ]);

            if ('participant' in c)
              conference.participant = ps.find((p: UserSchema) => p.uuid === c.participant);

            if ('last_message' in c) {
              let l: MessageSchema = ls.find((l: MessageSchema) => l.uuid === c.last_message);

              let author: User = as.find((a: UserSchema) => a.uuid === l.author);

              let last_message: Message = {
                ...omit(l, [ 'conference', 'author' ]),
                conference,
                author
              };

              conference.last_message = last_message;
            }

            return conference;
          });

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
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        let index: IDBIndex = conferencesStore.index('updated_at');

        let i = 0;

        let cs: ConferenceSchema[] = [] as ConferenceSchema[];
        let ps: UserSchema[] = [] as UserSchema[];
        let ls: MessageSchema[] = [] as MessageSchema[];
        let as: UserSchema[] = [] as UserSchema[];

        let conferences: Conference[] = [] as Conference[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        transaction.onabort = (e: Event) => {
          subscriber.error(e);
        };
        
        index
          .openCursor(IDBKeyRange.upperBound(timestamp, true), 'prev')
          .onsuccess = (e: Event) => {
            let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

            if (!cursor || i === limit)
              return;

            let c: ConferenceSchema = cursor.value;

            cs.push(c);

            if ('participant' in c) {
              usersStore.get(c.participant).onsuccess = (e: Event) => {
                if (!(e.target as IDBRequest).result) {
                  transaction.abort();

                  return;
                }

                let p: UserSchema = (e.target as IDBRequest).result;

                ps.push(p);
              };
            }

            if ('last_message' in c) {
              messagesStore.get(c.last_message).onsuccess = (e: Event) => {
                if (!(e.target as IDBRequest).result) {
                  transaction.abort();

                  return;
                }

                let l: MessageSchema = (e.target as IDBRequest).result;

                ls.push(l);

                usersStore.get(l.author).onsuccess = (e: Event) => {
                  if (!(e.target as IDBRequest).result) {
                    transaction.abort();

                    return;
                  }

                  let a: UserSchema = (e.target as IDBRequest).result;
                };
              };
            }

            i++;

            cursor.continue();
          };

        transaction.oncomplete = (e: Event) => {
          conferences = cs.map((c: ConferenceSchema) => {
            let conference: Conference = omit(c, [ 'participant', 'last_message' ]);

            if ('participant' in c)
              conference.participant = ps.find((p: UserSchema) => p.uuid === c.participant);

            if ('last_message' in c) {
              let l: MessageSchema = ls.find((l: MessageSchema) => l.uuid === c.last_message);

              let author: User = as.find((a: UserSchema) => a.uuid === l.author);

              let last_message: Message = {
                ...omit(l, [ 'conference', 'author' ]),
                conference,
                author
              };

              conference.last_message = last_message;
            }

            return conference;
          });

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
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ], 'readwrite');
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        let c: ConferenceSchema = omit(conference, [ 'participant', 'participants', 'last_message' ]);

        if ('participant' in conference)
          c.participant = conference.participant.uuid;

        if ('last_message' in conference) {
          c.last_message = conference.last_message.uuid;

          messagesStore.get(conference.last_message.uuid).onsuccess = (e: Event) => {
            if (!(e.target as IDBRequest).result) {
              usersStore.get(conference.last_message.author.uuid).onsuccess = (e: Event) => {
                if (!(e.target as IDBRequest).result)
                  usersStore.put(conference.last_message.author);
              };

              let m: MessageSchema = {
                ...omit(conference.last_message, [ 'conference', 'author' ]),
                conference: conference.last_message.conference.uuid,
                author: conference.last_message.author.uuid
              };

              messagesStore.put(m);
            }
          };
        }

        conferencesStore.get(conference.uuid).onsuccess = (e: Event) => {
          if ((e.target as IDBRequest).result) {
            conferencesStore.put(Object.assign((e.target as IDBRequest).result, c));

            return;
          }
          
          if ('participant' in conference) {
            usersStore.get(conference.participant.uuid).onsuccess = (e: Event) => {
              if (!(e.target as IDBRequest).result)
                usersStore.put(conference.participant);
            };
          }

          conferencesStore.put(c);
        };

        transaction.oncomplete = (e: Event) => {
          subscriber.next(conference);
          subscriber.complete();
        };
      }))
    );
  }

  bulkConferences(conferences: Conference[]): Observable<Conference[]> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Conference[]>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ], 'readwrite');
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        conferences.map((conference: Conference) => {
          let c: ConferenceSchema = omit(conference, [ 'participant', 'participants', 'last_message' ]);

          if ('participant' in conference)
            c.participant = conference.participant.uuid;

          if ('last_message' in conference) {
            c.last_message = conference.last_message.uuid;

            messagesStore.get(conference.last_message.uuid).onsuccess = (e: Event) => {
              if (!(e.target as IDBRequest).result) {
                usersStore.get(conference.last_message.author.uuid).onsuccess = (e: Event) => {
                  if (!(e.target as IDBRequest).result)
                    usersStore.put(conference.last_message.author);
                };

                let m: MessageSchema = {
                  ...omit(conference.last_message, [ 'conference', 'author' ]),
                  conference: conference.last_message.conference.uuid,
                  author: conference.last_message.author.uuid
                };

                messagesStore.put(m);
              }
            };
          }

          conferencesStore.get(conference.uuid).onsuccess = (e: Event) => {
            if ((e.target as IDBRequest).result) {
              conferencesStore.put(Object.assign((e.target as IDBRequest).result, c));

              return;
            }
            
            if ('participant' in conference) {
              usersStore.get(conference.participant.uuid).onsuccess = (e: Event) => {
                if (!(e.target as IDBRequest).result)
                  usersStore.put(conference.participant);
              };
            }

            conferencesStore.put(c);
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

        let m: MessageSchema|undefined;
        let c: ConferenceSchema|undefined;
        let p: UserSchema|undefined;
        let a: UserSchema|undefined;

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        transaction.onabort = (e: Event) => {
          subscriber.error(e);
        };

        messagesStore.get(uuid).onsuccess = (e: Event) => {
          m = (e.target as IDBRequest).result;

          if (!m)
            return;

          conferencesStore.get(m.conference).onsuccess = (e: Event) => {
            if (!(e.target as IDBRequest).result) {
              transaction.abort();

              return;
            }

            c = (e.target as IDBRequest).result;

            if ('participant' in c) {
              usersStore.get(c.participant).onsuccess = (e: Event) => {
                if (!(e.target as IDBRequest).result) {
                  transaction.abort();

                  return;
                }

                p = (e.target as IDBRequest).result;
              };
            }
          };

          usersStore.get(m.author).onsuccess = (e: Event) => {
            if (!(e.target as IDBRequest).result) {
              transaction.abort();

              return;
            }

            a = (e.target as IDBRequest).result;
          };

          transaction.oncomplete = (e: Event) => {
            if (!m) {
              subscriber.next(null);
              subscriber.complete();

              return;
            }

            let conference: Conference = omit(c, [ 'participant', 'last_message' ]);

            if (p)
              conference.participant = p as User;

            let author: User = a as User;

            let message: Message = {
              ...m,
              conference,
              author
            };

            subscriber.next(message);
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

        let ms: MessageSchema[] = [] as MessageSchema[];
        let cs: ConferenceSchema[] = [] as ConferenceSchema[];
        let ps: UserSchema[] = [] as UserSchema[];
        let as: UserSchema[] = [] as UserSchema[];

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        transaction.onabort = (e: Event) => {
          subscriber.error(e);
        };

        index
          .openCursor(IDBKeyRange.upperBound(timestamp, true), 'prev') 
          .onsuccess = (e: Event) => {
            let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

            if (!cursor || i === limit)
              return;

            let m: MessageSchema = cursor.value;

            ms.unshift(m);

            conferencesStore.get(m.conference).onsuccess = (e: Event) => {
              if (!(e.target as IDBRequest).result) {
                transaction.abort();

                return;
              }

              let c: ConferenceSchema = (e.target as IDBRequest).result;

              cs.unshift(c);

              if ('participant' in c) {
                usersStore.get(c.participant).onsuccess = (e: Event) => {
                  if (!(e.target as IDBRequest).result) {
                    transaction.abort();

                    return;
                  }

                  let p: UserSchema = (e.target as IDBRequest).result;

                  ps.unshift(p);
                };
              }
            };

            usersStore.get(m.author).onsuccess = (e: Event) => {
              if (!(e.target as IDBRequest).result) {
                transaction.abort();

                return;
              }

              let a: UserSchema = (e.target as IDBRequest).result;

              as.unshift(a);
            };

            i++;

            cursor.continue();
          };

          transaction.oncomplete = (e: Event) => {
            messages = ms.map((m: MessageSchema) => {
              let c: ConferenceSchema = cs.find((c: ConferenceSchema) => c.uuid === m.conference);

              let conference: Conference = omit(c, [ 'participant', 'last_message' ]);

              if ('participant' in c)
                conference.participant = ps.find((p: UserSchema) => p.uuid === c.participant);

              let author: User = as.find((a: UserSchema) => a.uuid === m.author);

              let message: Message = {
                ...m,
                conference,
                author
              };

              return message;
            });

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

        let ms: MessageSchema[] = [] as MessageSchema[];
        let cs: ConferenceSchema[] = [] as ConferenceSchema[];
        let ps: UserSchema[] = [] as UserSchema[];
        let as: UserSchema[] = [] as UserSchema[];

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        transaction.onabort = (e: Event) => {
          subscriber.error(e);
        };

        index
          .openCursor(IDBKeyRange.lowerBound(timestamp, true))
          .onsuccess = (e: Event) => {
            let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

            if (!cursor || i === limit)
              return;

            let m: MessageSchema = cursor.value;

            if (m.read) {
              cursor.continue();

              return;
            }

            ms.push(m);

            conferencesStore.get(m.conference).onsuccess = (e: Event) => {
              if (!(e.target as IDBRequest).result) {
                transaction.abort();

                return;
              }

              let c: ConferenceSchema = (e.target as IDBRequest).result;

              cs.push(c);

              if ('participant' in c) {
                usersStore.get(c.participant).onsuccess = (e: Event) => {
                  if (!(e.target as IDBRequest).result) {
                    transaction.abort();

                    return;
                  }

                  let p: UserSchema = (e.target as IDBRequest).result;

                  ps.push(p);
                };
              }
            };

            usersStore.get(m.author).onsuccess = (e: Event) => {
              if (!(e.target as IDBRequest).result) {
                transaction.abort();

                return;
              }

              let a: UserSchema = (e.target as IDBRequest).result;

              as.push(a);
            };

            i++;

            cursor.continue();
          };

        transaction.oncomplete = (e: Event) => {
          messages = ms.map((m: MessageSchema) => {
            let c: ConferenceSchema = cs.find((c: ConferenceSchema) => c.uuid === m.conference);

            let conference: Conference = omit(c, [ 'participant', 'last_message' ]);

            if ('participant' in c)
              conference.participant = ps.find((p: UserSchema) => p.uuid === c.participant);

            let author: User = as.find((a: UserSchema) => a.uuid === m.author);

            let message: Message = {
              ...m,
              conference,
              author
            };

            return message;
          });

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

        let index: IDBIndex = messagesStore.index('readAt');

        let i = 0;

        let ms: MessageSchema[] = [] as MessageSchema[];
        let cs: ConferenceSchema[] = [] as ConferenceSchema[];
        let ps: UserSchema[] = [] as UserSchema[];
        let as: UserSchema[] = [] as UserSchema[];

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        transaction.onabort = (e: Event) => {
          subscriber.error(e);
        };

        index
          .openCursor(IDBKeyRange.upperBound(timestamp, true), 'prev') 
          .onsuccess = (e: Event) => {
            let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

            if (!cursor || i === limit)
              return;

            let m: MessageSchema = cursor.value;

            if (!m.read) {
              cursor.continue();

              return;
            }

            ms.unshift(m);

            conferencesStore.get(m.conference).onsuccess = (e: Event) => {
              if (!(e.target as IDBRequest).result) {
                transaction.abort();

                return;
              }

              let c: ConferenceSchema = (e.target as IDBRequest).result;

              cs.unshift(c);

              if ('participant' in c) {
                usersStore.get(c.participant).onsuccess = (e: Event) => {
                  if (!(e.target as IDBRequest).result) {
                    transaction.abort();

                    return;
                  }

                  let p: UserSchema = (e.target as IDBRequest).result;

                  ps.unshift(p);
                };
              }

            };

            usersStore.get(m.author).onsuccess = (e: Event) => {
              if (!(e.target as IDBRequest).result) {
                transaction.abort();

                return;
              }

              let a: UserSchema = (e.target as IDBRequest).result;

              as.unshift(a);
            };

            i++;

            cursor.continue();
          };

        transaction.oncomplete = (e: Event) => {
          messages = ms.map((m: MessageSchema) => {
            let c: ConferenceSchema = cs.find((c: ConferenceSchema) => c.uuid === m.conference);

            let conference: Conference = omit(c, [ 'participant', 'last_message' ]);

            if ('participant' in c)
              conference.participant = ps.find((p: UserSchema) => p.uuid === c.participant);

            let author: User = as.find((a: UserSchema) => a.uuid === m.author);

            let message: Message = {
              ...m,
              conference,
              author
            };

            return message;
          });

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

        let c: ConferenceSchema|undefined;
        let p: UserSchema|undefined;
        let ms: MessageSchema[] = [] as MessageSchema[];
        let as: UserSchema[] = [] as UserSchema[];

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        transaction.onabort = (e: Event) => {
          subscriber.error(e);
        };

        conferenceIndex
          .openCursor(IDBKeyRange.only(uuid))
          .onsuccess = (e: Event) => {
            let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

            if (!cursor)
              return;

            if (cursor.value.type !== 'private') {
              cursor.continue();

              return;
            }

            c = cursor.value;

            usersStore.get(c.participant).onsuccess = (e: Event) => {
              if (!(e.target as IDBRequest).result) {
                transaction.abort();

                return;
              }

              p = (e.target as IDBRequest).result;
            };

            messagesIndex
              .openCursor(IDBKeyRange.upperBound(timestamp, true), 'prev') 
              .onsuccess = (e: Event) => {
                let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

                if (!cursor || i === limit)
                  return;

                let m: MessageSchema = cursor.value;

                if (m.conference !== c.uuid) {
                  cursor.continue();

                  return;
                }

                ms.unshift(m);

                usersStore.get(m.author).onsuccess = (e: Event) => {
                  if (!(e.target as IDBRequest).result) {
                    transaction.abort();

                    return;
                  }

                  let a: UserSchema = (e.target as IDBRequest).result;

                  as.unshift(a);
                };

                i++;

                cursor.continue();
              };
          };

        transaction.oncomplete = (e: Event) => {
          messages = ms.map((m: MessageSchema) => {
            let participant: User = p;

            let conference: Conference = {
              ...omit(c, [ 'participant', 'last_message' ]),
              participant
            };

            let author: User = as.find((a: UserSchema) => a.uuid === m.author);

            let message: Message = {
              ...m,
              conference,
              author
            };

            return message;
          });

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

        let c: ConferenceSchema|undefined;
        let p: UserSchema|undefined;
        let ms: MessageSchema[] = [] as MessageSchema[];
        let as: UserSchema[] = [] as UserSchema[];

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        transaction.onabort = (e: Event) => {
          subscriber.error(e);
        };

        conferenceIndex
          .openCursor(IDBKeyRange.only(uuid))
          .onsuccess = (e: Event) => {
            let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

            if (!cursor)
              return;

            if (cursor.value.type !== 'private') {
              cursor.continue();

              return;
            }

            c = cursor.value;

            usersStore.get(c.participant).onsuccess = (e: Event) => {
              if (!(e.target as IDBRequest).result) {
                transaction.abort();

                return;
              }

              p = (e.target as IDBRequest).result;
            };

            messagesIndex
              .openCursor(IDBKeyRange.lowerBound(timestamp, true)) 
              .onsuccess = (e: Event) => {
                let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

                if (!cursor || i === limit)
                  return;

                let m: MessageSchema = cursor.value;

                if (m.conference !== c.uuid || m.read) {
                  cursor.continue();

                  return;
                }

                ms.push(m);

                usersStore.get(m.author).onsuccess = (e: Event) => {
                  if (!(e.target as IDBRequest).result) {
                    transaction.abort();

                    return;
                  }

                  let a: UserSchema = (e.target as IDBRequest).result;

                  as.push(a);
                };

                i++;

                cursor.continue();
              };
          };

        transaction.oncomplete = (e: Event) => {
          messages = ms.map((m: MessageSchema) => {
            let participant: User = p;

            let conference: Conference = {
              ...omit(c, [ 'participant', 'last_message' ]),
              participant
            };

            let author: User = as.find((a: UserSchema) => a.uuid === m.author);

            let message: Message = {
              ...m,
              conference,
              author
            };

            return message;
          });

          messages.sort((a: Message, b: Message) => a.date - b.date);

          subscriber.next(messages);
          subscriber.complete();
        };
      }))
    );
  }

  getUnreadMessagesWithMessagesBeforeByParticipant(uuid: string, timestamp: number = 0, limit: number = environment.batch_size): Observable<Message[]> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Message[]>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        let conferenceIndex: IDBIndex = conferencesStore.index('participant');
        let messagesIndex: IDBIndex = messagesStore.index('date');

        let i = 0;
        let j = 0;

        let c: ConferenceSchema|undefined;
        let p: UserSchema|undefined;
        let msb: MessageSchema[] = [] as MessageSchema[];
        let ums: MessageSchema[] = [] as MessageSchema[];
        let as: UserSchema[] = [] as UserSchema[];

        let messagesBefore: Message[] = [] as Message[];
        let unreadMessages: Message[] = [] as Message[];

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        transaction.onabort = (e: Event) => {
          subscriber.error(e);
        };

        conferenceIndex
          .openCursor(IDBKeyRange.only(uuid))
          .onsuccess = (e: Event) => {
            let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

            if (!cursor)
              return;

            if (cursor.value.type !== 'private') {
              cursor.continue();

              return;
            }

            c = cursor.value;

            usersStore.get(c.participant).onsuccess = (e: Event) => {
              if (!(e.target as IDBRequest).result) {
                transaction.abort();

                return;
              }

              p = (e.target as IDBRequest).result;
            };

            messagesIndex
              .openCursor(IDBKeyRange.lowerBound(timestamp, true)) 
              .onsuccess = (e: Event) => {
                let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

                if (!cursor || i === limit) {
                  if (!!ums.length) {
                    messagesIndex
                      .openCursor(IDBKeyRange.upperBound(ums[0].date, true), 'prev') 
                      .onsuccess = (e: Event) => {
                        let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

                        if (!cursor || j === limit)
                          return;

                        let m: MessageSchema = cursor.value;

                        if (m.conference !== c.uuid) {
                          cursor.continue();

                          return;
                        }

                        msb.unshift(m);

                        usersStore.get(m.author).onsuccess = (e: Event) => {
                          if (!(e.target as IDBRequest).result) {
                            transaction.abort();

                            return;
                          }

                          let a: UserSchema = (e.target as IDBRequest).result;

                          as.unshift(a);
                        };

                        j++;

                        cursor.continue();
                      };
                  }

                  return;
                }

                let m: MessageSchema = cursor.value;

                if (m.conference !== c.uuid || m.read) {
                  cursor.continue();

                  return;
                }

                ums.push(m);

                usersStore.get(m.author).onsuccess = (e: Event) => {
                  if (!(e.target as IDBRequest).result) {
                    transaction.abort();

                    return;
                  }

                  let a: UserSchema = (e.target as IDBRequest).result;

                  as.push(a);
                };

                i++;

                cursor.continue();
              };
          };

        transaction.oncomplete = (e: Event) => {
          unreadMessages = ums.map((m: MessageSchema) => {
            let participant: User = p;

            let conference: Conference = {
              ...omit(c, [ 'participant', 'last_message' ]),
              participant
            };

            let author: User = as.find((a: UserSchema) => a.uuid === m.author);

            let message: Message = {
              ...m,
              conference,
              author
            };

            return message;
          });

          messagesBefore = msb.map((m: MessageSchema) => {
            let participant: User = p;

            let conference: Conference = {
              ...omit(c, [ 'participant', 'last_message' ]),
              participant
            };

            let author: User = as.find((a: UserSchema) => a.uuid === m.author);

            let message: Message = {
              ...m,
              conference,
              author
            };

            return message;
          });

          messages = messagesBefore.concat(unreadMessages);

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

        let c: ConferenceSchema|undefined;
        let p: UserSchema|undefined;
        let ms: MessageSchema[] = [] as MessageSchema[];
        let as: UserSchema[] = [] as UserSchema[];

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        transaction.onabort = (e: Event) => {
          subscriber.error(e);
        };

        conferenceIndex
          .openCursor(IDBKeyRange.only(uuid))
          .onsuccess = (e: Event) => {
            let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

            if (!cursor)
              return;

            if (cursor.value.type !== 'private') {
              cursor.continue();

              return;
            }

            c = cursor.value;

            usersStore.get(c.participant).onsuccess = (e: Event) => {
              if (!(e.target as IDBRequest).result) {
                transaction.abort();

                return;
              }

              p = (e.target as IDBRequest).result;
            };

            messagesIndex
              .openCursor(IDBKeyRange.upperBound(timestamp, true), 'prev') 
              .onsuccess = (e: Event) => {
                let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

                if (!cursor || i === limit)
                  return;

                let m: MessageSchema = cursor.value;

                if (m.conference !== c.uuid) {
                  cursor.continue();

                  return;
                }

                ms.unshift(m);

                usersStore.get(m.author).onsuccess = (e: Event) => {
                  if (!(e.target as IDBRequest).result) {
                    transaction.abort();

                    return;
                  }

                  let a: UserSchema = (e.target as IDBRequest).result;

                  as.unshift(a);
                };

                i++;

                cursor.continue();
              };
          };

        transaction.oncomplete = (e: Event) => {
          messages = ms.map((m: MessageSchema) => {
            let participant: User = p;

            let conference: Conference = {
              ...omit(c, [ 'participant', 'last_message' ]),
              participant
            };

            let author: User = as.find((a: UserSchema) => a.uuid === m.author);

            let message: Message = {
              ...m,
              conference,
              author
            };

            return message;
          });

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

        let c: ConferenceSchema|undefined;
        let p: UserSchema|undefined;
        let ms: MessageSchema[] = [] as MessageSchema[];
        let as: UserSchema[] = [] as UserSchema[];

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        transaction.onabort = (e: Event) => {
          subscriber.error(e);
        };

        conferenceIndex
          .openCursor(IDBKeyRange.only(uuid))
          .onsuccess = (e: Event) => {
            let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

            if (!cursor)
              return;

            if (cursor.value.type !== 'private') {
              cursor.continue();

              return;
            }

            c = cursor.value;

            usersStore.get(c.participant).onsuccess = (e: Event) => {
              if (!(e.target as IDBRequest).result) {
                transaction.abort();

                return;
              }

              p = (e.target as IDBRequest).result;
            };

            messagesIndex
              .openCursor(IDBKeyRange.lowerBound(timestamp, true)) 
              .onsuccess = (e: Event) => {
                let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

                if (!cursor || i === limit)
                  return;

                let m: MessageSchema = cursor.value;

                if (m.conference !== c.uuid) {
                  cursor.continue();

                  return;
                }

                ms.push(m);

                usersStore.get(m.author).onsuccess = (e: Event) => {
                  if (!(e.target as IDBRequest).result) {
                    transaction.abort();

                    return;
                  }

                  let a: UserSchema = (e.target as IDBRequest).result;

                  as.push(a);
                };

                i++;

                cursor.continue();
              };
          };

        transaction.oncomplete = (e: Event) => {
          messages = ms.map((m: MessageSchema) => {
            let participant: User = p;

            let conference: Conference = {
              ...omit(c, [ 'participant', 'last_message' ]),
              participant
            };

            let author: User = as.find((a: UserSchema) => a.uuid === m.author);

            let message: Message = {
              ...m,
              conference,
              author
            };

            return message;
          });

          messages.sort((a: Message, b: Message) => a.date - b.date);

          subscriber.next(messages);
          subscriber.complete();
        };
      }))
    );
  }

  getSecretMessagesByParticipant(uuid: string, timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Message[]> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Message[]>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        let conferenceIndex: IDBIndex = conferencesStore.index('participant');
        let messagesIndex: IDBIndex = messagesStore.index('date');

        let i = 0;

        let c: ConferenceSchema|undefined;
        let p: UserSchema|undefined;
        let ms: MessageSchema[] = [] as MessageSchema[];
        let as: UserSchema[] = [] as UserSchema[];

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        transaction.onabort = (e: Event) => {
          subscriber.error(e);
        };

        conferenceIndex
          .openCursor(IDBKeyRange.only(uuid))
          .onsuccess = (e: Event) => {
            let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

            if (!cursor)
              return;

            if (cursor.value.type !== 'secret') {
              cursor.continue();

              return;
            }

            c = cursor.value;

            usersStore.get(c.participant).onsuccess = (e: Event) => {
              if (!(e.target as IDBRequest).result) {
                transaction.abort();

                return;
              }

              p = (e.target as IDBRequest).result;
            };

            messagesIndex
              .openCursor(IDBKeyRange.upperBound(timestamp, true), 'prev') 
              .onsuccess = (e: Event) => {
                let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

                if (!cursor || i === limit)
                  return;

                let m: MessageSchema = cursor.value;

                if (m.conference !== c.uuid) {
                  cursor.continue();

                  return;
                }

                ms.unshift(m);

                usersStore.get(m.author).onsuccess = (e: Event) => {
                  if (!(e.target as IDBRequest).result) {
                    transaction.abort();

                    return;
                  }

                  let a: UserSchema = (e.target as IDBRequest).result;

                  as.unshift(a);
                };

                i++;

                cursor.continue();
              };
          };

        transaction.oncomplete = (e: Event) => {
          messages = ms.map((m: MessageSchema) => {
            let participant: User = p;

            let conference: Conference = {
              ...omit(c, [ 'participant', 'last_message' ]),
              participant
            };

            let author: User = as.find((a: UserSchema) => a.uuid === m.author);

            let message: Message = {
              ...m,
              conference,
              author
            };

            return message;
          });

          messages.sort((a: Message, b: Message) => a.date - b.date);

          subscriber.next(messages);
          subscriber.complete();
        };
      }))
    );
  }

  getUnreadSecretMessagesByParticipant(uuid: string, timestamp: number = 0, limit: number = environment.batch_size): Observable<Message[]> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Message[]>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        let conferenceIndex: IDBIndex = conferencesStore.index('participant');
        let messagesIndex: IDBIndex = messagesStore.index('date');

        let i = 0;

        let c: ConferenceSchema|undefined;
        let p: UserSchema|undefined;
        let ms: MessageSchema[] = [] as MessageSchema[];
        let as: UserSchema[] = [] as UserSchema[];

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        transaction.onabort = (e: Event) => {
          subscriber.error(e);
        };

        conferenceIndex
          .openCursor(IDBKeyRange.only(uuid))
          .onsuccess = (e: Event) => {
            let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

            if (!cursor)
              return;

            if (cursor.value.type !== 'secret') {
              cursor.continue();

              return;
            }

            c = cursor.value;

            usersStore.get(c.participant).onsuccess = (e: Event) => {
              if (!(e.target as IDBRequest).result) {
                transaction.abort();

                return;
              }

              p = (e.target as IDBRequest).result;
            };

            messagesIndex
              .openCursor(IDBKeyRange.lowerBound(timestamp, true)) 
              .onsuccess = (e: Event) => {
                let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

                if (!cursor || i === limit)
                  return;

                let m: MessageSchema = cursor.value;

                if (m.conference !== c.uuid || m.read) {
                  cursor.continue();

                  return;
                }

                ms.push(m);

                usersStore.get(m.author).onsuccess = (e: Event) => {
                  if (!(e.target as IDBRequest).result) {
                    transaction.abort();

                    return;
                  }

                  let a: UserSchema = (e.target as IDBRequest).result;

                  as.push(a);
                };

                i++;

                cursor.continue();
              };
          };

        transaction.oncomplete = (e: Event) => {
          messages = ms.map((m: MessageSchema) => {
            let participant: User = p;

            let conference: Conference = {
              ...omit(c, [ 'participant', 'last_message' ]),
              participant
            };

            let author: User = as.find((a: UserSchema) => a.uuid === m.author);

            let message: Message = {
              ...m,
              conference,
              author
            };

            return message;
          });

          messages.sort((a: Message, b: Message) => a.date - b.date);

          subscriber.next(messages);
          subscriber.complete();
        };
      }))
    );
  }

  getUnreadSecretMessagesWithMessagesBeforeByParticipant(uuid: string, timestamp: number = 0, limit: number = environment.batch_size): Observable<Message[]> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Message[]>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        let conferenceIndex: IDBIndex = conferencesStore.index('participant');
        let messagesIndex: IDBIndex = messagesStore.index('date');

        let i = 0;
        let j = 0;

        let c: ConferenceSchema|undefined;
        let p: UserSchema|undefined;
        let msb: MessageSchema[] = [] as MessageSchema[];
        let ums: MessageSchema[] = [] as MessageSchema[];
        let as: UserSchema[] = [] as UserSchema[];

        let messagesBefore: Message[] = [] as Message[];
        let unreadMessages: Message[] = [] as Message[];

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        transaction.onabort = (e: Event) => {
          subscriber.error(e);
        };

        conferenceIndex
          .openCursor(IDBKeyRange.only(uuid))
          .onsuccess = (e: Event) => {
            let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

            if (!cursor)
              return;

            if (cursor.value.type !== 'secret') {
              cursor.continue();

              return;
            }

            c = cursor.value;

            usersStore.get(c.participant).onsuccess = (e: Event) => {
              if (!(e.target as IDBRequest).result) {
                transaction.abort();

                return;
              }

              p = (e.target as IDBRequest).result;
            };

            messagesIndex
              .openCursor(IDBKeyRange.lowerBound(timestamp, true)) 
              .onsuccess = (e: Event) => {
                let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

                if (!cursor || i === limit) {
                  if (!!ums.length) {
                    messagesIndex
                      .openCursor(IDBKeyRange.upperBound(ums[ums.length - 1].date, true), 'prev') 
                      .onsuccess = (e: Event) => {
                        let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

                        if (!cursor || j === limit)
                          return;

                        let m: MessageSchema = cursor.value;

                        if (m.conference !== c.uuid) {
                          cursor.continue();

                          return;
                        }

                        msb.unshift(m);

                        usersStore.get(m.author).onsuccess = (e: Event) => {
                          if (!(e.target as IDBRequest).result) {
                            transaction.abort();

                            return;
                          }

                          let a: UserSchema = (e.target as IDBRequest).result;

                          as.unshift(a);
                        };

                        j++;

                        cursor.continue();
                      };
                  }

                  return;
                }

                let m: MessageSchema = cursor.value;

                if (m.conference !== c.uuid || m.read) {
                  cursor.continue();

                  return;
                }

                ums.push(m);

                usersStore.get(m.author).onsuccess = (e: Event) => {
                  if (!(e.target as IDBRequest).result) {
                    transaction.abort();

                    return;
                  }

                  let a: UserSchema = (e.target as IDBRequest).result;

                  as.push(a);
                };

                i++;

                cursor.continue();
              };
          };

        transaction.oncomplete = (e: Event) => {
          messagesBefore = msb.map((m: MessageSchema) => {
            let participant: User = p;

            let conference: Conference = {
              ...omit(c, [ 'participant', 'last_message' ]),
              participant
            };

            let author: User = as.find((a: UserSchema) => a.uuid === m.author);

            let message: Message = {
              ...m,
              conference,
              author
            };

            return message;
          });

          unreadMessages = ums.map((m: MessageSchema) => {
            let participant: User = p;

            let conference: Conference = {
              ...omit(c, [ 'participant', 'last_message' ]),
              participant
            };

            let author: User = as.find((a: UserSchema) => a.uuid === m.author);

            let message: Message = {
              ...m,
              conference,
              author
            };

            return message;
          });

          messages = messagesBefore.concat(unreadMessages);

          messages.sort((a: Message, b: Message) => a.date - b.date);

          subscriber.next(messages);
          subscriber.complete();
        };
      }))
    );
  }

  getOldSecretMessagesByParticipant(uuid: string, timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Message[]> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Message[]>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        let conferenceIndex: IDBIndex = conferencesStore.index('participant');
        let messagesIndex: IDBIndex = messagesStore.index('date');

        let i = 0;

        let c: ConferenceSchema|undefined;
        let p: UserSchema|undefined;
        let ms: MessageSchema[] = [] as MessageSchema[];
        let as: UserSchema[] = [] as UserSchema[];

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        transaction.onabort = (e: Event) => {
          subscriber.error(e);
        };

        conferenceIndex
          .openCursor(IDBKeyRange.only(uuid))
          .onsuccess = (e: Event) => {
            let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

            if (!cursor)
              return;

            if (cursor.value.type !== 'secret') {
              cursor.continue();

              return;
            }

            c = cursor.value;

            usersStore.get(c.participant).onsuccess = (e: Event) => {
              if (!(e.target as IDBRequest).result) {
                transaction.abort();

                return;
              }

              p = (e.target as IDBRequest).result;
            };
            
            messagesIndex
              .openCursor(IDBKeyRange.upperBound(timestamp, true), 'prev') 
              .onsuccess = (e: Event) => {
                let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

                if (!cursor || i === limit)
                  return;

                let m: MessageSchema = cursor.value;

                if (m.conference !== c.uuid) {
                  cursor.continue();

                  return;
                }

                ms.unshift(m);

                usersStore.get(m.author).onsuccess = (e: Event) => {
                  if (!(e.target as IDBRequest).result) {
                    transaction.abort();

                    return;
                  }

                  let a: UserSchema = (e.target as IDBRequest).result;

                  as.unshift(a);
                };

                i++;

                cursor.continue();
              };
          };

        transaction.oncomplete = (e: Event) => {
          messages = ms.map((m: MessageSchema) => {
            let participant: User = p;

            let conference: Conference = {
              ...omit(c, [ 'participant', 'last_message' ]),
              participant
            };

            let author: User = as.find((a: UserSchema) => a.uuid === m.author);

            let message: Message = {
              ...m,
              conference,
              author
            };

            return message;
          });

          messages.sort((a: Message, b: Message) => a.date - b.date);

          subscriber.next(messages);
          subscriber.complete();
        };
      }))
    );
  }

  getNewSecretMessagesByParticipant(uuid: string, timestamp: number = 0, limit: number = environment.batch_size): Observable<Message[]> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Message[]>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        let conferenceIndex: IDBIndex = conferencesStore.index('participant');
        let messagesIndex: IDBIndex = messagesStore.index('date');

        let i = 0;

        let c: ConferenceSchema|undefined;
        let p: UserSchema|undefined;
        let ms: MessageSchema[] = [] as MessageSchema[];
        let as: UserSchema[] = [] as UserSchema[];

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        transaction.onabort = (e: Event) => {
          subscriber.error(e);
        };

        conferenceIndex
          .openCursor(IDBKeyRange.only(uuid))
          .onsuccess = (e: Event) => {
            let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

            if (!cursor)
              return;

            if (cursor.value.type !== 'secret') {
              cursor.continue();

              return;
            }

            c = cursor.value;

            usersStore.get(c.participant).onsuccess = (e: Event) => {
              if (!(e.target as IDBRequest).result) {
                transaction.abort();

                return;
              }

              p = (e.target as IDBRequest).result;
            };

            messagesIndex
              .openCursor(IDBKeyRange.lowerBound(timestamp, true)) 
              .onsuccess = (e: Event) => {
                let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

                if (!cursor || i === limit)
                  return;

                let m: MessageSchema = cursor.value;

                if (m.conference !== c.uuid) {
                  cursor.continue();

                  return;
                }

                ms.push(m);

                usersStore.get(m.author).onsuccess = (e: Event) => {
                  if (!(e.target as IDBRequest).result) {
                    transaction.abort();

                    return;
                  }

                  let a: UserSchema = (e.target as IDBRequest).result;

                  as.push(a);
                };

                i++;

                cursor.continue();
              };
          };

        transaction.oncomplete = (e: Event) => {
          messages = ms.map((m: MessageSchema) => {
            let participant: User = p;

            let conference: Conference = {
              ...omit(c, [ 'participant', 'last_message' ]),
              participant
            };

            let author: User = as.find((a: UserSchema) => a.uuid === m.author);

            let message: Message = {
              ...m,
              conference,
              author
            };

            return message;
          });

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

        let c: ConferenceSchema|undefined;
        let p: UserSchema|undefined;
        let ms: MessageSchema[] = [] as MessageSchema[];
        let as: UserSchema[] = [] as UserSchema[];

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        transaction.onabort = (e: Event) => {
          subscriber.error(e);
        };

        conferencesStore.get(uuid).onsuccess = (e: Event) => {
          c = (e.target as IDBRequest).result;

          if (!c)
            return;

          if ('participant' in c) {
            usersStore.get(c.participant).onsuccess = (e: Event) => {
              if (!(e.target as IDBRequest).result) {
                transaction.abort();

                return;
              }

              p = (e.target as IDBRequest).result;
            };
          }

          index
            .openCursor(IDBKeyRange.upperBound(timestamp, true), 'prev') 
            .onsuccess = (e: Event) => {
              let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

              if (!cursor || i === limit)
                return;

              let m: MessageSchema = cursor.value;

              if (m.conference !== c.uuid) {
                cursor.continue();

                return;
              }

              ms.unshift(m);

              usersStore.get(m.author).onsuccess = (e: Event) => {
                if (!(e.target as IDBRequest).result) {
                  transaction.abort();

                  return;
                }

                let a: UserSchema = (e.target as IDBRequest).result;

                as.unshift(a);
              };

              i++;

              cursor.continue();
            };
        };

        transaction.oncomplete = (e: Event) => {
          messages = ms.map((m: MessageSchema) => {
            let participant: User = p;

            let conference: Conference = {
              ...omit(c, [ 'participant', 'last_message' ]),
              participant
            };

            let author: User = as.find((a: UserSchema) => a.uuid === m.author);

            let message: Message = {
              ...m,
              conference,
              author
            };

            return message;
          });

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

        let c: ConferenceSchema|undefined;
        let p: UserSchema|undefined;
        let ms: MessageSchema[] = [] as MessageSchema[];
        let as: UserSchema[] = [] as UserSchema[];

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        transaction.onabort = (e: Event) => {
          subscriber.error(e);
        };

        conferencesStore.get(uuid).onsuccess = (e: Event) => {
          c = (e.target as IDBRequest).result;

          if (!c)
            return;

          if ('participant' in c) {
            usersStore.get(c.participant).onsuccess = (e: Event) => {
              if (!(e.target as IDBRequest).result) {
                transaction.abort();

                return;
              }

              p = (e.target as IDBRequest).result;
            };
          }

          index
            .openCursor(IDBKeyRange.lowerBound(timestamp, true)) 
            .onsuccess = (e: Event) => {
              let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

              if (!cursor || i === limit)
                return;

              let m: MessageSchema = cursor.value;

              if (m.conference !== c.uuid || m.read) {
                cursor.continue();

                return;
              }

              ms.push(m);

              usersStore.get(m.author).onsuccess = (e: Event) => {
                if (!(e.target as IDBRequest).result) {
                  transaction.abort();

                  return;
                }

                let a: UserSchema = (e.target as IDBRequest).result;

                as.push(a);
              };

              i++;

              cursor.continue();
            };
        };

        transaction.oncomplete = (e: Event) => {
          messages = ms.map((m: MessageSchema) => {
            let participant: User = p;

            let conference: Conference = {
              ...omit(c, [ 'participant', 'last_message' ]),
              participant
            };

            let author: User = as.find((a: UserSchema) => a.uuid === m.author);

            let message: Message = {
              ...m,
              conference,
              author
            };

            return message;
          });

          messages.sort((a: Message, b: Message) => a.date - b.date);

          subscriber.next(messages);
          subscriber.complete();
        };
      }))
    );
  }

  getUnreadMessagesWithMessagesBeforeByConference(uuid: string, timestamp: number = 0, limit: number = environment.batch_size): Observable<Message[]> {
    return this.db$.pipe(
      switchMap((db: IDBDatabase) => new Observable<Message[]>(subscriber => {
        let transaction: IDBTransaction = db.transaction([ 'users', 'conferences', 'messages' ]);
        let usersStore: IDBObjectStore = transaction.objectStore('users');
        let conferencesStore: IDBObjectStore = transaction.objectStore('conferences');
        let messagesStore: IDBObjectStore = transaction.objectStore('messages');

        let index: IDBIndex = messagesStore.index('date');

        let i = 0;
        let j = 0;

        let c: ConferenceSchema|undefined;
        let p: UserSchema|undefined;
        let msb: MessageSchema[] = [] as MessageSchema[];
        let ums: MessageSchema[] = [] as MessageSchema[];
        let as: UserSchema[] = [] as UserSchema[];

        let messagesBefore: Message[] = [] as Message[];
        let unreadMessages: Message[] = [] as Message[];

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        transaction.onabort = (e: Event) => {
          subscriber.error(e);
        };

        conferencesStore.get(uuid).onsuccess = (e: Event) => {
          c = (e.target as IDBRequest).result;

          if (!c)
            return;

          if ('participant' in c) {
            usersStore.get(c.participant).onsuccess = (e: Event) => {
              if (!(e.target as IDBRequest).result) {
                transaction.abort();

                return;
              }

              p = (e.target as IDBRequest).result;
            };
          }

          index
            .openCursor(IDBKeyRange.lowerBound(timestamp, true))
            .onsuccess = (e: Event) => {
              let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

              if (!cursor || i === limit) {
                if (!!ums.length) {
                  index
                    .openCursor(IDBKeyRange.upperBound(ums[ums.length - 1].date, true), 'prev')
                    .onsuccess = (e: Event) => {
                      let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

                      if (!cursor || j === limit)
                        return;

                      let m: MessageSchema = cursor.value;

                      if (m.conference !== c.uuid) {
                        cursor.continue();

                        return;
                      }

                      msb.unshift(m);

                      usersStore.get(m.author).onsuccess = (e: Event) => {
                        if (!(e.target as IDBRequest).result) {
                          transaction.abort();

                          return;
                        }

                        let a: UserSchema = (e.target as IDBRequest).result;

                        as.unshift(a);
                      };

                      j++;

                      cursor.continue();
                    };
                }

                return;
              }

              let m: MessageSchema = cursor.value;

              if (m.conference !== c.uuid || m.read) {
                cursor.continue();

                return;
              }

              ums.push(m);

              usersStore.get(m.author).onsuccess = (e: Event) => {
                if (!(e.target as IDBRequest).result) {
                  transaction.abort();

                  return;
                }

                let a: UserSchema = (e.target as IDBRequest).result;

                as.push(a);
              };

              i++;

              cursor.continue();
            };
        };

        transaction.oncomplete = (e: Event) => {
          messagesBefore = msb.map((m: MessageSchema) => {
            let participant: User = p;

            let conference: Conference = {
              ...omit(c, [ 'participant', 'last_message' ]),
              participant
            };

            let author: User = as.find((a: UserSchema) => a.uuid === m.author);

            let message: Message = {
              ...m,
              conference,
              author
            };

            return message;
          });

          unreadMessages = ums.map((m: MessageSchema) => {
            let participant: User = p;

            let conference: Conference = {
              ...omit(c, [ 'participant', 'last_message' ]),
              participant
            };

            let author: User = as.find((a: UserSchema) => a.uuid === m.author);

            let message: Message = {
              ...m,
              conference,
              author
            };

            return message;
          });

          messages = messagesBefore.concat(unreadMessages);

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

        let c: ConferenceSchema|undefined;
        let p: UserSchema|undefined;
        let ms: MessageSchema[] = [] as MessageSchema[];
        let as: UserSchema[] = [] as UserSchema[];

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        transaction.onabort = (e: Event) => {
          subscriber.error(e);
        };

        conferencesStore.get(uuid).onsuccess = (e: Event) => {
          c = (e.target as IDBRequest).result;

          if (!c)
            return;

          if ('participant' in c) {
            usersStore.get(c.participant).onsuccess = (e: Event) => {
              if (!(e.target as IDBRequest).result) {
                transaction.abort();

                return;
              }

              p = (e.target as IDBRequest).result;
            };
          }

          index
            .openCursor(IDBKeyRange.upperBound(timestamp, true), 'prev') 
            .onsuccess = (e: Event) => {
              let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

              if (!cursor || i === limit)
                return;

              let m: MessageSchema = cursor.value;

              if (m.conference !== c.uuid) {
                cursor.continue();

                return;
              }

              ms.unshift(m);

              usersStore.get(m.author).onsuccess = (e: Event) => {
                if (!(e.target as IDBRequest).result) {
                  transaction.abort();

                  return;
                }

                let a: UserSchema = (e.target as IDBRequest).result;

                as.unshift(a);
              };

              i++;

              cursor.continue();
            };
        };

        transaction.oncomplete = (e: Event) => {
          messages = ms.map((m: MessageSchema) => {
            let participant: User = p;

            let conference: Conference = {
              ...omit(c, [ 'participant', 'last_message' ]),
              participant
            };

            let author: User = as.find((a: UserSchema) => a.uuid === m.author);

            let message: Message = {
              ...m,
              conference,
              author
            };

            return message;
          });

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

        let c: ConferenceSchema|undefined;
        let p: UserSchema|undefined;
        let ms: MessageSchema[] = [] as MessageSchema[];
        let as: UserSchema[] = [] as UserSchema[];

        let messages: Message[] = [] as Message[];

        transaction.onerror = (err: Event) => {
          subscriber.error(err);
        };

        transaction.onabort = (e: Event) => {
          subscriber.error(e);
        };

        conferencesStore.get(uuid).onsuccess = (e: Event) => {
          c = (e.target as IDBRequest).result;

          if (!c)
            return;

          if ('participant' in c) {
            usersStore.get(c.participant).onsuccess = (e: Event) => {
              if (!(e.target as IDBRequest).result) {
                transaction.abort();

                return;
              }

              p = (e.target as IDBRequest).result;
            };
          }

          index
            .openCursor(IDBKeyRange.lowerBound(timestamp, true)) 
            .onsuccess = (e: Event) => {
              let cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

              if (!cursor || i === limit)
                return;

              let m: MessageSchema = cursor.value;

              if (m.conference !== c.uuid) {
                cursor.continue();

                return;
              }

              ms.push(m);

              usersStore.get(m.author).onsuccess = (e: Event) => {
                if (!(e.target as IDBRequest).result) {
                  transaction.abort();

                  return;
                }

                let a: UserSchema = (e.target as IDBRequest).result;

                as.push(a);
              };

              i++;

              cursor.continue();
            };
        };

        transaction.oncomplete = (e: Event) => {
          messages = ms.map((m: MessageSchema) => {
            let participant: User = p;

            let conference: Conference = {
              ...omit(c, [ 'participant', 'last_message' ]),
              participant
            };

            let author: User = as.find((a: UserSchema) => a.uuid === m.author);

            let message: Message = {
              ...m,
              conference,
              author
            };

            return message;
          });

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

        let m: MessageSchema = {
          ...message,
          conference: message.conference.uuid,
          author: message.author.uuid
        };

        messagesStore.get(message.uuid).onsuccess = (e: Event) => {
          if ((e.target as IDBRequest).result) {
            messagesStore.put(Object.assign((e.target as IDBRequest).result, m));

            return;
          }

          let c: ConferenceSchema = omit(message.conference, [ 'participant', 'participants', 'last_message' ]);

          if ('participant' in message.conference)
            c.participant = message.conference.participant.uuid;

          conferencesStore.get(message.conference.uuid).onsuccess = (e: Event) => {
            if ((e.target as IDBRequest).result) {
              conferencesStore.put(Object.assign((e.target as IDBRequest).result, c));

              return;
            }

            if ('participant' in message.conference) {
              usersStore.get(message.conference.participant.uuid).onsuccess = (e: Event) => {
                if (!(e.target as IDBRequest).result)
                  usersStore.put(message.conference.participant);
              };
            }

            conferencesStore.put(c);
          };

          usersStore.get(message.author.uuid).onsuccess = (e: Event) => {
            if (!(e.target as IDBRequest).result)
              usersStore.put(message.author);
          };

          messagesStore.put(m);
        };

        transaction.oncomplete = (e: Event) => {
          subscriber.next(message);
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
          let m: MessageSchema = {
            ...message,
            conference: message.conference.uuid,
            author: message.author.uuid
          };

          messagesStore.get(message.uuid).onsuccess = (e: Event) => {
            if ((e.target as IDBRequest).result) {
              messagesStore.put(Object.assign((e.target as IDBRequest).result, m));

              return;
            }

            let c: ConferenceSchema = omit(message.conference, [ 'participant', 'participants', 'last_message' ]);

            if ('participant' in message.conference)
              c.participant = message.conference.participant.uuid;

            conferencesStore.get(message.conference.uuid).onsuccess = (e: Event) => {
              if ((e.target as IDBRequest).result) {
                conferencesStore.put(Object.assign((e.target as IDBRequest).result, c));

                return;
              }

              if ('participant' in message.conference) {
                usersStore.get(message.conference.participant.uuid).onsuccess = (e: Event) => {
                  if (!(e.target as IDBRequest).result)
                    usersStore.put(message.conference.participant);
                };
              }

              conferencesStore.put(c);
            };

            usersStore.get(message.author.uuid).onsuccess = (e: Event) => {
              if (!(e.target as IDBRequest).result)
                usersStore.put(message.author);
            };

            messagesStore.put(m);
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
          let m: MessageSchema = (e.target as IDBRequest).result;

          if (!m)
            return;

          store.put({
            ...m,
            read: message.read,
            readAt: message.readAt
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
            let m: MessageSchema = (e.target as IDBRequest).result;

            if (!m)
              return;

            store.put({
              ...m,
              read: message.read,
              readAt: message.readAt
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
