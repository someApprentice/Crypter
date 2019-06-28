import { User } from './User';

export interface Message {
  uuid: string,
  author: User,
  conference: string,
  readed: boolean,
  type: string,
  date: number,
  content: string,
  consumed?: boolean,
  edited?: boolean
}