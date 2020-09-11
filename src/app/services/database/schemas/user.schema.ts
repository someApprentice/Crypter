export default interface UserSchema {
  uuid: string,
  email?: string,
  name: string,
  hash?: string,
  last_seen?: number,
  conferences_count?: number,
  fingerprint?: string,
  public_key?: string,
  private_key?: string,
  revocation_certificate?: string
}
