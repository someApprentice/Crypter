import { environment } from '../../../environments/environment';

import { Injectable, OnDestroy } from '@angular/core';

import { Observable, from, of, zip } from 'rxjs';
import { delayWhen, shareReplay, switchMap, map, filter } from 'rxjs/operators';

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

import { User } from '../../models/user.model';
import { Conference } from '../../models/conference.model';
import { Message } from '../../models/message.model';

type Collections = {
  users: UserCollection,
  conferences: ConferencesCollection,
  messages: MessagesCollection
};

@Injectable()
export class DatabaseService implements OnDestroy {
  static readonly BATCH_SIZE = 20;

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

  public user$: Observable<User>;

  getUser(uuid: string): Observable<User> {
    return this.$.pipe(
      switchMap(db => db.users.findOne().where('uuid').eq(uuid).$),
      filter(document => !!document),
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
      })
    );
  }

  getConferences(): Observable<Conference[]> {
    // https://rxdb.info/rx-collection.html#get-a-collection-from-the-database
    // https://rxdb.info/rx-query.html#observe-
    // get db object, translate it to the ConferenceCollection and then into a query,
    // then transfrom every ConferenceDocument into Conference instance
    return this.$.pipe(
      switchMap(db => db.conferences.find().sort({ updated: -1 }).$),
      switchMap((documents: ConferenceDocument[]) => {
        if (documents.length === 0) {
          return of([] as Conference[]);
        }

        let participants$ = zip(...documents.map(d => from(d.populate('participant'))));

        return zip(of(documents), participants$).pipe(
          map(([ documents, participants ]) => {
            let conferences: Conference[] = documents.map((document, key) => {
              let conference: Conference = {
                uuid: document.uuid,
                updated: document.updated,
                count: document.count,
                unread: document.unread,
                participant: {
                  uuid: participants[key].uuid,
                  name: participants[key].name,
                }
              }

              return conference;
            });

            return conferences;
          })
        );
      })
    );
  }

  getConference(uuid: string): Observable<Conference> {
    return this.$.pipe(
      switchMap(db => db.conferences.findOne().where('uuid').eq(uuid).$),
      filter(document => !!document),
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
      })
    );
  }

  getConferenceByParticipant(uuid: string): Observable<Conference> {
    return this.$.pipe(
      switchMap(db => db.conferences.findOne().where('participant').eq(uuid).$),
      filter(document => !!document),
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
      })
    );
  }

  upsertConference(conference: Conference): Observable<Conference> {
    let document: ConferenceDocType = {
      uuid: conference.uuid,
      updated: conference.updated,
      count: conference.count,
      unread: conference.unread,
      participant: conference.participant.uuid
    };

    return this.$.pipe(
      switchMap(db => from(db.conferences.atomicUpsert(document))),
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
      })
    );
  }

  getMessages(): Observable<Message[]> {
    // https://rxdb.info/rx-collection.html#get-a-collection-from-the-database
    // https://rxdb.info/rx-query.html#observe-
    // get db object, translate it to the MessagesCollection and then into a query
    // then transfrom every MessageDocument into Message instance
    return this.$.pipe(
      switchMap(db => db.messages.find().sort({ date: -1 }).$),
      switchMap((documents: MessageDocument[]) => {
        if (documents.length === 0) {
          return of([] as Message[]);
        }

        let conferences$ = zip(...documents.map(d => from(d.populate('conference'))));
        let authors$ = zip(...documents.map(d => from(d.populate('author'))));

        return zip(of(documents), conferences$, authors$).pipe(
          switchMap(([ documents, conferences, authors ]) => {
            let participants$ = zip(...conferences.map((d: ConferenceDocument) => from(d.populate('participant'))));

            return zip(of(documents), of(conferences), of(authors), participants$ as Observable<UserDocument[]>); 
          }),
          map(([ documents, conferences, authors, participants ]) => {
            conferences = conferences.map((document: ConferenceDocument, key: number) => {
              let conference: Conference = {
                uuid: document.uuid,
                updated: document.updated,
                count: document.count,
                unread: document.unread,
                participant: {
                  uuid: participants[key].uuid,
                  name: participants[key].name,
                }
              };

              return conference;
            });

            let messages: Message[] = documents.map((document, key) => {
              let message: Message = {
                uuid: document.uuid,
                conference: conferences[key],
                author: {
                  uuid: authors[key].uuid,
                  name: authors[key].name,
                },
                readed: document.readed,
                readedAt: document.readedAt,
                type: document.type,
                date: document.date,
                content: document.content,
                consumed: document.consumed,
                edited: document.edited
              }

              return message;
            });

            return messages;
          })
        );
      })
    );
  }

  getMessagesByParticipant(uuid: string, limit: number = DatabaseService.BATCH_SIZE): Observable<Message[]> {
    return this.$.pipe(
      switchMap(db => db.conferences.findOne().where('participant').eq(uuid).$),
      filter(document => !!document),
      switchMap((document: ConferenceDocument) => {
        return this.$.pipe(
          switchMap(
            db => db.messages.find({ 'conference': document.uuid })
            .sort({ date: -1 })
            .limit(limit)
            .$
          )
        )
      }),
      switchMap((documents: MessageDocument[]) => {
        if (documents.length === 0) {
          return of([] as Message[]);
        }

        let conferences$ = zip(...documents.map(d => from(d.populate('conference'))));
        let authors$ = zip(...documents.map(d => from(d.populate('author'))));

        return zip(of(documents), conferences$, authors$).pipe(
          switchMap(([ documents, conferences, authors ]) => {
            let participants$ = zip(...conferences.map((d: ConferenceDocument) => from(d.populate('participant'))));

            return zip(of(documents), of(conferences), of(authors), participants$ as Observable<UserDocument[]>); 
          }),
          map(([ documents, conferences, authors, participants ]) => {
            conferences = conferences.map((document: ConferenceDocument, key: number) => {
              let conference: Conference = {
                uuid: document.uuid,
                updated: document.updated,
                count: document.count,
                unread: document.unread,
                participant: {
                  uuid: participants[key].uuid,
                  name: participants[key].name,
                  public_key: participants[key].public_key
                }
              };

              return conference;
            });

            let messages: Message[] = documents.map((document, key) => {
              let message: Message = {
                uuid: document.uuid,
                conference: conferences[key],
                author: {
                  uuid: authors[key].uuid,
                  name: authors[key].name,
                  public_key: authors[key].public_key
                },
                readed: document.readed,
                readedAt: document.readedAt,
                type: document.type,
                date: document.date,
                content: document.content,
                consumed: document.consumed,
                edited: document.edited
              }

              return message;
            });

            return messages;
          })
        );
      })
    );
  }


  getOldMessagesByParticipant(uuid: string, timestamp: number, limit: number = DatabaseService.BATCH_SIZE): Observable<Message[]> {
    return this.$.pipe(
      switchMap(db => from(db.conferences.findOne().where('participant').eq(uuid).exec())),
      filter(document => !!document),
      switchMap((document: ConferenceDocument) => {
        return this.$.pipe(
          switchMap(
            db => db.messages.find({ $and: [{ 'conference': { $eq: document.uuid } }, { date: { $lt: timestamp } }] })
            .sort({ date: -1 })
            .limit(limit)
            .$
          )
        )
      }),
      switchMap((documents: MessageDocument[]) => {
        if (documents.length === 0) {
          return of([] as Message[]);
        }

        let conferences$ = zip(...documents.map(d => from(d.populate('conference'))));
        let authors$ = zip(...documents.map(d => from(d.populate('author'))));

        return zip(of(documents), conferences$, authors$).pipe(
          switchMap(([ documents, conferences, authors ]) => {
            let participants$ = zip(...conferences.map((d: ConferenceDocument) => from(d.populate('participant'))));

            return zip(of(documents), of(conferences), of(authors), participants$ as Observable<UserDocument[]>); 
          }),
          map(([ documents, conferences, authors, participants ]) => {
            conferences = conferences.map((document: ConferenceDocument, key: number) => {
              let conference: Conference = {
                uuid: document.uuid,
                updated: document.updated,
                count: document.count,
                unread: document.unread,
                participant: {
                  uuid: participants[key].uuid,
                  name: participants[key].name,
                  public_key: participants[key].public_key
                }
              };

              return conference;
            });

            let messages: Message[] = documents.map((document, key) => {
              let message: Message = {
                uuid: document.uuid,
                conference: conferences[key],
                author: {
                  uuid: authors[key].uuid,
                  name: authors[key].name,
                  public_key: authors[key].public_key
                },
                readed: document.readed,
                readedAt: document.readedAt,
                type: document.type,
                date: document.date,
                content: document.content,
                consumed: document.consumed,
                edited: document.edited
              }

              return message;
            });

            return messages;
          })
        );
      })
    );
  }

  getNewMessagesByParticipant(uuid: string, timestamp: number, limit: number = DatabaseService.BATCH_SIZE): Observable<Message[]> {
    return this.$.pipe(
      switchMap(db => from(db.conferences.findOne().where('participant').eq(uuid).exec())),
      filter(document => !!document),
      switchMap((document: ConferenceDocument) => {
        return this.$.pipe(
          switchMap(
            db => db.messages.find({ $and: [{ 'conference': { $eq: document.uuid } }, { date: { $gt: timestamp } }] })
            .sort({ date: 1 })
            .limit(limit)
            .$     
          )
        )
      }),
      switchMap((documents: MessageDocument[]) => {
        if (documents.length === 0) {
          return of([] as Message[]);
        }

        let conferences$ = zip(...documents.map(d => from(d.populate('conference'))));
        let authors$ = zip(...documents.map(d => from(d.populate('author'))));

        return zip(of(documents), conferences$, authors$).pipe(
          switchMap(([ documents, conferences, authors ]) => {
            let participants$ = zip(...conferences.map((d: ConferenceDocument) => from(d.populate('participant'))));

            return zip(of(documents), of(conferences), of(authors), participants$ as Observable<UserDocument[]>); 
          }),
          map(([ documents, conferences, authors, participants ]) => {
            conferences = conferences.map((document: ConferenceDocument, key: number) => {
              let conference: Conference = {
                uuid: document.uuid,
                updated: document.updated,
                count: document.count,
                unread: document.unread,
                participant: {
                  uuid: participants[key].uuid,
                  name: participants[key].name,
                  public_key: participants[key].public_key
                }
              };

              return conference;
            });

            let messages: Message[] = documents.map((document, key) => {
              let message: Message = {
                uuid: document.uuid,
                conference: conferences[key],
                author: {
                  uuid: authors[key].uuid,
                  name: authors[key].name,
                  public_key: authors[key].public_key
                },
                readed: document.readed,
                readedAt: document.readedAt,
                type: document.type,
                date: document.date,
                content: document.content,
                consumed: document.consumed,
                edited: document.edited
              }

              return message;
            });

            return messages;
          })
        );
      })
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
        if (documents.length === 0) {
          return of([] as Message[]);
        }

        let conferences$ = zip(...documents.map(d => from(d.populate('conference'))));
        let authors$ = zip(...documents.map(d => from(d.populate('author'))));

        return zip(of(documents), conferences$, authors$).pipe(
          switchMap(([ documents, conferences, authors ]) => {
            let participants$ = zip(...conferences.map((d: ConferenceDocument) => from(d.populate('participant'))));

            return zip(of(documents), of(conferences), of(authors), participants$ as Observable<UserDocument[]>); 
          }),
          map(([ documents, conferences, authors, participants ]) => {
            conferences = conferences.map((document: ConferenceDocument, key: number) => {
              let conference: Conference = {
                uuid: document.uuid,
                updated: document.updated,
                count: document.count,
                unread: document.unread,
                participant: {
                  uuid: participants[key].uuid,
                  name: participants[key].name,
                  public_key: participants[key].public_key
                }
              };

              return conference;
            });

            let messages: Message[] = documents.map((document, key) => {
              let message: Message = {
                uuid: document.uuid,
                conference: conferences[key],
                author: {
                  uuid: authors[key].uuid,
                  name: authors[key].name,
                  public_key: authors[key].public_key
                },
                readed: document.readed,
                readedAt: document.readedAt,
                type: document.type,
                date: document.date,
                content: document.content,
                consumed: document.consumed,
                edited: document.edited
              }

              return message;
            });

            return messages;
          })
        );
      })
    );
  }

  getOldMessagesByConference(uuid: string, timestamp: number, limit: number = DatabaseService.BATCH_SIZE): Observable<Message[]> {
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
        if (documents.length === 0) {
          return of([] as Message[]);
        }

        let conferences$ = zip(...documents.map(d => from(d.populate('conference'))));
        let authors$ = zip(...documents.map(d => from(d.populate('author'))));

        return zip(of(documents), conferences$, authors$).pipe(
          switchMap(([ documents, conferences, authors ]) => {
            let participants$ = zip(...conferences.map((d: ConferenceDocument) => from(d.populate('participant'))));

            return zip(of(documents), of(conferences), of(authors), participants$ as Observable<UserDocument[]>); 
          }),
          map(([ documents, conferences, authors, participants ]) => {
            conferences = conferences.map((document: ConferenceDocument, key: number) => {
              let conference: Conference = {
                uuid: document.uuid,
                updated: document.updated,
                count: document.count,
                unread: document.unread,
                participant: {
                  uuid: participants[key].uuid,
                  name: participants[key].name,
                  public_key: participants[key].public_key
                }
              };

              return conference;
            });

            let messages: Message[] = documents.map((document, key) => {
              let message: Message = {
                uuid: document.uuid,
                conference: conferences[key],
                author: {
                  uuid: authors[key].uuid,
                  name: authors[key].name,
                  public_key: authors[key].public_key
                },
                readed: document.readed,
                readedAt: document.readedAt,
                type: document.type,
                date: document.date,
                content: document.content,
                consumed: document.consumed,
                edited: document.edited
              }

              return message;
            });

            return messages;
          })
        );
      })
    );
  }

  getNewMessagesByConference(uuid: string, timestamp: number, limit: number = DatabaseService.BATCH_SIZE): Observable<Message[]> {
    return this.$.pipe(
      switchMap(
        db => db.messages.find({ $and: [{ conference: { $eq: uuid } }, { date: { $gt: timestamp } }] })
          .sort({ date: 1 })
          .limit(limit)
          .$
      ),
      switchMap((documents: MessageDocument[]) => {
        if (documents.length === 0) {
          return of([] as Message[]);
        }

        let conferences$ = zip(...documents.map(d => from(d.populate('conference'))));
        let authors$ = zip(...documents.map(d => from(d.populate('author'))));

        return zip(of(documents), conferences$, authors$).pipe(
          switchMap(([ documents, conferences, authors ]) => {
            let participants$ = zip(...conferences.map((d: ConferenceDocument) => from(d.populate('participant'))));

            return zip(of(documents), of(conferences), of(authors), participants$ as Observable<UserDocument[]>); 
          }),
          map(([ documents, conferences, authors, participants ]) => {
            conferences = conferences.map((document: ConferenceDocument, key: number) => {
              let conference: Conference = {
                uuid: document.uuid,
                updated: document.updated,
                count: document.count,
                unread: document.unread,
                participant: {
                  uuid: participants[key].uuid,
                  name: participants[key].name,
                  public_key: participants[key].public_key
                }
              };

              return conference;
            });

            let messages: Message[] = documents.map((document, key) => {
              let message: Message = {
                uuid: document.uuid,
                conference: conferences[key],
                author: {
                  uuid: authors[key].uuid,
                  name: authors[key].name,
                  public_key: authors[key].public_key
                },
                readed: document.readed,
                readedAt: document.readedAt,
                type: document.type,
                date: document.date,
                content: document.content,
                consumed: document.consumed,
                edited: document.edited
              }

              return message;
            });

            return messages;
          })
        );
      })
    );
  }

  upsertMessage(message: Message): Observable<Message> {
    let document: MessageDocType = {
      uuid: message.uuid,
      conference: message.conference.uuid,
      author: message.author.uuid,
      readed: message.readed,
      readedAt: message.readedAt,
      type: message.type,
      date: message.date,
      content: message.content,
      consumed: message.consumed,
      edited: message.edited
    };

    return this.$.pipe(
      switchMap(db => from(db.messages.atomicUpsert(document))),
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
  }

  ngOnDestroy() {
    this.$.pipe(switchMap(db => from(db.remove()))).subscribe();
  }
}
