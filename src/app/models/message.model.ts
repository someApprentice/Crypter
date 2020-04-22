import { User } from './user.model';
import { Conference } from './conference.model';

export interface Message {
  uuid: string,
  conference: Conference,
  author: User,
  readed: boolean,
  readedAt?: string
  type: string,
  date: number,
  content: string,
  consumed?: boolean,
  edited?: boolean
}
