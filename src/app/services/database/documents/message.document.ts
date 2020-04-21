import { RxDocument } from 'rxdb';

export type MessageDocType = {
  uuid: string,
  conference: string,
  author: string,
  readed: boolean,
  readedAt?: string
  type: string,
  date: number,
  content: string,
  consumed?: boolean,
  edited?: boolean
};

export type MessageDocument = RxDocument<MessageDocType>;
