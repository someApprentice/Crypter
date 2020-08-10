import { environment } from '../../environments/environment';

import { Injectable, OnDestroy } from '@angular/core';

import { Observable, Subject, BehaviorSubject, of, from, concat, zip, throwError } from 'rxjs';
import { tap, map, finalize, filter, ignoreElements, switchMap, delayWhen, shareReplay, takeUntil, catchError } from 'rxjs/operators';

import { AuthService } from '../components/auth/auth.service';

import { User } from '../models/user.model';
import { Conference } from '../models/conference.model';
import { Message } from '../models/message.model';

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import PouchDBUpsert from 'pouchdb-upsert';

PouchDB.plugin(PouchDBFind);
PouchDB.plugin(PouchDBUpsert);

@Injectable()
export class DatabaseService implements OnDestroy {
  private unsubscribe$ = new Subject<void>();

  public isSynchronized$ = new BehaviorSubject<boolean>(false);

  public users$ = of(new PouchDB('users')).pipe(
    delayWhen(db => from(db.createIndex({
      index: {
        fields: [ 'name' ]
      }
    }))),
    takeUntil(this.unsubscribe$),
    shareReplay(1)
  );

  public conferences$ = of(new PouchDB('conferences')).pipe(
    delayWhen(db => from(db.createIndex({
      index: {
        fields: [ 'updated_at', 'participant' ]
      }
    }))),
    takeUntil(this.unsubscribe$),
    shareReplay(1)
  );

  public messages$ = of(new PouchDB('messages')).pipe(
    delayWhen(db => from(db.createIndex({
      index: {
        fields: [ 'date' ]
      }
    }))),
    takeUntil(this.unsubscribe$),
    shareReplay(1)
  );

  private userChanges$ = this.users$.pipe(
    map(db => db.changes({
      since: 'now',
      doc_ids: [ this.authService.user.uuid ],
      limit: 1,
      live: true,
      include_docs: true
    })),
    takeUntil(this.unsubscribe$),
    shareReplay(1)
  );

  public user$ = concat(
    this.getUser(this.authService.user.uuid),
    this.userChanges$.pipe(
      switchMap(changes => new Observable<any>(subscriber => {
        changes.on('change', change => {
          subscriber.next(change);
        });

        changes.on('complete', info => {
          subscriber.complete();
        });

        changes.on('error', err => {
          subscriber.error(err);
        });
      })),
      map((change: any) => {
        let user: User = (({ _id, _rev, ...user }) => user)({ uuid: change.doc._id, ...change.doc });

        return user;
      }),
    )
  ).pipe(
    filter((user: User|null) => !!user),
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
    return this.users$.pipe(
      switchMap(db => from(db.get(uuid))),
      map((doc: any) => {
        let user: User = (({ _id, _rev, ...user }) => user)({ uuid: doc._id, ...doc });

        return user;
      }),
      catchError(err => {
        if (err.status === 404)
          return of(null);

        return throwError(err);
      })
    );
  }

  upsertUser(user: User): Observable<User> {
    return this.users$.pipe(
      switchMap(db => from(db.upsert(user.uuid, (doc: any) => {
        let { uuid, ...d } = Object.assign(doc, user);

        return d;
      }))),
      map(result => user),
    );
  }

  bulkUsers(users: User[]): Observable<User[]> {
    users = users.reduce((acc, cur) => {
      if (acc.find(a => a.uuid === cur.uuid))
        return acc;

      return [ ...acc, cur ];
    }, [] as User[]);

    return this.users$.pipe(
      switchMap(db => {
        let ids = users.map((u: User) => u.uuid);

        return from(db.allDocs({
          keys: ids,
          include_docs: true
        }));
      }),
      switchMap(result => {
        // Property 'error' does not exist on type 'never'.
        let errors = result.rows.filter((r: any) => 'error' in r && r.error !== 'not_found');

        if (!!errors.length)
          return throwError(errors);

        let rows = result.rows.filter(r => !('error' in r));
        
        let docs = users.map((u: User) => {
          let row = rows.find(r => r.id === u.uuid);

          if (row) {
            let { uuid, ...doc } = Object.assign(row.doc, u);

            return doc;
          }

          let doc = (({ uuid, ...doc }) => doc)({ _id: u.uuid, ...u });

          return doc;
        });

        return this.users$.pipe(
          switchMap(db => from(db.bulkDocs(docs)))
        );
      }),
      switchMap(result => {
        let errors = result.filter(r => 'error' in r);

        if (!!errors.length)
          return throwError(errors);

        return of(users);
      })
    );
  }

  getConference(uuid: string): Observable<Conference|null> {
    return this.conferences$.pipe(
      switchMap(db => from(db.get(uuid))),
      switchMap((doc: any) => {
        let conference: Conference = {
          uuid: doc._id,
          type: doc.type,
          updated_at: doc.updated_at,
          messages_count: doc.messages_count,
          unread_messages_count: doc.unread_messages_count
        };

        if ('participant' in doc) {
          let participant$ = this.users$.pipe(
            switchMap(db => from(db.get(doc.participant)))
          );

          return zip(of(conference), participant$).pipe(
            map(([ conference, participant ]) => {
              // how to typify this more convenient?
              let p = participant as {
                _id: string,
                _rev: string,
                email?: string,
                name: string,
                hash?: string,
                last_seen?: number,
                conferences_count: number,
                public_key?: string,
                private_key?: string,
                revocation_certificate?: string
              };

              conference.participant = (({ _id, _rev, ...p }) => p)({ uuid: p._id, ...p });

              return conference;
            })
          );
        }

        return of(conference);
      }),
      catchError(err => {
        if (err.status === 404)
          return of(null);

        return throwError(err);
      })
    );
  }

  getConferenceByParticipant(uuid: string): Observable<Conference|null> {
    return this.conferences$.pipe(
      switchMap(db => from(db.find({
        selector: {
          participant: uuid,
          updated_at: { $gte: null }
        }
      }))),
      switchMap((result: any) => {
        if (!result.docs.length)
          return of(null);

        // how to typify this more convenient?
        let doc = result.docs[0] as {
          _id: string,
          _rev: string,
          type: 'private' | 'public' | 'secret',
          updated_at: number,
          messages_count: number,
          unread_messages_count: number,
          participant?: string,
        };

        let conference: Conference = {
          uuid: doc._id,
          type: doc.type,
          updated_at: doc.updated_at,
          messages_count: doc.messages_count,
          unread_messages_count: doc.unread_messages_count
        };

        if ('participant' in doc) {
          let participant$ = this.users$.pipe(
            switchMap(db => db.get(doc.participant))
          );
          
          return zip(of(conference), participant$).pipe(
            map(([ conference, participant ]) => {
              // how to typify this more convenient?
              let p = participant as {
                _id: string,
                _rev: string,
                email?: string,
                name: string,
                hash?: string,
                last_seen?: number,
                conferences_count: number,
                public_key?: string,
                private_key?: string,
                revocation_certificate?: string
              };

              conference.participant = (({ _id, _rev, ...p }) => p)({ uuid: p._id, ...p });

              return conference;
            })
          );
        }

        return of(conference);
      })
    );
  }

  getConferences(timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Conference[]> {
    return this.conferences$.pipe(
      switchMap(db => from(db.find({
        selector: {
          updated_at: { $lt: timestamp }
        },
        limit: limit,
        sort: [ { updated_at: 'desc' } ]
      }))),
      switchMap(result => {
        if (!result.docs.length)
          return of([] as Conference[]);

        // Property 'participant' does not exist on type 'ExistingDocument<{}>'.
        let ids = result.docs
          .filter((d: any) => 'participant' in d)
          .map((d: any) => d.participant);

        let participants$ = this.users$.pipe(
          switchMap(db => from(db.allDocs({
            keys: ids,
            include_docs: true
          })))
        );

        return zip(of(result.docs), participants$).pipe(
          map(([ docs, participants ]) => {
            let conferences: Conference[] = docs.map((doc: any) => {
              let conference: Conference = {
                uuid: doc._id,
                type: doc.type,
                updated_at: doc.updated_at,
                messages_count: doc.messages_count,
                unread_messages_count: doc.unread_messages_count
              };

              if ('participant' in doc) {
                let row = participants.rows.find(r => r.id === doc.participant);

                if (row) {
                  // how to typify this more convenient?
                  let participant = row.doc as {
                    _id: string,
                    _rev: string,
                    email?: string,
                    name: string,
                    hash?: string,
                    last_seen?: number,
                    conferences_count: number,
                    public_key?: string,
                    private_key?: string,
                    revocation_certificate?: string
                  };

                  conference.participant = (({ _id, _rev, ...p }) => p)({ uuid: participant._id, ...participant });
                }
              }

              return conference;
            });

            return conferences;
          })
        );
      }),
      map((conferences: Conference[]) => conferences.sort((a: Conference, b: Conference) => b.updated_at - a.updated_at))
    );
  }

  getOldConferences(timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Conference[]> {
    return this.conferences$.pipe(
      switchMap(db => from(db.find({
        selector: {
          updated_at: { $lt: timestamp }
        },
        limit: limit,
        sort: [ { updated_at: 'desc' } ]
      }))),
      switchMap(result => {
        if (!result.docs.length)
          return of([] as Conference[]);

        // Property 'participant' does not exist on type 'ExistingDocument<{}>'.
        let ids = result.docs
          .filter((d: any) => 'participant' in d)
          .map((d: any) => d.participant);

        let participants$ = this.users$.pipe(
          switchMap(db => from(db.allDocs({
            keys: ids,
            include_docs: true
          })))
        );

        return zip(of(result.docs), participants$).pipe(
          map(([ docs, participants ]) => {
            let conferences: Conference[] = docs.map((doc: any) => {
              let conference: Conference = {
                uuid: doc._id,
                type: doc.type,
                updated_at: doc.updated_at,
                messages_count: doc.messages_count,
                unread_messages_count: doc.unread_messages_count
              }

              if ('participant' in doc) {
                let row = participants.rows.find(r => r.id === doc.participant);

                if (row) {
                  // how to typify this more convenient?
                  let participant = row.doc as {
                    _id: string,
                    _rev: string,
                    email?: string,
                    name: string,
                    hash?: string,
                    last_seen?: number,
                    conferences_count: number,
                    public_key?: string,
                    private_key?: string,
                    revocation_certificate?: string
                  };

                  conference.participant = (({ _id, _rev, ...p }) => p)({ uuid: participant._id, ...participant });
                }
              }

              return conference;
            });

            return conferences;
          })
        );
      }),
      map((conferences: Conference[]) => conferences.sort((a: Conference, b: Conference) => b.updated_at - a.updated_at))
    );
  }

  upsertConference(conference: Conference): Observable<Conference> {
    if ('participant' in conference) {
      return this.upsertUser(conference.participant).pipe(
        switchMap(() => this.conferences$),
        switchMap(db => from(db.upsert(conference.uuid, (doc: any) => {
          let { uuid, last_message = undefined, ...d } = Object.assign(doc, { ...conference, participant: conference.participant.uuid });
          
          return d;
        }))),
        map(result => conference)
      );
    }

    return this.conferences$.pipe(
      switchMap(db => from(db.upsert(conference.uuid, (doc: any) => {
        let { uuid, ...d } = Object.assign(doc, conference);

        return doc;
      }))),
      map(result => conference)
    );
  }

  bulkConferences(conferences: Conference[]): Observable<Conference[]> {
    conferences = conferences.reduce((acc, cur) => {
      if (acc.find(a => a.uuid === cur.uuid))
        return acc;

      return [ ...acc, cur ];
    }, [] as Conference[]);

    let participants = conferences
      .filter((c: Conference) => 'participant' in c)
      .map((c: Conference) => c.participant);

    return this.bulkUsers(participants).pipe(
      switchMap(() => {
        let ids = conferences.map((c: Conference) => c.uuid);

        return this.conferences$.pipe(
          switchMap(db => from(db.allDocs({
            keys: ids,
            include_docs: true
          })))
        );
      }),
      switchMap(result => {
        // Property 'error' does not exist on type 'never'.
        let errors = result.rows.filter((r: any) => 'error' in r && r.error !== 'not_found');

        if (!!errors.length)
          return throwError(errors);

        let rows = result.rows.filter(r => !('error' in r));

        let docs = conferences.map((c: Conference) => {
          let row = rows.find(r => r.id === c.uuid);

          if (row) {
            // how to typify this more convenient?
            let doc = Object.assign(
              row.doc,
              {
                _id: c.uuid,
                type: c.type,
                updated_at: c.updated_at,
                messages_count: c.messages_count,
                unread_messages_count: c.unread_messages_count
              }
            ) as {
              _id: string,
              _rev: string,
              type: 'private' | 'public' | 'secret',
              updated_at: number,
              messages_count: number,
              unread_messages_count: number,
              participant?: string,
            };

            if ('participant' in c)
              doc.participant = c.participant.uuid;

            return doc
          }

          // how to typify this more convenient?
          let doc: {
            _id: string,
            type: 'private' | 'public' | 'secret',
            updated_at: number,
            messages_count: number,
            unread_messages_count: number,
            participant?: string,
          } = {
            _id: c.uuid,
            type: c.type,
            updated_at: c.updated_at,
            messages_count: c.messages_count,
            unread_messages_count: c.unread_messages_count
          };

          if ('participant' in c)
            doc.participant = c.participant.uuid;

          return doc;
        });

        return this.conferences$.pipe(
          switchMap(db => from(db.bulkDocs(docs)))
        );
      }),
      switchMap(result => {
        let errors = result.filter(r => 'error' in r);

        if (!!errors.length)
          return throwError(errors);

        return of(conferences);
      })
    );
  }

  getMessages(timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Message[]> {
    return this.messages$.pipe(
      switchMap(db => from(db.find({
        selector: {
          date: { $lt: timestamp }
        },
        limit: limit,
        sort: [ { date: 'desc' } ]
      }))),
      switchMap(result => {
        if (!result.docs.length)
          return of([] as Message[]);

        let conferenceIds = result.docs.map((d: any) => d.conference);
        let authorIds = result.docs.map((d: any) => d.author);

        let conferences$ = this.conferences$.pipe(
          switchMap(db => from(db.allDocs({
            keys: conferenceIds,
            include_docs: true
          })))
        );

        let authors$ = this.users$.pipe(
          switchMap(db => from(db.allDocs({
            keys: authorIds,
            include_docs: true
          })))
        );

        return zip(of(result.docs), conferences$, authors$).pipe(
          switchMap(([ docs, conferences, authors ]) => {
            let participantIds = conferences.rows
              .filter((r: any) => 'participant' in r.doc)
              .map((r: any) => r.doc.participant);

            let participants$ = this.users$.pipe(
              switchMap(db => from(db.allDocs({
                keys: participantIds,
                include_docs: true
              })))
            );
          
            return zip(of(docs), of(conferences), of(authors), participants$).pipe(
              map(([ docs, conferences, authors, participants ]) => {
                let messages: Message[] = docs.map((d: any) => {
                  // how to typify this more convenient?
                  let c = conferences.rows.find((r: any) => r.id === d.conference).doc as {
                    _id: string,
                    _rev: string,
                    type: 'private' | 'public' | 'secret',
                    updated_at: number,
                    messages_count: number,
                    unread_messages_count: number,
                    participant?: string
                  };

                  let conference: Conference = {
                    uuid: c._id,
                    type: c.type,
                    updated_at: c.updated_at,
                    messages_count: c.messages_count,
                    unread_messages_count: c.unread_messages_count
                  };
                 
                  if ('participant' in c) {
                    // how to typify this more convenient?
                    let p = participants.rows.find((r: any) => r.id === c.participant).doc as {
                      _id: string,
                      _rev: string,
                      email?: string,
                      name: string,
                      hash?: string,
                      last_seen?: number,
                      conferences_count: number,
                      public_key?: string,
                      private_key?: string,
                      revocation_certificate?: string
                    };

                    conference.participant = (({ _id, _rev, ...p  }) => p)({ uuid: p._id, ...p });
                  }
                  
                  // how to typify this more convenient?
                  let a = authors.rows.find((r: any) => r.id === d.author).doc as {
                    _id: string,
                    _rev: string,
                    email?: string,
                    name: string,
                    hash?: string,
                    last_seen?: number,
                    conferences_count: number,
                    public_key?: string,
                    private_key?: string,
                    revocation_certificate?: string
                  };

                  let author: User = (({ _id, _rev, ...a }) => a)({ uuid: a._id, ...a });

                  let message: Message = (({ _id, _rev, ...message }) => message)({
                    uuid: d._id,
                    ...d,
                    conference: conference,
                    author: author
                  });

                  return message;
                });

                return messages;
              })
            );
          })
        );
      }),
      map((messages: Message[]) => messages.sort((a: Message, b: Message) => a.date - b.date))
    );
  }

  getUnreadMessages(timestamp: number = 0, limit: number = environment.batch_size):Observable<Message[]> {
    return this.messages$.pipe(
      switchMap(db => from(db.find({
        selector: {
          readed: false,
          date: { $gt: timestamp }
        },
        limit: limit,
        sort: [ { date: 'asc' } ]
      }))),
      switchMap(result => {
        if (!result.docs.length)
          return of([] as Message[]);

        let conferenceIds = result.docs.map((d: any) => d.conference);
        let authorIds = result.docs.map((d: any) => d.author);

        let conferences$ = this.conferences$.pipe(
          switchMap(db => from(db.allDocs({
            keys: conferenceIds,
            include_docs: true
          })))
        );

        let authors$ = this.users$.pipe(
          switchMap(db => from(db.allDocs({
            keys: authorIds,
            include_docs: true
          })))
        );

        return zip(of(result.docs), conferences$, authors$).pipe(
          switchMap(([ docs, conferences, authors ]) => {
            let participantIds = conferences.rows
              .filter((r: any) => 'participant' in r.doc)
              .map((r: any) => r.doc.participant);

            let participants$ = this.users$.pipe(
              switchMap(db => from(db.allDocs({
                keys: participantIds,
                include_docs: true
              })))
            );
          
            return zip(of(docs), of(conferences), of(authors), participants$).pipe(
              map(([ docs, conferences, authors, participants ]) => {
                let messages: Message[] = docs.map((d: any) => {
                  // how to typify this more convenient?
                  let c = conferences.rows.find((r: any) => r.id === d.conference).doc as {
                    _id: string,
                    _rev: string,
                    type: 'private' | 'public' | 'secret',
                    updated_at: number,
                    messages_count: number,
                    unread_messages_count: number,
                    participant?: string
                  };

                  let conference: Conference = {
                    uuid: c._id,
                    type: c.type,
                    updated_at: c.updated_at,
                    messages_count: c.messages_count,
                    unread_messages_count: c.unread_messages_count
                  };
                 
                  if ('participant' in c) {
                    // how to typify this more convenient?
                    let p = participants.rows.find((r: any) => r.id === c.participant).doc as {
                      _id: string,
                      _rev: string,
                      email?: string,
                      name: string,
                      hash?: string,
                      last_seen?: number,
                      conferences_count: number,
                      public_key?: string,
                      private_key?: string,
                      revocation_certificate?: string
                    };

                    conference.participant = (({ _id, _rev, ...p  }) => p)({ uuid: p._id, ...p });
                  }
                  
                  // how to typify this more convenient?
                  let a = authors.rows.find((r: any) => r.id === d.author).doc as {
                    _id: string,
                    _rev: string,
                    email?: string,
                    name: string,
                    hash?: string,
                    last_seen?: number,
                    conferences_count: number,
                    public_key?: string,
                    private_key?: string,
                    revocation_certificate?: string
                  };

                  let author: User = (({ _id, _rev, ...a }) => a)({ uuid: a._id, ...a });

                  let message: Message = (({ _id, _rev, ...message }) => message)({
                    uuid: d._id,
                    ...d,
                    conference: conference,
                    author: author
                  });

                  return message;
                });

                return messages;
              })
            );
          })
        );
      }),
      map((messages: Message[]) => messages.sort((a: Message, b: Message) => a.date - b.date))
    );
  }

  getReadMessages(timestamp: number = Date.now() / 1000, limit: number = environment.batch_size):Observable<Message[]> {
    return this.messages$.pipe(
      switchMap(db => from(db.find({
        selector: {
          readedAt: { $lt: timestamp },
          date: { $gte: null }
        },
        limit: limit,
        sort: [ { date: 'desc' } ]
      }))),
      switchMap(result => {
        if (!result.docs.length)
          return of([] as Message[]);

        let conferenceIds = result.docs.map((d: any) => d.conference);
        let authorIds = result.docs.map((d: any) => d.author);

        let conferences$ = this.conferences$.pipe(
          switchMap(db => from(db.allDocs({
            keys: conferenceIds,
            include_docs: true
          })))
        );

        let authors$ = this.users$.pipe(
          switchMap(db => from(db.allDocs({
            keys: authorIds,
            include_docs: true
          })))
        );

        return zip(of(result.docs), conferences$, authors$).pipe(
          switchMap(([ docs, conferences, authors ]) => {
            let participantIds = conferences.rows
              .filter((r: any) => 'participant' in r.doc)
              .map((r: any) => r.doc.participant);

            let participants$ = this.users$.pipe(
              switchMap(db => from(db.allDocs({
                keys: participantIds,
                include_docs: true
              })))
            );
          
            return zip(of(docs), of(conferences), of(authors), participants$).pipe(
              map(([ docs, conferences, authors, participants ]) => {
                let messages: Message[] = docs.map((d: any) => {
                  // how to typify this more convenient?
                  let c = conferences.rows.find((r: any) => r.id === d.conference).doc as {
                    _id: string,
                    _rev: string,
                    type: 'private' | 'public' | 'secret',
                    updated_at: number,
                    messages_count: number,
                    unread_messages_count: number,
                    participant?: string
                  };

                  let conference: Conference = {
                    uuid: c._id,
                    type: c.type,
                    updated_at: c.updated_at,
                    messages_count: c.messages_count,
                    unread_messages_count: c.unread_messages_count
                  };
                 
                  if ('participant' in c) {
                    // how to typify this more convenient?
                    let p = participants.rows.find((r: any) => r.id === c.participant).doc as {
                      _id: string,
                      _rev: string,
                      email?: string,
                      name: string,
                      hash?: string,
                      last_seen?: number,
                      conferences_count: number,
                      public_key?: string,
                      private_key?: string,
                      revocation_certificate?: string
                    };

                    conference.participant = (({ _id, _rev, ...p  }) => p)({ uuid: p._id, ...p });
                  }
                  
                  // how to typify this more convenient?
                  let a = authors.rows.find((r: any) => r.id === d.author).doc as {
                    _id: string,
                    _rev: string,
                    email?: string,
                    name: string,
                    hash?: string,
                    last_seen?: number,
                    conferences_count: number,
                    public_key?: string,
                    private_key?: string,
                    revocation_certificate?: string
                  };

                  let author: User = (({ _id, _rev, ...a }) => a)({ uuid: a._id, ...a });

                  let message: Message = (({ _id, _rev, ...message }) => message)({
                    uuid: d._id,
                    ...d,
                    conference: conference,
                    author: author
                  });

                  return message;
                });

                return messages;
              })
            );
          })
        );
      }),
      map((messages: Message[]) => messages.sort((a: Message, b: Message) => a.date - b.date))
    );
  }

  getMessagesByParticipant(uuid: string, timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Message[]> {
    return this.conferences$.pipe(
      switchMap(db => from(db.find({
        selector: {
          participant: uuid,
          updated_at: { $gte: null }
        }
      }))),
      switchMap(result => {
        if (!result.docs.length)
          return throwError(new Error('Conference with that participant does not exist'));
        
        return this.messages$.pipe(
          switchMap(db => from(db.find({
            selector: {
              conference: result.docs[0]._id,
              date: { $lt: timestamp }
            },
            limit: limit,
            sort: [ { date: 'desc' } ]
          })))
        );
      }),
      switchMap(result => {
        if (!result.docs.length)
          return of([] as Message[]);

        let conferenceIds = result.docs.map((d: any) => d.conference);
        let authorIds = result.docs.map((d: any) => d.author);

        let conferences$ = this.conferences$.pipe(
          switchMap(db => from(db.allDocs({
            keys: conferenceIds,
            include_docs: true
          })))
        );

        let authors$ = this.users$.pipe(
          switchMap(db => from(db.allDocs({
            keys: authorIds,
            include_docs: true
          })))
        );

        return zip(of(result.docs), conferences$, authors$).pipe(
          switchMap(([ docs, conferences, authors ]) => {
            let participantIds = conferences.rows
              .filter((r: any) => 'participant' in r.doc)
              .map((r: any) => r.doc.participant);

            let participants$ = this.users$.pipe(
              switchMap(db => from(db.allDocs({
                keys: participantIds,
                include_docs: true
              })))
            );
          
            return zip(of(docs), of(conferences), of(authors), participants$).pipe(
              map(([ docs, conferences, authors, participants ]) => {
                let messages: Message[] = docs.map((d: any) => {
                  // how to typify this more convenient?
                  let c = conferences.rows.find((r: any) => r.id === d.conference).doc as {
                    _id: string,
                    _rev: string,
                    type: 'private' | 'public' | 'secret',
                    updated_at: number,
                    messages_count: number,
                    unread_messages_count: number,
                    participant?: string
                  };

                  let conference: Conference = {
                    uuid: c._id,
                    type: c.type,
                    updated_at: c.updated_at,
                    messages_count: c.messages_count,
                    unread_messages_count: c.unread_messages_count
                  };
                 
                  if ('participant' in c) {
                    // how to typify this more convenient?
                    let p = participants.rows.find((r: any) => r.id === c.participant).doc as {
                      _id: string,
                      _rev: string,
                      email?: string,
                      name: string,
                      hash?: string,
                      last_seen?: number,
                      conferences_count: number,
                      public_key?: string,
                      private_key?: string,
                      revocation_certificate?: string
                    };

                    conference.participant = (({ _id, _rev, ...p  }) => p)({ uuid: p._id, ...p });
                  }
                  
                  // how to typify this more convenient?
                  let a = authors.rows.find((r: any) => r.id === d.author).doc as {
                    _id: string,
                    _rev: string,
                    email?: string,
                    name: string,
                    hash?: string,
                    last_seen?: number,
                    conferences_count: number,
                    public_key?: string,
                    private_key?: string,
                    revocation_certificate?: string
                  };

                  let author: User = (({ _id, _rev, ...a }) => a)({ uuid: a._id, ...a });

                  let message: Message = (({ _id, _rev, ...message }) => message)({
                    uuid: d._id,
                    ...d,
                    conference: conference,
                    author: author
                  });

                  return message;
                });

                return messages;
              })
            );
          })
        );
      }),
      map((messages: Message[]) => messages.sort((a: Message, b: Message) => a.date - b.date))
    );
  }

  getUnreadMessagesByParticipant(uuid: string, timestamp: number = 0, limit: number = environment.batch_size): Observable<Message[]> {
    return this.conferences$.pipe(
      switchMap(db => from(db.find({
        selector: {
          participant: uuid,
          updated_at: { $gte: null }
        }
      }))),
      switchMap(result => {
        if (!result.docs.length)
          return throwError(new Error('Conference with that participant does not exist'));
        
        return this.messages$.pipe(
          switchMap(db => from(db.find({
            selector: {
              conference: result.docs[0]._id,
              readed: false,
              date: { $gt: timestamp }
            },
            limit: limit,
            sort: [ { date: 'asc' } ]
          })))
        );
      }),
      switchMap(result => {
        if (!result.docs.length)
          return of([] as Message[]);

        let conferenceIds = result.docs.map((d: any) => d.conference);
        let authorIds = result.docs.map((d: any) => d.author);

        let conferences$ = this.conferences$.pipe(
          switchMap(db => from(db.allDocs({
            keys: conferenceIds,
            include_docs: true
          })))
        );

        let authors$ = this.users$.pipe(
          switchMap(db => from(db.allDocs({
            keys: authorIds,
            include_docs: true
          })))
        );

        return zip(of(result.docs), conferences$, authors$).pipe(
          switchMap(([ docs, conferences, authors ]) => {
            let participantIds = conferences.rows
              .filter((r: any) => 'participant' in r.doc)
              .map((r: any) => r.doc.participant);

            let participants$ = this.users$.pipe(
              switchMap(db => from(db.allDocs({
                keys: participantIds,
                include_docs: true
              })))
            );
          
            return zip(of(docs), of(conferences), of(authors), participants$).pipe(
              map(([ docs, conferences, authors, participants ]) => {
                let messages: Message[] = docs.map((d: any) => {
                  // how to typify this more convenient?
                  let c = conferences.rows.find((r: any) => r.id === d.conference).doc as {
                    _id: string,
                    _rev: string,
                    type: 'private' | 'public' | 'secret',
                    updated_at: number,
                    messages_count: number,
                    unread_messages_count: number,
                    participant?: string
                  };

                  let conference: Conference = {
                    uuid: c._id,
                    type: c.type,
                    updated_at: c.updated_at,
                    messages_count: c.messages_count,
                    unread_messages_count: c.unread_messages_count
                  };
                 
                  if ('participant' in c) {
                    // how to typify this more convenient?
                    let p = participants.rows.find((r: any) => r.id === c.participant).doc as {
                      _id: string,
                      _rev: string,
                      email?: string,
                      name: string,
                      hash?: string,
                      last_seen?: number,
                      conferences_count: number,
                      public_key?: string,
                      private_key?: string,
                      revocation_certificate?: string
                    };

                    conference.participant = (({ _id, _rev, ...p  }) => p)({ uuid: p._id, ...p });
                  }
                  
                  // how to typify this more convenient?
                  let a = authors.rows.find((r: any) => r.id === d.author).doc as {
                    _id: string,
                    _rev: string,
                    email?: string,
                    name: string,
                    hash?: string,
                    last_seen?: number,
                    conferences_count: number,
                    public_key?: string,
                    private_key?: string,
                    revocation_certificate?: string
                  };

                  let author: User = (({ _id, _rev, ...a }) => a)({ uuid: a._id, ...a });

                  let message: Message = (({ _id, _rev, ...message }) => message)({
                    uuid: d._id,
                    ...d,
                    conference: conference,
                    author: author
                  });

                  return message;
                });

                return messages;
              })
            );
          })
        );
      }),
      map((messages: Message[]) => messages.sort((a: Message, b: Message) => a.date - b.date))
    );
  }

  getOldMessagesByParticipant(uuid: string, timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Message[]> {
    return this.conferences$.pipe(
      switchMap(db => from(db.find({
        selector: {
          participant: uuid,
          updated_at: { $gte: null }
        }
      }))),
      switchMap(result => {
        if (!result.docs.length)
          return throwError(new Error('Conference with that participant does not exist'));
        
        return this.messages$.pipe(
          switchMap(db => from(db.find({
            selector: {
              conference: result.docs[0]._id,
              date: { $lt: timestamp }
            },
            limit: limit,
            sort: [ { date: 'desc' } ]
          })))
        );
      }),
      switchMap(result => {
        if (!result.docs.length)
          return of([] as Message[]);

        let conferenceIds = result.docs.map((d: any) => d.conference);
        let authorIds = result.docs.map((d: any) => d.author);

        let conferences$ = this.conferences$.pipe(
          switchMap(db => from(db.allDocs({
            keys: conferenceIds,
            include_docs: true
          })))
        );

        let authors$ = this.users$.pipe(
          switchMap(db => from(db.allDocs({
            keys: authorIds,
            include_docs: true
          })))
        );

        return zip(of(result.docs), conferences$, authors$).pipe(
          switchMap(([ docs, conferences, authors ]) => {
            let participantIds = conferences.rows
              .filter((r: any) => 'participant' in r.doc)
              .map((r: any) => r.doc.participant);

            let participants$ = this.users$.pipe(
              switchMap(db => from(db.allDocs({
                keys: participantIds,
                include_docs: true
              })))
            );
          
            return zip(of(docs), of(conferences), of(authors), participants$).pipe(
              map(([ docs, conferences, authors, participants ]) => {
                let messages: Message[] = docs.map((d: any) => {
                  // how to typify this more convenient?
                  let c = conferences.rows.find((r: any) => r.id === d.conference).doc as {
                    _id: string,
                    _rev: string,
                    type: 'private' | 'public' | 'secret',
                    updated_at: number,
                    messages_count: number,
                    unread_messages_count: number,
                    participant?: string
                  };

                  let conference: Conference = {
                    uuid: c._id,
                    type: c.type,
                    updated_at: c.updated_at,
                    messages_count: c.messages_count,
                    unread_messages_count: c.unread_messages_count
                  };
                 
                  if ('participant' in c) {
                    // how to typify this more convenient?
                    let p = participants.rows.find((r: any) => r.id === c.participant).doc as {
                      _id: string,
                      _rev: string,
                      email?: string,
                      name: string,
                      hash?: string,
                      last_seen?: number,
                      conferences_count: number,
                      public_key?: string,
                      private_key?: string,
                      revocation_certificate?: string
                    };

                    conference.participant = (({ _id, _rev, ...p  }) => p)({ uuid: p._id, ...p });
                  }
                  
                  // how to typify this more convenient?
                  let a = authors.rows.find((r: any) => r.id === d.author).doc as {
                    _id: string,
                    _rev: string,
                    email?: string,
                    name: string,
                    hash?: string,
                    last_seen?: number,
                    conferences_count: number,
                    public_key?: string,
                    private_key?: string,
                    revocation_certificate?: string
                  };

                  let author: User = (({ _id, _rev, ...a }) => a)({ uuid: a._id, ...a });

                  let message: Message = (({ _id, _rev, ...message }) => message)({
                    uuid: d._id,
                    ...d,
                    conference: conference,
                    author: author
                  });

                  return message;
                });

                return messages;
              })
            );
          })
        );
      }),
      map((messages: Message[]) => messages.sort((a: Message, b: Message) => a.date - b.date))
    );
  }
  
  getNewMessagesByParticipant(uuid: string, timestamp: number = 0, limit: number = environment.batch_size): Observable<Message[]> {
    return this.conferences$.pipe(
      switchMap(db => from(db.find({
        selector: {
          participant: uuid,
          updated_at: { $gte: null }
        }
      }))),
      switchMap(result => {
        if (!result.docs.length)
          return throwError(new Error('Conference with that participant does not exist'));
        
        return this.messages$.pipe(
          switchMap(db => from(db.find({
            selector: {
              conference: result.docs[0]._id,
              date: { $gt: timestamp }
            },
            limit: limit,
            sort: [ { date: 'asc' } ]
          })))
        );
      }),
      switchMap(result => {
        if (!result.docs.length)
          return of([] as Message[]);

        let conferenceIds = result.docs.map((d: any) => d.conference);
        let authorIds = result.docs.map((d: any) => d.author);

        let conferences$ = this.conferences$.pipe(
          switchMap(db => from(db.allDocs({
            keys: conferenceIds,
            include_docs: true
          })))
        );

        let authors$ = this.users$.pipe(
          switchMap(db => from(db.allDocs({
            keys: authorIds,
            include_docs: true
          })))
        );

        return zip(of(result.docs), conferences$, authors$).pipe(
          switchMap(([ docs, conferences, authors ]) => {
            let participantIds = conferences.rows
              .filter((r: any) => 'participant' in r.doc)
              .map((r: any) => r.doc.participant);

            let participants$ = this.users$.pipe(
              switchMap(db => from(db.allDocs({
                keys: participantIds,
                include_docs: true
              })))
            );
          
            return zip(of(docs), of(conferences), of(authors), participants$).pipe(
              map(([ docs, conferences, authors, participants ]) => {
                let messages: Message[] = docs.map((d: any) => {
                  // how to typify this more convenient?
                  let c = conferences.rows.find((r: any) => r.id === d.conference).doc as {
                    _id: string,
                    _rev: string,
                    type: 'private' | 'public' | 'secret',
                    updated_at: number,
                    messages_count: number,
                    unread_messages_count: number,
                    participant?: string
                  };

                  let conference: Conference = {
                    uuid: c._id,
                    type: c.type,
                    updated_at: c.updated_at,
                    messages_count: c.messages_count,
                    unread_messages_count: c.unread_messages_count
                  };
                 
                  if ('participant' in c) {
                    // how to typify this more convenient?
                    let p = participants.rows.find((r: any) => r.id === c.participant).doc as {
                      _id: string,
                      _rev: string,
                      email?: string,
                      name: string,
                      hash?: string,
                      last_seen?: number,
                      conferences_count: number,
                      public_key?: string,
                      private_key?: string,
                      revocation_certificate?: string
                    };

                    conference.participant = (({ _id, _rev, ...p  }) => p)({ uuid: p._id, ...p });
                  }
                  
                  // how to typify this more convenient?
                  let a = authors.rows.find((r: any) => r.id === d.author).doc as {
                    _id: string,
                    _rev: string,
                    email?: string,
                    name: string,
                    hash?: string,
                    last_seen?: number,
                    conferences_count: number,
                    public_key?: string,
                    private_key?: string,
                    revocation_certificate?: string
                  };

                  let author: User = (({ _id, _rev, ...a }) => a)({ uuid: a._id, ...a });

                  let message: Message = (({ _id, _rev, ...message }) => message)({
                    uuid: d._id,
                    ...d,
                    conference: conference,
                    author: author
                  });

                  return message;
                });

                return messages;
              })
            );
          })
        );
      }),
      map((messages: Message[]) => messages.sort((a: Message, b: Message) => a.date - b.date))
    );
  }
  
  getMessagesByConference(uuid: string, timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Message[]> {
    return this.messages$.pipe(
      switchMap(db => from(db.find({
        selector: {
          conference: uuid,
          date: { $lt: timestamp }
        },
        limit: limit,
        sort: [ { date: 'desc' } ]
      }))),
      switchMap(result => {
        if (!result.docs.length)
          return of([] as Message[]);

        let conferenceIds = result.docs.map((d: any) => d.conference);
        let authorIds = result.docs.map((d: any) => d.author);

        let conferences$ = this.conferences$.pipe(
          switchMap(db => from(db.allDocs({
            keys: conferenceIds,
            include_docs: true
          })))
        );

        let authors$ = this.users$.pipe(
          switchMap(db => from(db.allDocs({
            keys: authorIds,
            include_docs: true
          })))
        );

        return zip(of(result.docs), conferences$, authors$).pipe(
          switchMap(([ docs, conferences, authors ]) => {
            let participantIds = conferences.rows
              .filter((r: any) => 'participant' in r.doc)
              .map((r: any) => r.doc.participant);

            let participants$ = this.users$.pipe(
              switchMap(db => from(db.allDocs({
                keys: participantIds,
                include_docs: true
              })))
            );
          
            return zip(of(docs), of(conferences), of(authors), participants$).pipe(
              map(([ docs, conferences, authors, participants ]) => {
                let messages: Message[] = docs.map((d: any) => {
                  // how to typify this more convenient?
                  let c = conferences.rows.find((r: any) => r.id === d.conference).doc as {
                    _id: string,
                    _rev: string,
                    type: 'private' | 'public' | 'secret',
                    updated_at: number,
                    messages_count: number,
                    unread_messages_count: number,
                    participant?: string
                  };

                  let conference: Conference = {
                    uuid: c._id,
                    type: c.type,
                    updated_at: c.updated_at,
                    messages_count: c.messages_count,
                    unread_messages_count: c.unread_messages_count
                  };
                 
                  if ('participant' in c) {
                    // how to typify this more convenient?
                    let p = participants.rows.find((r: any) => r.id === c.participant).doc as {
                      _id: string,
                      _rev: string,
                      email?: string,
                      name: string,
                      hash?: string,
                      last_seen?: number,
                      conferences_count: number,
                      public_key?: string,
                      private_key?: string,
                      revocation_certificate?: string
                    };

                    conference.participant = (({ _id, _rev, ...p  }) => p)({ uuid: p._id, ...p });
                  }
                  
                  // how to typify this more convenient?
                  let a = authors.rows.find((r: any) => r.id === d.author).doc as {
                    _id: string,
                    _rev: string,
                    email?: string,
                    name: string,
                    hash?: string,
                    last_seen?: number,
                    conferences_count: number,
                    public_key?: string,
                    private_key?: string,
                    revocation_certificate?: string
                  };

                  let author: User = (({ _id, _rev, ...a }) => a)({ uuid: a._id, ...a });

                  let message: Message = (({ _id, _rev, ...message }) => message)({
                    uuid: d._id,
                    ...d,
                    conference: conference,
                    author: author
                  });

                  return message;
                });

                return messages;
              })
            );
          })
        );
      }),
      map((messages: Message[]) => messages.sort((a: Message, b: Message) => a.date - b.date))
    );
  }

  getUnreadMessagesByConference(uuid: string, timestamp: number = 0, limit: number = environment.batch_size): Observable<Message[]> {
    return this.messages$.pipe(
      switchMap(db => from(db.find({
        selector: {
          conference: uuid,
          readed: false,
          date: { $lt: timestamp }
        },
        limit: limit,
        sort: [ { date: 'asc' } ]
      }))),
      switchMap(result => {
        if (!result.docs.length)
          return of([] as Message[]);

        let conferenceIds = result.docs.map((d: any) => d.conference);
        let authorIds = result.docs.map((d: any) => d.author);

        let conferences$ = this.conferences$.pipe(
          switchMap(db => from(db.allDocs({
            keys: conferenceIds,
            include_docs: true
          })))
        );

        let authors$ = this.users$.pipe(
          switchMap(db => from(db.allDocs({
            keys: authorIds,
            include_docs: true
          })))
        );

        return zip(of(result.docs), conferences$, authors$).pipe(
          switchMap(([ docs, conferences, authors ]) => {
            let participantIds = conferences.rows
              .filter((r: any) => 'participant' in r.doc)
              .map((r: any) => r.doc.participant);

            let participants$ = this.users$.pipe(
              switchMap(db => from(db.allDocs({
                keys: participantIds,
                include_docs: true
              })))
            );
          
            return zip(of(docs), of(conferences), of(authors), participants$).pipe(
              map(([ docs, conferences, authors, participants ]) => {
                let messages: Message[] = docs.map((d: any) => {
                  // how to typify this more convenient?
                  let c = conferences.rows.find((r: any) => r.id === d.conference).doc as {
                    _id: string,
                    _rev: string,
                    type: 'private' | 'public' | 'secret',
                    updated_at: number,
                    messages_count: number,
                    unread_messages_count: number,
                    participant?: string
                  };

                  let conference: Conference = {
                    uuid: c._id,
                    type: c.type,
                    updated_at: c.updated_at,
                    messages_count: c.messages_count,
                    unread_messages_count: c.unread_messages_count
                  };
                 
                  if ('participant' in c) {
                    // how to typify this more convenient?
                    let p = participants.rows.find((r: any) => r.id === c.participant).doc as {
                      _id: string,
                      _rev: string,
                      email?: string,
                      name: string,
                      hash?: string,
                      last_seen?: number,
                      conferences_count: number,
                      public_key?: string,
                      private_key?: string,
                      revocation_certificate?: string
                    };

                    conference.participant = (({ _id, _rev, ...p  }) => p)({ uuid: p._id, ...p });
                  }
                  
                  // how to typify this more convenient?
                  let a = authors.rows.find((r: any) => r.id === d.author).doc as {
                    _id: string,
                    _rev: string,
                    email?: string,
                    name: string,
                    hash?: string,
                    last_seen?: number,
                    conferences_count: number,
                    public_key?: string,
                    private_key?: string,
                    revocation_certificate?: string
                  };

                  let author: User = (({ _id, _rev, ...a }) => a)({ uuid: a._id, ...a });

                  let message: Message = (({ _id, _rev, ...message }) => message)({
                    uuid: d._id,
                    ...d,
                    conference: conference,
                    author: author
                  });

                  return message;
                });

                return messages;
              })
            );
          })
        );
      }),
      map((messages: Message[]) => messages.sort((a: Message, b: Message) => a.date - b.date))
    );
  }

  getOldMessagesByConference(uuid: string, timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Message[]> {
    return this.messages$.pipe(
      switchMap(db => from(db.find({
        selector: {
          conference: uuid,
          date: { $lt: timestamp }
        },
        limit: limit,
        sort: [ { date: 'desc' } ]
      }))),
      switchMap(result => {
        if (!result.docs.length)
          return of([] as Message[]);

        let conferenceIds = result.docs.map((d: any) => d.conference);
        let authorIds = result.docs.map((d: any) => d.author);

        let conferences$ = this.conferences$.pipe(
          switchMap(db => from(db.allDocs({
            keys: conferenceIds,
            include_docs: true
          })))
        );

        let authors$ = this.users$.pipe(
          switchMap(db => from(db.allDocs({
            keys: authorIds,
            include_docs: true
          })))
        );

        return zip(of(result.docs), conferences$, authors$).pipe(
          switchMap(([ docs, conferences, authors ]) => {
            let participantIds = conferences.rows
              .filter((r: any) => 'participant' in r.doc)
              .map((r: any) => r.doc.participant);

            let participants$ = this.users$.pipe(
              switchMap(db => from(db.allDocs({
                keys: participantIds,
                include_docs: true
              })))
            );
          
            return zip(of(docs), of(conferences), of(authors), participants$).pipe(
              map(([ docs, conferences, authors, participants ]) => {
                let messages: Message[] = docs.map((d: any) => {
                  // how to typify this more convenient?
                  let c = conferences.rows.find((r: any) => r.id === d.conference).doc as {
                    _id: string,
                    _rev: string,
                    type: 'private' | 'public' | 'secret',
                    updated_at: number,
                    messages_count: number,
                    unread_messages_count: number,
                    participant?: string
                  };

                  let conference: Conference = {
                    uuid: c._id,
                    type: c.type,
                    updated_at: c.updated_at,
                    messages_count: c.messages_count,
                    unread_messages_count: c.unread_messages_count
                  };
                 
                  if ('participant' in c) {
                    // how to typify this more convenient?
                    let p = participants.rows.find((r: any) => r.id === c.participant).doc as {
                      _id: string,
                      _rev: string,
                      email?: string,
                      name: string,
                      hash?: string,
                      last_seen?: number,
                      conferences_count: number,
                      public_key?: string,
                      private_key?: string,
                      revocation_certificate?: string
                    };

                    conference.participant = (({ _id, _rev, ...p  }) => p)({ uuid: p._id, ...p });
                  }
                  
                  // how to typify this more convenient?
                  let a = authors.rows.find((r: any) => r.id === d.author).doc as {
                    _id: string,
                    _rev: string,
                    email?: string,
                    name: string,
                    hash?: string,
                    last_seen?: number,
                    conferences_count: number,
                    public_key?: string,
                    private_key?: string,
                    revocation_certificate?: string
                  };

                  let author: User = (({ _id, _rev, ...a }) => a)({ uuid: a._id, ...a });

                  let message: Message = (({ _id, _rev, ...message }) => message)({
                    uuid: d._id,
                    ...d,
                    conference: conference,
                    author: author
                  });

                  return message;
                });

                return messages;
              })
            );
          })
        );
      }),
      map((messages: Message[]) => messages.sort((a: Message, b: Message) => a.date - b.date))
    );
  }
  
  getNewMessagesByConference(uuid: string, timestamp: number = 0, limit: number = environment.batch_size): Observable<Message[]> {
    return this.messages$.pipe(
      switchMap(db => from(db.find({
        selector: {
          conference: uuid,
          date: { $gt: timestamp }
        },
        limit: limit,
        sort: [ { date: 'asc' } ]
      }))),
      switchMap(result => {
        if (!result.docs.length)
          return of([] as Message[]);

        let conferenceIds = result.docs.map((d: any) => d.conference);
        let authorIds = result.docs.map((d: any) => d.author);

        let conferences$ = this.conferences$.pipe(
          switchMap(db => from(db.allDocs({
            keys: conferenceIds,
            include_docs: true
          })))
        );

        let authors$ = this.users$.pipe(
          switchMap(db => from(db.allDocs({
            keys: authorIds,
            include_docs: true
          })))
        );

        return zip(of(result.docs), conferences$, authors$).pipe(
          switchMap(([ docs, conferences, authors ]) => {
            let participantIds = conferences.rows
              .filter((r: any) => 'participant' in r.doc)
              .map((r: any) => r.doc.participant);

            let participants$ = this.users$.pipe(
              switchMap(db => from(db.allDocs({
                keys: participantIds,
                include_docs: true
              })))
            );
          
            return zip(of(docs), of(conferences), of(authors), participants$).pipe(
              map(([ docs, conferences, authors, participants ]) => {
                let messages: Message[] = docs.map((d: any) => {
                  // how to typify this more convenient?
                  let c = conferences.rows.find((r: any) => r.id === d.conference).doc as {
                    _id: string,
                    _rev: string,
                    type: 'private' | 'public' | 'secret',
                    updated_at: number,
                    messages_count: number,
                    unread_messages_count: number,
                    participant?: string
                  };

                  let conference: Conference = {
                    uuid: c._id,
                    type: c.type,
                    updated_at: c.updated_at,
                    messages_count: c.messages_count,
                    unread_messages_count: c.unread_messages_count
                  };
                 
                  if ('participant' in c) {
                    // how to typify this more convenient?
                    let p = participants.rows.find((r: any) => r.id === c.participant).doc as {
                      _id: string,
                      _rev: string,
                      email?: string,
                      name: string,
                      hash?: string,
                      last_seen?: number,
                      conferences_count: number,
                      public_key?: string,
                      private_key?: string,
                      revocation_certificate?: string
                    };

                    conference.participant = (({ _id, _rev, ...p  }) => p)({ uuid: p._id, ...p });
                  }
                  
                  // how to typify this more convenient?
                  let a = authors.rows.find((r: any) => r.id === d.author).doc as {
                    _id: string,
                    _rev: string,
                    email?: string,
                    name: string,
                    hash?: string,
                    last_seen?: number,
                    conferences_count: number,
                    public_key?: string,
                    private_key?: string,
                    revocation_certificate?: string
                  };

                  let author: User = (({ _id, _rev, ...a }) => a)({ uuid: a._id, ...a });

                  let message: Message = (({ _id, _rev, ...message }) => message)({
                    uuid: d._id,
                    ...d,
                    conference: conference,
                    author: author
                  });

                  return message;
                });

                return messages;
              })
            );
          })
        );
      }),
      map((messages: Message[]) => messages.sort((a: Message, b: Message) => a.date - b.date))
    );
  }

  upsertMessage(message: Message): Observable<Message> {
    return this.upsertConference(message.conference).pipe(
      switchMap(() => this.upsertUser(message.author)),
      switchMap(() => this.messages$),
      switchMap(db => from(db.upsert(message.uuid, (doc: any) => {
        let { uuid, ...d } = Object.assign(
          doc,
          {
            ...message,
            conference: message.conference.uuid,
            author: message.author.uuid
          }
        );

        return d;
      }))),
      map(result => message)
    );
  }

  readMessage(message: Message): Observable<Message> {
    return this.messages$.pipe(
      switchMap(db => from(db.upsert(message.uuid, (doc: any) => {
        if (!!Object.keys(doc).length) {
          let { uuid, d } = Object.assign(
            doc,
            {
              readed: message.readed,
              readedAt: message.readedAt
            }
          );

          return d;
        }

        return false;
      }))),
      map(result => message)
    );
  }

  bulkMessages(messages: Message[]): Observable<Message[]> {
    messages = messages.reduce((acc, cur) => {
      if (acc.find(a => a.uuid === cur.uuid))
        return acc;

      return [ ...acc, cur ];
    }, [] as Message[]);

    let conferences: Conference[] = messages.map((m: Message) => m.conference);
    let authors: User[] = messages.map((m: Message) => m.author);

    return this.bulkConferences(conferences).pipe(
      switchMap(() => this.bulkUsers(authors)),
      switchMap(() => this.messages$),
      switchMap(db => {
        let ids = messages.map((m: Message) => m.uuid);

        return from(db.allDocs({
          keys: ids,
          include_docs: true
        }));
      }),
      switchMap(result => {
        // Property 'error' does not exist on type 'never'.
        let errors = result.rows.filter((r: any) => 'error' in r && r.error !== 'not_found');

        if (!!errors.length)
          return throwError(errors);

        let rows = result.rows.filter(r => !('error' in r));
        
        let docs = messages.map((m: Message) => {
          let row = rows.find(r => r.id === m.uuid);

          if (row) {
            let { uuid, ...doc } = Object.assign(
              row.doc,
              {
                ...m,
                conference: m.conference.uuid,
                author: m.author.uuid
              }
            );

            return doc;
          }

          let doc = (({ uuid, ...doc }) => doc)({
            ...m,
            _id: m.uuid,
            conference: m.conference.uuid,
            author: m.author.uuid
          });

          return doc;
        });
        
        return this.messages$.pipe(
          switchMap(db => from(db.bulkDocs(docs)))
        );
      }),
      switchMap(result => {
        let errors = result.filter(r => 'error' in r);

        if (!!errors.length)
          return throwError(errors);

        return of(messages);
      })
    );
  }

  readMessages(messages: Message[]): Observable<Message[]> {
    return this.messages$.pipe(
      switchMap(db => {
        let ids = messages.map((m: Message) => m.uuid);

        return from(db.allDocs({
          keys: ids,
          include_docs: true
        }));
      }),
      switchMap(result => {
        // Property 'error' does not exist on type 'never'.
        let errors = result.rows.filter((r: any) => 'error' in r && r.error !== 'not_found');

        if (!!errors.length)
          return throwError(errors);

        let rows = result.rows.filter(r => !('error' in r));
        
        let docs = messages
          .filter((m: Message) => rows.find(r => r.id === m.uuid))
          .map((m: Message) => {
            let row = rows.find(r => r.id === m.uuid);

            let doc = Object.assign(
              row.doc,
              {
                readed: m.readed,
                readedAt: m.readedAt
              }
            );

            return doc;
          });

        return this.messages$.pipe(
          switchMap(db => from(db.bulkDocs(docs)))
        );
      }),
      switchMap(result => {
        let errors = result.filter(r => 'error' in r);

        if (!!errors.length)
          return throwError(errors);

        return of(messages);
      })
    );
  }

  ngOnDestroy() {
    this.userChanges$.pipe(
      tap(changes => changes.cancel()) 
    ).subscribe();

    this.users$.pipe(
      switchMap(db => from(db.destroy()))
    ).subscribe();

    this.conferences$.pipe(
      switchMap(db => from(db.destroy()))
    ).subscribe();

    this.messages$.pipe(
      switchMap(db => from(db.destroy()))
    ).subscribe();

    this.unsubscribe$.next();
    this.unsubscribe$.complete();

    this.isSynchronized$.complete();
  }
}
