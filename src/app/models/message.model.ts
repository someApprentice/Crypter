import User from './user.model';
import Conference from './conference.model';

export default interface Message {
  uuid: string,
  conference: Conference,
  author: User,
  read: boolean,
  readAt?: number,
  type: 'text/plain' | 'audio/ogg' | 'video/mp4',
  date: number,
  content: string,
  consumed?: boolean,
  edited?: boolean
}
