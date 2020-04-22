export interface User {
  uuid: string,
  email?: string,
  name: string,
  jwt?: string,
  last_seen?: number,
  public_key?: string,
  private_key?: string,
  revocation_certificate?: string
}
