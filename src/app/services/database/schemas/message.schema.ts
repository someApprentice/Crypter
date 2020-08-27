export default interface Message {
  uuid: string,
  conference: string,
  author: string,
  read: boolean,
  readAt?: number,
  type: 'text/plain' | 'audio/ogg' | 'video/mp4',
  date: number,
  content: string,
  consumed?: boolean,
  edited?: boolean
}
