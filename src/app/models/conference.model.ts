import { User } from './user.model';

export interface Conference {
  uuid: string,
  updated: number,
  count: number,
  unread: number,
  participant?: User,
  participants?: User[]
}
