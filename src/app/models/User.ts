export interface User {
  uuid: string,
  email?: string,
  name: string,
  jwt?: string,
  last_seen?: number
}