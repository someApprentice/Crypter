import { User } from './user.model';
import { Conference } from './conference.model';

export interface Message {
  uuid: string,
  conference: Conference,
  author: User,
  readed: boolean,
  readedAt?: number,
  type: 'text/plain' | 'audio/ogg' | 'video/mp4',
  date: number,
  content: string,
  consumed?: boolean,
  edited?: boolean
}
