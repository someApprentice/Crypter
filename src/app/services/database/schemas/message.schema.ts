export default interface Message {
  uuid: string,
  conference: string,
  author: string,
  readed: boolean,
  readedAt?: number,
  type: 'text/plain' | 'audio/ogg' | 'video/mp4',
  date: number,
  content: string,
  consumed?: boolean,
  edited?: boolean
}
