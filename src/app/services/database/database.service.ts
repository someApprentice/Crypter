import { environment } from '../../../environments/environment';

import { Injectable, OnDestroy } from '@angular/core';

import { Observable, from, zip } from 'rxjs';
import { delayWhen, shareReplay, switchMap, map, filter } from 'rxjs/operators';

import RxDB, { RxDatabase, RxCollection, RxDocument } from 'rxdb';

import * as PouchdbAdapterIdb from 'pouchdb-adapter-idb';

RxDB.plugin(PouchdbAdapterIdb);

import { ConferenceDocument } from './documents/conference.document';
import { MessageDocument } from './documents/message.document';

import { ConferencesCollection } from './collections/conference.collection';
import { MessagesCollection } from './collections/messages.collection';

import conferenceSchema from './schemas/conferences.schema';
import messagesSchema from './schemas/messages.schema';

import { Conference } from '../../models/Conference';
import { Message } from '../../models/Message';

type Collections = {
  conferences: ConferencesCollection,
  messages: MessagesCollection
};

@Injectable()
export class DatabaseService implements OnDestroy {
  // const
  static readonly BATCH_SIZE = 20;

  public $ = from(
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
          name: 'conferences',
          schema: conferenceSchema
        }),
        db.collection({
          name: 'messages',
          schema: messagesSchema
        })
      )
    ),
    shareReplay(1)
  );

  getConferences(): Observable<Conference[]> {
    // https://rxdb.info/rx-collection.html#get-a-collection-from-the-database
    // https://rxdb.info/rx-query.html#observe-
    // get db object, translate it to the ConferenceCollection and then into a query,
    // then transfrom every ConferenceDocument into Conference instance
    return this.$.pipe(
      switchMap(db => db.conferences.find().sort({ updated: -1 }).$),
      map((documents: ConferenceDocument[]) => {
        let conferences: Conference[] = [];

        for (let document of documents) {
          let conference: Conference = {
            uuid: document.uuid,
            updated: document.updated,
            count: document.count,
            unread: document.unread,
            participant: document.participant
          }

          conferences.push(conference);
        }

        return conferences;
      })
    );
  }

  getConference(uuid: string): Observable<Conference> {
    return this.$.pipe(
      switchMap(db => db.conferences.findOne().where('uuid').eq(uuid).$),
      filter(document => !!document),
      map((document: ConferenceDocument) => {
        let conference: Conference = {
          uuid: document.uuid,
          updated: document.updated,
          count: document.count,
          unread: document.unread,
          participant: document.participant
        };

        return conference;
      })
    );
  }

  upsertConference(conference: Conference): Observable<ConferenceDocument> {
    return this.$.pipe(switchMap(db => from(db.conferences.atomicUpsert(conference))));
  }

  getMessages(): Observable<Message[]> {
    // https://rxdb.info/rx-collection.html#get-a-collection-from-the-database
    // https://rxdb.info/rx-query.html#observe-
    // get db object, translate it to the MessagesCollection and then into a query
    // then transfrom every MessageDocument into Message instance
    return this.$.pipe(
      switchMap(db => db.messages.find().sort({ date: -1 }).$),
      map((documents: MessageDocument[]) => {
        let messages: Message[] = [];

        for (let document of documents) {
          let message: Message = {
            uuid: document.uuid,
            author: {
              uuid: document.author.uuid,
              name: document.author.name
            },
            conference: document.conference,
            readed: document.readed,
            readedAt: document.readedAt,
            type: document.type,
            date: document.date,
            content: document.content,
            consumed: document.consumed,
            edited: document.edited
          };

          messages.push(message);
        }

        return messages;
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
      map((documents: MessageDocument[]) => {
        let messages: Message[] = [];

        for (let document of documents) {
          let message: Message = {
            uuid: document.uuid,
            author: {
              uuid: document.author.uuid,
              name: document.author.name
            },
            conference: document.conference,
            readed: document.readed,
            readedAt: document.readedAt,
            type: document.type,
            date: document.date,
            content: document.content,
            consumed: document.consumed,
            edited: document.edited
          };

          messages.push(message);
        }

        return messages;
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
      map((documents: MessageDocument[]) => {
        let messages: Message[] = [];

        for (let document of documents) {
          let message: Message = {
            uuid: document.uuid,
            author: {
              uuid: document.author.uuid,
              name: document.author.name
            },
            conference: document.conference,
            readed: document.readed,
            readedAt: document.readedAt,
            type: document.type,
            date: document.date,
            content: document.content,
            consumed: document.consumed,
            edited: document.edited
          };

          messages.push(message);
        }

        return messages;
      })
    );
  }

  getNewMessagesByConference(uuid: string, timestamp: number, limit: number = DatabaseService.BATCH_SIZE): Observable<Message[]> {
    return this.$.pipe(
      switchMap(
        db => from(
          db.messages.find({ $and: [{ conference: { $eq: uuid } }, { date: { $gt: timestamp } }] })
          .sort({ date: 1 })
          .limit(limit)
          .$
        )
      ),
      map((documents: MessageDocument[]) => {
        let messages: Message[] = [];

        for (let document of documents) {
          let message: Message = {
            uuid: document.uuid,
            author: {
              uuid: document.author.uuid,
              name: document.author.name
            },
            conference: document.conference,
            readed: document.readed,
            readedAt: document.readedAt,
            type: document.type,
            date: document.date,
            content: document.content,
            consumed: document.consumed,
            edited: document.edited
          };

          messages.push(message);
        }

        return messages;
      })
    );
  }

  upsertMessage(message: Message): Observable<MessageDocument> {
    return this.$.pipe(switchMap(db => from(db.messages.atomicUpsert(message))));
  }

  ngOnDestroy() {
    this.$.pipe(switchMap(db => from(db.remove()))).subscribe();
  }
}