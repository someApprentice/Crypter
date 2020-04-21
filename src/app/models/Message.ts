import { User } from './User';
import { Conference } from './Conference';

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
