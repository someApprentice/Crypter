export default interface ConferenceSchema {
  uuid: string,
  type: 'private' | 'public' | 'secret',
  updated_at: number,
  messages_count: number,
  unread_messages_count: number,
  participant?: string,
  last_message?: string
}
