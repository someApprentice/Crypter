import { User } from './user.model';
import { Message } from './message.model';

export interface Conference {
  uuid: string,
  type: 'private' | 'public' | 'secret',
  updated_at: number,
  messages_count: number,
  unread_messages_count: number,
  participant?: User,
  participants?: User[],
  last_message?: Message
}
