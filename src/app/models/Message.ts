import { User } from './User';

export interface Message {
  uuid: string,
  author: User,
  conference: {
    uuid: string,
    participant?: string
  },
  readed: boolean,
  readedAt?: string
  type: string,
  date: number,
  content: string,
  consumed?: boolean,
  edited?: boolean
}
