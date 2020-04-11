import { User } from './User';
import { Message } from './Message';

export interface Conference {
  uuid: string,
  updated: number,
  count: number,
  unread: number,
  participant?: User,
  participants?: User[]
}
