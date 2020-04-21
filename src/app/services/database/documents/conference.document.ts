import { RxDocument } from 'rxdb';

export type ConferenceDocType = {
  uuid: string,
  updated: number,
  count: number,
  unread: number,
  participant?: string,
};

export type ConferenceDocument = RxDocument<ConferenceDocType>;
