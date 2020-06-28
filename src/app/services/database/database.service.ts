import { environment } from '../../../environments/environment';

import { Injectable, OnDestroy } from '@angular/core';

import { Observable, Subject, BehaviorSubject, from, of, concat, zip, throwError } from 'rxjs';
import { map, tap, finalize, filter, ignoreElements, reduce, retry, switchMap, concatMap, delayWhen, shareReplay, takeUntil } from 'rxjs/operators';

import RxDB, { RxDatabase, RxCollection, RxDocument } from 'rxdb';

import * as PouchdbAdapterIdb from 'pouchdb-adapter-idb';

RxDB.plugin(PouchdbAdapterIdb);

import { UserDocument } from './documents/user.document';
import { ConferenceDocument, ConferenceDocType } from './documents/conference.document';
import { MessageDocument, MessageDocType } from './documents/message.document';

import { UserCollection } from './collections/user.collection';
import { ConferencesCollection } from './collections/conference.collection';
import { MessagesCollection } from './collections/messages.collection';

import userSchema from './schemas/user.schema';
import conferenceSchema from './schemas/conference.schema';
import messageSchema from './schemas/message.schema';

import { AuthService } from '../../components/auth/auth.service';

import { User } from '../../models/user.model';
import { Conference } from '../../models/conference.model';
import { Message } from '../../models/message.model';
import { deleteOldCollection } from 'rxdb/dist/typings/data-migrator';

type Collections = {
  users: UserCollection,
  conferences: ConferencesCollection,
  messages: MessagesCollection
};

@Injectable()
export class DatabaseService implements OnDestroy {
  static readonly BATCH_SIZE = 20;

  private unsubscribe$ = new Subject<void>();

  public isSynchronized$ = new BehaviorSubject<boolean>(false);

  public $: Observable<RxDatabase<Collections>> = from(
    RxDB.create<RxDatabase<Collections>>({
      name: 'crypterdb',
      adapter: 'idb',
      queryChangeDetection: true,
      multiInstance: (environment.test) ? true : false,
      ignoreDuplicate: (environment.test) ? true : false
    })
  ).pipe(
    delayWhen(db =>
      zip(
        db.collection({
          name: 'users',
          schema: userSchema
        }),
        db.collection({
          name: 'conferences',
          schema: conferenceSchema
        }),
        db.collection({
          name: 'messages',
          schema: messageSchema
        })
      )
    ),
    shareReplay(1)
  );

  public user$: Observable<User> = this.getUser(this.authService.user.uuid).pipe(
    takeUntil(this.unsubscribe$),
    filter((user: User|null) => !!user),
    shareReplay(1)
  );

  constructor(private authService: AuthService) { }

  synchronize(conferences: Conference[] = [], messages: Message[] = [], read_messages: Message[] = [], unread_messages: Message[] = []): Observable<void> {
    return concat(
      this.$.pipe(
        delayWhen(db => {
          let users: UserDocument[] = conferences
            .filter(c => c.participant && this.authService.user.uuid !== c.participant.uuid)
            .map(c => c.participant as UserDocument);

            return from(db.users.bulkInsert(users)).pipe(
              switchMap(result => {
                if (!result.error.length) {
                  /*
                  return concat(
                    ...users
                      .filter(u => result.error.find(e => e.id === u.uuid && e.status === 409))
                      .map(u => from(this.$.pipe(switchMap(db => db.users.atomicUpsert(u as UserDocument)))))
                  ).pipe(
                    reduce((acc, cur) => [ ...acc, cur ], result.success)
                  );
                  */
                }

                return of(result.success);
              }
            )
          ); 
        }),
        switchMap(db => {
          let documents: ConferenceDocument[] = conferences.map(c => {
            let document = {
              uuid: c.uuid,
              updated: +c.updated,
              count: c.count,
              unread: c.unread,
              participant: c.participant ? c.participant.uuid : undefined
            } as ConferenceDocument;

            if ('participant' in c)
              document.participant = c.participant.uuid;

            return document;
          });

          return from(db.conferences.bulkInsert(documents)).pipe(
            switchMap(result => {
              if (!!result.error.length) {
                /*
                return concat(
                  ...documents
                    .filter(d => result.error.find(e => e.id === d.uuid && e.status === 409))
                    .map(d => from(this.$.pipe(switchMap(db => db.conferences.atomicUpsert(d)))))
                ).pipe(
                  reduce((acc, cur) => [ ...acc, cur ], result.success)
                );
                */
              }

              return of(result.success);
            }),
          );
        })
      ),
      this.$.pipe(
        delayWhen(db => {
          let documents: UserDocument[] = messages
            .filter(m => m.author.uuid !== this.authService.user.uuid)
            .map(m => m.author as UserDocument);

          return from(db.users.bulkInsert(documents)).pipe(
            switchMap(result => {
              if (!!result.error.length) {
                /*
                return concat(
                  ...documents
                    .filter(d => result.error.find(e => e.id === d.uuid && e.status === 409))
                    .map(d => from(this.$.pipe(switchMap(db => db.users.atomicUpsert(d)))))
                ).pipe(
                  reduce((acc, cur) => [ ...acc, cur ], result.success)
                );
                */
              }

              return of(result.success);
            })
          )
        }),
        delayWhen(db => {
          let documents: UserDocument[] = messages
            .filter(m => m.conference.participant)
            .map(m => m.conference.participant as UserDocument);

          return from(db.users.bulkInsert(documents)).pipe(
            switchMap(result => {
              if (!!result.error.length) {
                /*
                return concat(
                  ...documents
                    .filter(d => result.error.find(e => e.id === d.uuid && e.status === 409))
                    .map(d => from(this.$.pipe(switchMap(db => db.users.atomicUpsert(d)))))
                ).pipe(
                  reduce((acc, cur) => [ ...acc, cur ], result.success)
                );
                */
              }

              return of(result.success);
            })
          );
        }),
        delayWhen(db => {
          let documents: ConferenceDocument[] = messages.map(m => {
            let document = {
              uuid: m.conference.uuid,
              updated: +m.conference.updated,
              count: m.conference.count,
              unread: m.conference.unread,
            } as ConferenceDocument;
            
            if ('participant' in m.conference)
              document.participant = m.conference.participant.uuid;

            return document;
          });

          return from(db.conferences.bulkInsert(documents)).pipe(
            switchMap(result => {
              if (!!result.error.length) {
                /*
                return concat(
                  ...documents
                    .filter(d => result.error.find(e => e.id === d.uuid && e.status === 409))
                    .map(d => from(this.$.pipe(switchMap(db => db.conferences.atomicUpsert(d)))))
                ).pipe(
                  reduce((acc, cur) => [ ...acc, cur ], result.success)
                );
                */
              }

              return of(result.success);
            })
          );
        }),
        switchMap(db => {
          let documents: MessageDocument[] = messages.map(m => { 
            return {
              ...m,
              author: m.author.uuid,
              conference: m.conference.uuid
            } as MessageDocument;
          });

          return from(db.messages.bulkInsert(documents)).pipe(
            switchMap(result => {
              if (!!result.error.length) {
                /*
                return concat(
                  ...documents
                    .filter(d => result.error.find(e => e.id === d.uuid && e.status === 409))
                    .map(d => from(this.$.pipe(switchMap(db => db.messages.atomicUpsert(d)))))
                ).pipe(
                  reduce((acc, cur) => [ ...acc, cur ], result.success)
                );
                */
              }

              return of(result.success);
            })
          );
        })
      ),
      concat(...read_messages.map(m => this.$.pipe(
        switchMap(db => from(db.messages.findOne().where('uuid').eq(m.uuid).exec())),
        switchMap((document: MessageDocument) => {
          if (!document)
            return of(null);

          return from(document.atomicUpdate(oldData => {
            oldData.readed = m.readed,
            oldData.readedAt = m.readedAt

            return oldData;
          }));
        })
      ))),
      this.$.pipe(
        delayWhen(db => {
          let documents: UserDocument[] = unread_messages
            .filter(m => m.author.uuid !== this.authService.user.uuid)
            .map(m => m.author as UserDocument);

          return from(db.users.bulkInsert(documents)).pipe(
            switchMap(result => {
              if (!!result.error.length) {
                /*
                return concat(
                  ...documents
                    .filter(d => result.error.find(e => e.id === d.uuid && e.status === 409))
                    .map(d => from(this.$.pipe(switchMap(db => db.users.atomicUpsert(d)))))
                ).pipe(
                  reduce((acc, cur) => [ ...acc, cur ], result.success)
                );
                */
              }

              return of(result.success);
            })
          )
        }),
        delayWhen(db => {
          let documents: UserDocument[] = unread_messages
            .filter(m => m.conference.participant)
            .map(m => m.conference.participant as UserDocument);

          return from(db.users.bulkInsert(documents)).pipe(
            switchMap(result => {
              if (!!result.error.length) {
                /* 
                return concat(
                  ...documents
                    .filter(d => result.error.find(e => e.id === d.uuid && e.status === 409))
                    .map(d => from(this.$.pipe(switchMap(db => db.users.atomicUpsert(d)))))
                ).pipe(
                  reduce((acc, cur) => [ ...acc, cur ], result.success)
                );
                */
              }

              return of(result.success);
            })
          );
        }),
        delayWhen(db => {
          let documents: ConferenceDocument[] = unread_messages.map(m => {
            let document = {
              uuid: m.conference.uuid,
              updated: +m.conference.updated,
              count: m.conference.count,
              unread: m.conference.unread,
            } as ConferenceDocument;
            
            if ('participant' in m.conference)
              document.participant = m.conference.participant.uuid;

            return document;
          });

          return from(db.conferences.bulkInsert(documents)).pipe(
            switchMap(result => {
              if (!!result.error.length) {
                /*
                return concat(
                  ...documents
                    .filter(d => result.error.find(e => e.id === d.uuid && e.status === 409))
                    .map(d => from(this.$.pipe(switchMap(db => db.conferences.atomicUpsert(d)))))
                ).pipe(
                  reduce((acc, cur) => [ ...acc, cur ], result.success)
                );
                */
              }

              return of(result.success);
            })
          );
        }),
        switchMap(db => {
          let documents: MessageDocument[] = unread_messages.map(m => { 
            return {
              ...m,
              author: m.author.uuid,
              conference: m.conference.uuid
            } as MessageDocument;
          });

          return from(db.messages.bulkInsert(documents)).pipe(
            switchMap(result => {
              if (!!result.error.length) {
                /*
                return concat(
                  ...documents
                    .filter(d => result.error.find(e => e.id === d.uuid && e.status === 409))
                    .map(d => from(this.$.pipe(switchMap(db => db.messages.atomicUpsert(d)))))
                ).pipe(
                  reduce((acc, cur) => [ ...acc, cur ], result.success)
                );
                */
              }

              return of(result.success);
            })
          );
        })
      )
    ).pipe(
      ignoreElements(),
      finalize(() => this.isSynchronized$.next(true)),
      takeUntil(this.unsubscribe$)
    );
  }

  getUser(uuid: string): Observable<User|null> {
    return this.$.pipe(
      switchMap(db => db.users.findOne().where('uuid').eq(uuid).$),
      switchMap((document: UserDocument|null) => {
        if (!document)
          return of(null);

        return of(document).pipe(
          map((document: UserDocument) => {
            let user: User = {
              uuid: document.uuid,
              email: document.email,
              name: document.name,
              hash: document.hash,
              last_seen: document.last_seen,
              public_key: document.public_key,
              private_key: document.private_key,
              revocation_certificate: document.revocation_certificate
            };

            return user;
          })
        );
      }),
      takeUntil(this.unsubscribe$)
    );
  }

  upsertUser(user: User): Observable<User> {
    return this.$.pipe(
      switchMap(db => from(db.users.atomicUpsert(user))),
      map((document: UserDocument) => {
        let user: User = {
          uuid: document.uuid,
          email: document.email,
          name: document.name,
          hash: document.hash,
          last_seen: document.last_seen,
          public_key: document.public_key,
          private_key: document.private_key,
          revocation_certificate: document.revocation_certificate
        };

        return user;
      }),
      takeUntil(this.unsubscribe$)
    );
  }

  bulkUpsertUsers(users: User[]): Observable<User[]> {
    return this.$.pipe(
      switchMap(db => from(db.users.bulkInsert(users.map((user: User) => user as UserDocument)))),
      switchMap(result => {
        if (!!result.error.length) {
          return concat(
            ...users
              .filter(u => result.error.find(e => e.id === u.uuid && e.status === 409))
              .map(u => from(this.$.pipe(switchMap(db => db.users.atomicUpsert(u as UserDocument)))))
          ).pipe(
            reduce((acc, cur) => [ ...acc, cur ], result.success)
          );
        }

        return of(result.success);
      }),
      map((documents: UserDocument[]) => {
        let users: User[] = documents.map((document: UserDocument) => {
          return {
            uuid: document.uuid,
            email: document.email,
            name: document.name,
            hash: document.hash,
            last_seen: document.last_seen,
            public_key: document.public_key,
            private_key: document.private_key,
            revocation_certificate: document.revocation_certificate
          } as User;
        });

        return users;
      }),
      takeUntil(this.unsubscribe$)
    );
  }

  getConferences(timestamp: number = Date.now() / 1000, limit: number = DatabaseService.BATCH_SIZE): Observable<Conference[]> {
    return this.$.pipe(
      switchMap(
        db => db.conferences.find({ updated: { $lt: timestamp } })
          .sort({ updated: -1 })
          .limit(limit)
          .$
      ),
      switchMap((documents: ConferenceDocument[]) => {
        if (documents.length === 0)
          return of([] as Conference[]);

        let participants$ = concat(...documents.map(d => from(d.populate('participant'))));

        return zip(from(documents), participants$).pipe(
          reduce((acc, [ document, participant ]) => {
            let conference: Conference = {
              uuid: document.uuid,
              updated: document.updated,
              count: document.count,
              unread: document.unread,
              participant: {
                uuid: participant.uuid,
                name: participant.name,
              }
            };

            return [ ...acc, conference ];
          }, [] as Conference[])
        );
      }),
      takeUntil(this.unsubscribe$)
    );
  }

  getOldConferences(timestamp: number = Date.now() / 1000, limit: number = DatabaseService.BATCH_SIZE): Observable<Conference[]> {
    return this.$.pipe(
      switchMap(
        db => db.conferences.find({ updated: { $lt: timestamp } })
          .sort({ updated: -1 })
          .limit(limit)
          .$
      ),
      switchMap((documents: ConferenceDocument[]) => {
        if (documents.length === 0)
          return of([] as Conference[]);

        let participants$ = concat(...documents.map(d => from(d.populate('participant'))));

        return zip(from(documents), participants$).pipe(
          reduce((acc, [ document, participant ]) => {
            let conference: Conference = {
              uuid: document.uuid,
              updated: document.updated,
              count: document.count,
              unread: document.unread,
              participant: {
                uuid: participant.uuid,
                name: participant.name,
              }
            };

            return [ ...acc, conference ];
          }, [] as Conference[])
        );
      }),
      takeUntil(this.unsubscribe$)
    );
  }

  getConference(uuid: string): Observable<Conference|null> {
    return this.$.pipe(
      switchMap(db => db.conferences.findOne().where('uuid').eq(uuid).$),
      switchMap((document: ConferenceDocument|null) => {
        if (!document)
          return of(null);

        let participant$ = from(document.populate('participant'));

        return zip(of(document), participant$).pipe(
          map(([ document, participant ]) => {
            let conference: Conference = {
              uuid: document.uuid,
              updated: document.updated,
              count: document.count,
              unread: document.unread,
              participant: {
                uuid: participant.uuid,
                name: participant.name,
              }
            };

            return conference;
          })
        );
      }),
      takeUntil(this.unsubscribe$)
    );
  }

  getConferenceByParticipant(uuid: string): Observable<Conference|null> {
    return this.$.pipe(
      switchMap(db => db.conferences.findOne().where('participant').eq(uuid).$),
      switchMap((document: ConferenceDocument|null) => {
        if (!document)
          return of(null);

        let participant$ = from(document.populate('participant'));

        return zip(of(document), participant$).pipe(
          map(([ document, participant ]) => {
            let conference: Conference = {
              uuid: document.uuid,
              updated: document.updated,
              count: document.count,
              unread: document.unread,
              participant: {
                uuid: participant.uuid,
                name: participant.name,
              }
            };

            return conference;
          })
        );
      }),
      takeUntil(this.unsubscribe$)
    );
  }

  upsertConference(conference: Conference): Observable<Conference> {
    return this.$.pipe(
      delayWhen(db => {
        if (conference.participant && this.authService.user.uuid !== conference.participant.uuid)
          return from(db.users.atomicUpsert(conference.participant));

        return of(db)
      }),
      switchMap(db => {
        let document = {
          uuid: conference.uuid,
          updated: +conference.updated,
          count: conference.count,
          unread: conference.unread,
        } as ConferenceDocument;

        if ('participant' in conference)
          document.participant = conference.participant.uuid;

        return from(db.conferences.atomicUpsert(document));
      }),
      switchMap((document: ConferenceDocument) => {
        let participant$ = from(document.populate('participant'));

        return zip(of(document), participant$).pipe(
          map(([ document, participant ]) => {
            let conference: Conference = {
              uuid: document.uuid,
              updated: document.updated,
              count: document.count,
              unread: document.unread,
              participant: {
                uuid: participant.uuid,
                name: participant.name,
              }
            };

            return conference;
          })
        );
      }),
      takeUntil(this.unsubscribe$)
    );
  }

  bulkUpsertConferences(conferences: Conference[]): Observable<Conference[]> {
    return this.$.pipe(
      delayWhen(db => {
        let users: UserDocument[] = conferences
          .filter(c => c.participant && this.authService.user.uuid !== c.participant.uuid)
          .map(c => c.participant as UserDocument);

          return from(db.users.bulkInsert(users)).pipe(
            switchMap(result => {
              if (!result.error.length) {
                /*
                return concat(
                  ...users
                    .filter(u => result.error.find(e => e.id === u.uuid && e.status === 409))
                    .map(u => from(this.$.pipe(switchMap(db => db.users.atomicUpsert(u as UserDocument)))))
                ).pipe(
                  reduce((acc, cur) => [ ...acc, cur ], result.success)
                );
                */
              }

              return of(result.success);
            })
          ); 
      }),
      switchMap(db => {
        let documents: ConferenceDocument[] = conferences.map(c => {
          let document = {
            uuid: c.uuid,
            updated: +c.updated,
            count: c.count,
            unread: c.unread,
            participant: c.participant ? c.participant.uuid : undefined
          } as ConferenceDocument;

          if ('participant' in c)
            document.participant = c.participant.uuid;

          return document;
        });

        return from(db.conferences.bulkInsert(documents)).pipe(
          switchMap(result => {
            if (!!result.error.length)
              return concat(
                ...documents
                  .filter(d => result.error.find(e => e.id === d.uuid && e.status === 409))
                  .map(d => from(this.$.pipe(switchMap(db => db.conferences.atomicUpsert(d)))))
              ).pipe(
                reduce((acc, cur) => [ ...acc, cur ], result.success)
              );

            return of(result.success);
          }),
        );
      }),
      switchMap((documents: ConferenceDocument[]) => {
        let participants$ = concat(...documents.map(d => d.populate('participant')));

        return zip(from(documents), participants$).pipe(
          reduce((acc, [ document, participant ]) => {
            let conference: Conference = {
              uuid: document.uuid,
              updated: document.updated,
              count: document.count,
              unread: document.unread,
              participant: {
                uuid: participant.uuid,
                name: participant.name
              }
            };

            return [ ...acc, conference ];
          }, [] as Conference[])
        )
      }),
      map((conferences: Conference[]) => conferences.sort((a: Conference, b: Conference) => b.updated - a.updated)),
      takeUntil(this.unsubscribe$)
    );
  }

  getMessages(timestamp: number = Date.now() / 1000, limit: number = DatabaseService.BATCH_SIZE): Observable<Message[]> {
    return this.$.pipe(
      switchMap(
        db => db.messages.find({ date: { $lt: timestamp } })
          .sort({ date: -1 })
          .limit(limit)
          .$
      ),
      switchMap((documents: MessageDocument[]) => {
        if (documents.length === 0)
          return of([] as Message[]);

        let conferences$ = zip(...documents.map(d => from(d.populate('conference'))));
        let authors$ = zip(...documents.map(d => from(d.populate('author'))));

        return zip(of(documents), conferences$, authors$).pipe(
          switchMap(([ documents, conferences, authors ]) => {
            let participants$ = concat(...conferences.map((d: ConferenceDocument) => from(d.populate('participant'))));

            return zip(from(documents), from(conferences), from(authors), participants$).pipe(
              reduce((acc, [ document, conference, author, participant ]) => {
                let message: Message = {
                  uuid: document.uuid,
                  conference: {
                    uuid: conference.uuid,
                    updated: conference.updated,
                    count: conference.count,
                    unread: conference.unread,
                    participant: {
                      uuid: participant.uuid,
                      name: participant.name
                    }
                  },
                  author: {
                    uuid: author.uuid,
                    name: author.name,
                  },
                  readed: document.readed,
                  readedAt: document.readedAt,
                  type: document.type,
                  date: document.date,
                  content: document.content,
                  consumed: document.consumed,
                  edited: document.edited
                };

                return [ ...acc, message ];
              }, [] as Message[])
            );
          })
        );
      }),
      map((messages: Message[]) => messages.sort((a: Message, b: Message) => a.date - b.date)),
      takeUntil(this.unsubscribe$)
    );
  }

  getUnreadMessages(timestamp: number = 0, limit: number = DatabaseService.BATCH_SIZE): Observable<Message[]> {
    return this.$.pipe(
      switchMap(
        db => db.messages.find({
          $and: [
            { readed: { $eq: false } },
            { date: { $gt: timestamp } }
          ]
        })
        .sort({ date: 1 })
        .limit(limit)
        .$
      ),
      switchMap((documents: MessageDocument[]) => {
        if (documents.length === 0)
          return of([] as Message[]);

        let conferences$ = zip(...documents.map(d => from(d.populate('conference'))));
        let authors$ = zip(...documents.map(d => from(d.populate('author'))));

        return zip(of(documents), conferences$, authors$).pipe(
          switchMap(([ documents, conferences, authors ]) => {
            let participants$ = concat(...conferences.map((d: ConferenceDocument) => from(d.populate('participant'))));

            return zip(from(documents), from(conferences), from(authors), participants$).pipe(
              reduce((acc, [ document, conference, author, participant ]) => {
                let message: Message = {
                  uuid: document.uuid,
                  conference: {
                    uuid: conference.uuid,
                    updated: conference.updated,
                    count: conference.count,
                    unread: conference.unread,
                    participant: {
                      uuid: participant.uuid,
                      name: participant.name
                    }
                  },
                  author: {
                    uuid: author.uuid,
                    name: author.name,
                  },
                  readed: document.readed,
                  readedAt: document.readedAt,
                  type: document.type,
                  date: document.date,
                  content: document.content,
                  consumed: document.consumed,
                  edited: document.edited
                };

                return [ ...acc, message ];
              }, [] as Message[])
            );
          })
        );
      }),
      map((messages: Message[]) => messages.sort((a: Message, b: Message) => a.date - b.date)),
      takeUntil(this.unsubscribe$)
    );
  }

  getMessagesByParticipant(uuid: string, timestamp: number = Date.now() / 1000, limit: number = DatabaseService.BATCH_SIZE): Observable<Message[]> {
    return this.$.pipe(
      switchMap(db => db.conferences.findOne().where('participant').eq(uuid).$),
      switchMap((document: ConferenceDocument|null) => {
        if (!document)
          return throwError(new Error('Conference with that participant does not exist'));

        return this.$.pipe(
          switchMap(
            db => db.messages.find({ $and: [
              { conference: { $eq: document.uuid } },
              { date: { $lt: timestamp  } }
             ]})
            .sort({ date: -1 })
            .limit(limit)
            .$
          )
        )
      }),
      switchMap((documents: MessageDocument[]) => {
        if (documents.length === 0)
          return of([] as Message[]);

        let conferences$ = zip(...documents.map(d => from(d.populate('conference'))));
        let authors$ = zip(...documents.map(d => from(d.populate('author'))));

        return zip(of(documents), conferences$, authors$).pipe(
          switchMap(([ documents, conferences, authors ]) => {
            let participants$ = concat(...conferences.map((d: ConferenceDocument) => from(d.populate('participant'))));

            return zip(from(documents), from(conferences), from(authors), participants$).pipe(
              reduce((acc, [ document, conference, author, participant ]) => {
                let message: Message = {
                  uuid: document.uuid,
                  conference: {
                    uuid: conference.uuid,
                    updated: conference.updated,
                    count: conference.count,
                    unread: conference.unread,
                    participant: {
                      uuid: participant.uuid,
                      name: participant.name
                    }
                  },
                  author: {
                    uuid: author.uuid,
                    name: author.name,
                  },
                  readed: document.readed,
                  readedAt: document.readedAt,
                  type: document.type,
                  date: document.date,
                  content: document.content,
                  consumed: document.consumed,
                  edited: document.edited
                };

                return [ ...acc, message ];
              }, [] as Message[])
            );
          })
        );
      }),
      map((messages: Message[]) => messages.sort((a: Message, b: Message) => a.date - b.date)),
      takeUntil(this.unsubscribe$)
    );
  }

  getUnreadMessagesByParticipant(uuid: string, timestamp: number = 0, limit: number = DatabaseService.BATCH_SIZE): Observable<Message[]> {
    return this.$.pipe(
      switchMap(db => from(db.conferences.findOne().where('participant').eq(uuid).exec())),
      switchMap((document: ConferenceDocument|null) => {
        if (!document)
          return throwError(new Error('Conference with that participant does not exist'));

        return this.$.pipe(
          switchMap(
            db => db.messages.find({ $and: [
              { conference: { $eq: document.uuid } },
              { readed: { $eq: false } },
              { date: { $gt: timestamp  } }
             ]})
            .sort({ date: 1 })
            .limit(limit)
            .$
          )
        )
      }),
      switchMap((documents: MessageDocument[]) => {
        if (documents.length === 0)
          return of([] as Message[]);

        let conferences$ = zip(...documents.map(d => from(d.populate('conference'))));
        let authors$ = zip(...documents.map(d => from(d.populate('author'))));

        return zip(of(documents), conferences$, authors$).pipe(
          switchMap(([ documents, conferences, authors ]) => {
            let participants$ = concat(...conferences.map((d: ConferenceDocument) => from(d.populate('participant'))));

            return zip(from(documents), from(conferences), from(authors), participants$).pipe(
              reduce((acc, [ document, conference, author, participant ]) => {
                let message: Message = {
                  uuid: document.uuid,
                  conference: {
                    uuid: conference.uuid,
                    updated: conference.updated,
                    count: conference.count,
                    unread: conference.unread,
                    participant: {
                      uuid: participant.uuid,
                      name: participant.name
                    }
                  },
                  author: {
                    uuid: author.uuid,
                    name: author.name,
                  },
                  readed: document.readed,
                  readedAt: document.readedAt,
                  type: document.type,
                  date: document.date,
                  content: document.content,
                  consumed: document.consumed,
                  edited: document.edited
                };

                return [ ...acc, message ];
              }, [] as Message[])
            );
          })
        );
      }),
      map((messages: Message[]) => messages.sort((a: Message, b: Message) => a.date - b.date)),
      takeUntil(this.unsubscribe$)
    );
  }

  getOldMessagesByParticipant(uuid: string, timestamp: number = Date.now() / 1000, limit: number = DatabaseService.BATCH_SIZE): Observable<Message[]> {
    return this.$.pipe(
      switchMap(db => from(db.conferences.findOne().where('participant').eq(uuid).exec())),
      switchMap((document: ConferenceDocument|null) => {
        if (!document)
          return throwError(new Error('Conference with that participant does not exist'));

        return this.$.pipe(
          switchMap(
            db => db.messages.find({ $and: [{ conference: { $eq: document.uuid } }, { date: { $lt: timestamp } }] })
            .sort({ date: -1 })
            .limit(limit)
            .$
          )
        )
      }),
      switchMap((documents: MessageDocument[]) => {
        if (documents.length === 0)
          return of([] as Message[]);

        let conferences$ = zip(...documents.map(d => from(d.populate('conference'))));
        let authors$ = zip(...documents.map(d => from(d.populate('author'))));

        return zip(of(documents), conferences$, authors$).pipe(
          switchMap(([ documents, conferences, authors ]) => {
            let participants$ = concat(...conferences.map((d: ConferenceDocument) => from(d.populate('participant'))));

            return zip(from(documents), from(conferences), from(authors), participants$).pipe(
              reduce((acc, [ document, conference, author, participant ]) => {
                let message: Message = {
                  uuid: document.uuid,
                  conference: {
                    uuid: conference.uuid,
                    updated: conference.updated,
                    count: conference.count,
                    unread: conference.unread,
                    participant: {
                      uuid: participant.uuid,
                      name: participant.name
                    }
                  },
                  author: {
                    uuid: author.uuid,
                    name: author.name,
                  },
                  readed: document.readed,
                  readedAt: document.readedAt,
                  type: document.type,
                  date: document.date,
                  content: document.content,
                  consumed: document.consumed,
                  edited: document.edited
                };

                return [ ...acc, message ];
              }, [] as Message[])
            );
          })
        );
      }),
      map((messages: Message[]) => messages.sort((a: Message, b: Message) => a.date - b.date)),
      takeUntil(this.unsubscribe$)
    );
  }

  getNewMessagesByParticipant(uuid: string, timestamp: number = 0, limit: number = DatabaseService.BATCH_SIZE): Observable<Message[]> {
    return this.$.pipe(
      switchMap(db => from(db.conferences.findOne().where('participant').eq(uuid).exec())),
      switchMap((document: ConferenceDocument|null) => {
        if (!document)
          return throwError('Conference with that participant does not exist');

        return this.$.pipe(
          switchMap(
            db => db.messages.find({ $and: [{ conference: { $eq: document.uuid } }, { date: { $gt: timestamp } }] })
            .sort({ date: 1 })
            .limit(limit)
            .$     
          )
        )
      }),
      switchMap((documents: MessageDocument[]) => {
        if (documents.length === 0)
          return of([] as Message[]);

        let conferences$ = zip(...documents.map(d => from(d.populate('conference'))));
        let authors$ = zip(...documents.map(d => from(d.populate('author'))));

        return zip(of(documents), conferences$, authors$).pipe(
          switchMap(([ documents, conferences, authors ]) => {
            let participants$ = concat(...conferences.map((d: ConferenceDocument) => from(d.populate('participant'))));

            return zip(from(documents), from(conferences), from(authors), participants$).pipe(
              reduce((acc, [ document, conference, author, participant ]) => {
                let message: Message = {
                  uuid: document.uuid,
                  conference: {
                    uuid: conference.uuid,
                    updated: conference.updated,
                    count: conference.count,
                    unread: conference.unread,
                    participant: {
                      uuid: participant.uuid,
                      name: participant.name
                    }
                  },
                  author: {
                    uuid: author.uuid,
                    name: author.name,
                  },
                  readed: document.readed,
                  readedAt: document.readedAt,
                  type: document.type,
                  date: document.date,
                  content: document.content,
                  consumed: document.consumed,
                  edited: document.edited
                };

                return [ ...acc, message ];
              }, [] as Message[])
            );
          })
        );
      }),
      map((messages: Message[]) => messages.sort((a: Message, b: Message) => a.date - b.date)),
      takeUntil(this.unsubscribe$)
    );
  }

  getMessagesByConference(uuid: string, limit: number = DatabaseService.BATCH_SIZE): Observable<Message[]> {
    return this.$.pipe(
      switchMap(
        db => db.messages.find().where('conference').eq(uuid)
        .sort({ date: -1 })
        .limit(limit)
        .$
      ),
      switchMap((documents: MessageDocument[]) => {
        if (documents.length === 0)
          return of([] as Message[]);

        let conferences$ = zip(...documents.map(d => from(d.populate('conference'))));
        let authors$ = zip(...documents.map(d => from(d.populate('author'))));

        return zip(of(documents), conferences$, authors$).pipe(
          switchMap(([ documents, conferences, authors ]) => {
            let participants$ = concat(...conferences.map((d: ConferenceDocument) => from(d.populate('participant'))));

            return zip(from(documents), from(conferences), from(authors), participants$).pipe(
              reduce((acc, [ document, conference, author, participant ]) => {
                let message: Message = {
                  uuid: document.uuid,
                  conference: {
                    uuid: conference.uuid,
                    updated: conference.updated,
                    count: conference.count,
                    unread: conference.unread,
                    participant: {
                      uuid: participant.uuid,
                      name: participant.name
                    }
                  },
                  author: {
                    uuid: author.uuid,
                    name: author.name,
                  },
                  readed: document.readed,
                  readedAt: document.readedAt,
                  type: document.type,
                  date: document.date,
                  content: document.content,
                  consumed: document.consumed,
                  edited: document.edited
                };

                return [ ...acc, message ];
              }, [] as Message[])
            );
          })
        );
      }),
      map((messages: Message[]) => messages.sort((a: Message, b: Message) => a.date - b.date)),
      takeUntil(this.unsubscribe$)
    );
  }

  getUnreadMessagesByConference(uuid: string, timestamp: number = 0, limit: number = DatabaseService.BATCH_SIZE): Observable<Message[]> {
    return this.$.pipe(
      switchMap(
        db => from(
          db.messages.find({ $and: [
            { conference: { $eq: uuid } },
            { readed: { $eq: false } },
            { date: { $gt: timestamp } }
          ] })
          .sort({ date: 1 })
          .limit(limit)
          .$
        )
      ),
      switchMap((documents: MessageDocument[]) => {
        if (documents.length === 0)
          return of([] as Message[]);

        let conferences$ = zip(...documents.map(d => from(d.populate('conference'))));
        let authors$ = zip(...documents.map(d => from(d.populate('author'))));

        return zip(of(documents), conferences$, authors$).pipe(
          switchMap(([ documents, conferences, authors ]) => {
            let participants$ = concat(...conferences.map((d: ConferenceDocument) => from(d.populate('participant'))));

            return zip(from(documents), from(conferences), from(authors), participants$).pipe(
              reduce((acc, [ document, conference, author, participant ]) => {
                let message: Message = {
                  uuid: document.uuid,
                  conference: {
                    uuid: conference.uuid,
                    updated: conference.updated,
                    count: conference.count,
                    unread: conference.unread,
                    participant: {
                      uuid: participant.uuid,
                      name: participant.name
                    }
                  },
                  author: {
                    uuid: author.uuid,
                    name: author.name,
                  },
                  readed: document.readed,
                  readedAt: document.readedAt,
                  type: document.type,
                  date: document.date,
                  content: document.content,
                  consumed: document.consumed,
                  edited: document.edited
                };

                return [ ...acc, message ];
              }, [] as Message[])
            );
          })
        );
      }),
      map((messages: Message[]) => messages.sort((a: Message, b: Message) => a.date - b.date)),
      takeUntil(this.unsubscribe$)
    );
  }

  getOldMessagesByConference(uuid: string, timestamp: number = Date.now() / 1000, limit: number = DatabaseService.BATCH_SIZE): Observable<Message[]> {
    return this.$.pipe(
      switchMap(
        db => from(
          db.messages.find({ $and: [{ conference: { $eq: uuid } }, { date: { $lt: timestamp } }] })
          .sort({ date: -1 })
          .limit(limit)
          .$
        )
      ),
      switchMap((documents: MessageDocument[]) => {
        if (documents.length === 0)
          return of([] as Message[]);

        let conferences$ = zip(...documents.map(d => from(d.populate('conference'))));
        let authors$ = zip(...documents.map(d => from(d.populate('author'))));

        return zip(of(documents), conferences$, authors$).pipe(
          switchMap(([ documents, conferences, authors ]) => {
            let participants$ = concat(...conferences.map((d: ConferenceDocument) => from(d.populate('participant'))));

            return zip(from(documents), from(conferences), from(authors), participants$).pipe(
              reduce((acc, [ document, conference, author, participant ]) => {
                let message: Message = {
                  uuid: document.uuid,
                  conference: {
                    uuid: conference.uuid,
                    updated: conference.updated,
                    count: conference.count,
                    unread: conference.unread,
                    participant: {
                      uuid: participant.uuid,
                      name: participant.name
                    }
                  },
                  author: {
                    uuid: author.uuid,
                    name: author.name,
                  },
                  readed: document.readed,
                  readedAt: document.readedAt,
                  type: document.type,
                  date: document.date,
                  content: document.content,
                  consumed: document.consumed,
                  edited: document.edited
                };

                return [ ...acc, message ];
              }, [] as Message[])
            );
          })
        );
      }),
      map((messages: Message[]) => messages.sort((a: Message, b: Message) => a.date - b.date)),
      takeUntil(this.unsubscribe$)
    );
  }

  getNewMessagesByConference(uuid: string, timestamp: number = 0, limit: number = DatabaseService.BATCH_SIZE): Observable<Message[]> {
    return this.$.pipe(
      switchMap(
        db => db.messages.find({ $and: [{ conference: { $eq: uuid } }, { date: { $gt: timestamp } }] })
          .sort({ date: 1 })
          .limit(limit)
          .$
      ),
      switchMap((documents: MessageDocument[]) => {
        if (documents.length === 0)
          return of([] as Message[]);

        let conferences$ = zip(...documents.map(d => from(d.populate('conference'))));
        let authors$ = zip(...documents.map(d => from(d.populate('author'))));

        return zip(of(documents), conferences$, authors$).pipe(
          switchMap(([ documents, conferences, authors ]) => {
            let participants$ = concat(...conferences.map((d: ConferenceDocument) => from(d.populate('participant'))));

            return zip(from(documents), from(conferences), from(authors), participants$).pipe(
              reduce((acc, [ document, conference, author, participant ]) => {
                let message: Message = {
                  uuid: document.uuid,
                  conference: {
                    uuid: conference.uuid,
                    updated: conference.updated,
                    count: conference.count,
                    unread: conference.unread,
                    participant: {
                      uuid: participant.uuid,
                      name: participant.name
                    }
                  },
                  author: {
                    uuid: author.uuid,
                    name: author.name,
                  },
                  readed: document.readed,
                  readedAt: document.readedAt,
                  type: document.type,
                  date: document.date,
                  content: document.content,
                  consumed: document.consumed,
                  edited: document.edited
                };

                return [ ...acc, message ];
              }, [] as Message[])
            );
          })
        );
      }),
      map((messages: Message[]) => messages.sort((a: Message, b: Message) => a.date - b.date)),
      takeUntil(this.unsubscribe$)
    );
  }
  
  readMessage(message: Message): Observable<Message|null> {
    return this.$.pipe(
      switchMap(db => from(db.messages.findOne().where('uuid').eq(message.uuid).exec())),
      switchMap((document: MessageDocument) => {
        if (!document)
          return of(null);

        return from(document.atomicUpdate(oldData => {
          oldData.readed = message.readed,
          oldData.readedAt = message.readedAt

          return oldData;
        })).pipe(
          switchMap((document: MessageDocument) => {
            let conference$ = from(document.populate('conference'));
            let author$ = from(document.populate('author'));

            return zip(of(document), conference$, author$).pipe(
              switchMap(([ document, conference, author ]) => {
                let participant$ = from(conference.populate('participant'));

                return zip(of(document), of(conference), of(author), participant$ as Observable<User>);
              }),
              map(([document, conference, author, participant ]) => {
                let message: Message = {
                  uuid: document.uuid,
                  conference: {
                    uuid: conference.uuid,
                    updated: conference.updated,
                    count: conference.count,
                    unread: conference.unread,
                    participant: {
                      uuid: participant.uuid,
                      name: participant.name
                    }
                  },
                  author: {
                    uuid: author.uuid,
                    name: author.name
                  },
                  readed: document.readed,
                  readedAt: document.readedAt,
                  type: document.type,
                  date: document.date,
                  content: document.content,
                  consumed: document.consumed,
                  edited: document.edited
                };

                return message;
              })
            );
          })
        );
      }),
      takeUntil(this.unsubscribe$)
    );
  }

  upsertMessage(message: Message): Observable<Message> {
    return this.$.pipe(
      delayWhen(db => {
        if (this.authService.user.uuid !== message.author.uuid)
          return from(db.users.atomicUpsert(message.author));

        return of(db);
      }),
      delayWhen(db => {
        if ('participant' in message.conference) 
          return from(db.users.atomicUpsert(message.conference.participant));

        return of(db);
      }),
      delayWhen(db => {
        let document = {
          uuid: message.conference.uuid,
          updated: +message.conference.updated,
          count: message.conference.count,
          unread: message.conference.unread
        } as ConferenceDocument;

        if ('participant' in message.conference)
          document.participant = message.conference.participant.uuid;

        return from(db.conferences.atomicUpsert(document));
      }),
      switchMap(db => from(db.messages.atomicUpsert({
        ...message,
        author: message.author.uuid,
        conference: message.conference.uuid
      }))),
      switchMap((document: MessageDocument) => {
        let conference$ = from(document.populate('conference'));
        let author$ = from(document.populate('author'));

        return zip(of(document), conference$, author$).pipe(
          switchMap(([ document, conference, author ]) => {
            let participant$ = from(conference.populate('participant'));

            return zip(of(document), of(conference), of(author), participant$ as Observable<User>);
          }),
          map(([ document, conference, author, participant ]) => {
            let message: Message = {
              uuid: document.uuid,
              conference: {
                uuid: conference.uuid,
                updated: conference.updated,
                count: conference.count,
                unread: conference.unread,
                participant: {
                  uuid: participant.uuid,
                  name: participant.name
                }
              },
              author: {
                uuid: author.uuid,
                name: author.name
              },
              readed: document.readed,
              readedAt: document.readedAt,
              type: document.type,
              date: document.date,
              content: document.content,
              consumed: document.consumed,
              edited: document.edited
            };

            return message;
          })
        );
      }),
      takeUntil(this.unsubscribe$)
    );
  }

  bulkUpsertMessages(messages: Message[]): Observable<Message[]> {
    return this.$.pipe(
      delayWhen(db => {
        let documents: UserDocument[] = messages
          .filter(m => m.author.uuid !== this.authService.user.uuid)
          .map(m => m.author as UserDocument);

        return from(db.users.bulkInsert(documents)).pipe(
          switchMap(result => {
            if (!!result.error.length) {
              /*
              return concat(
                ...documents
                  .filter(d => result.error.find(e => e.id === d.uuid && e.status === 409))
                  .map(d => from(this.$.pipe(switchMap(db => db.users.atomicUpsert(d)))))
              ).pipe(
                reduce((acc, cur) => {
                  return [ cur, ...acc ];
                }, result.success)
              );
              */
            }

            return of(result.success);
          })
        );
      }),
      delayWhen(db => {
        let documents: UserDocument[] = messages
          .filter(m => m.conference.participant)
          .map(m => m.conference.participant as UserDocument);

        return from(db.users.bulkInsert(documents)).pipe(
          switchMap(result => {
            if (!!result.error.length) {
              /*
              return concat(
                ...documents
                  .filter(d => result.error.find(e => e.id === d.uuid && e.status === 409))
                  .map(d => from(this.$.pipe(switchMap(db => db.users.atomicUpsert(d)))))
              ).pipe(
                reduce((acc, cur) => {
                  return [ cur, ...acc ];
                }, result.success)
              );
              */
            }

            return of(result.success);
          })
        );
      }),
      delayWhen(db => {
        let documents: ConferenceDocument[] = messages.map(m => {
          let document = {
            uuid: m.conference.uuid,
            updated: +m.conference.updated,
            count: m.conference.count,
            unread: m.conference.unread,
          } as ConferenceDocument;
          
          if ('participant' in m.conference)
            document.participant = m.conference.participant.uuid;

          return document;
        });

        return from(db.conferences.bulkInsert(documents)).pipe(
          switchMap(result => {
            if (!!result.error.length) {
              /*
              return concat(
                ...documents
                  .filter(d => result.error.find(e => e.id === d.uuid && e.status === 409))
                  .map(d => from(this.$.pipe(switchMap(db => db.conferences.atomicUpsert(d)))))
              ).pipe(
                reduce((acc, cur) => {
                  return [ cur, ...acc ];
                }, result.success)
              );
              */
            }

            return of(result.success);
          })
        );
      }),
      switchMap(db => {
        let documents: MessageDocument[] = messages.map(m => { 
          return {
            ...m,
            author: m.author.uuid,
            conference: m.conference.uuid
          } as MessageDocument;
        });

        return from(db.messages.bulkInsert(documents)).pipe(
          switchMap(result => {
            if (!!result.error.length) {
              return concat(
                ...documents
                  .filter(d => result.error.find(e => e.id === d.uuid && e.status === 409))
                  .map(d => from(this.$.pipe(switchMap(db => db.messages.atomicUpsert(d)))))
              ).pipe(
                reduce((acc, cur) => {
                  return [ cur, ...acc ];
                }, result.success)
              );
            }

            return of(result.success);
          })
        );
      }),
      switchMap((documents: MessageDocument[]) => {
        let conferences$ = concat(...documents.map(d => from(d.populate('conference'))));
        let authors$ = concat(...documents.map(d => from(d.populate('author'))));

        return zip(from(documents), conferences$, authors$).pipe(
          concatMap(([ document, conference, author ]) => {
            let participant$ = from(conference.populate('participant'));

            return zip(
              of(document),
              of(conference),
              of(author),
              participant$ as Observable<User>
            );
          }),
          reduce((acc, [ document, conference, author, participant ]) => {
            let message: Message = {
              uuid: document.uuid,
              conference: {
                uuid: conference.uuid,
                updated: conference.updated,
                count: conference.count,
                unread: conference.unread,
                participant: {
                  uuid: participant.uuid,
                  name: participant.name
                }
              },
              author: {
                uuid: author.uuid,
                name: author.name
              },
              readed: document.readed,
              readedAt: document.readedAt,
              type: document.type,
              date: document.date,
              content: document.content,
              consumed: document.consumed,
              edited: document.edited
            };

            acc.push(message);

            return acc;
          }, [])
        )
      }),
      map((messages: Message[]) => messages.sort((a: Message, b: Message) => a.date - b.date)),
      takeUntil(this.unsubscribe$)
    ); 
  }

  ngOnDestroy() {
    this.$.pipe(switchMap(db => from(db.remove()))).subscribe();

    this.unsubscribe$.next();
    this.unsubscribe$.complete();

    this.isSynchronized$.complete();
  }
}
