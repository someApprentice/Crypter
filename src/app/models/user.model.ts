export default interface User {
  uuid: string,
  email?: string,
  name: string,
  hash?: string,
  last_seen?: number,
  conferences_count?: number,
  public_key?: string,
  private_key?: string,
  revocation_certificate?: string
}
