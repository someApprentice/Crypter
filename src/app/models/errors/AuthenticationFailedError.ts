export class AuthenticationFailedError extends Error {
  constructor() {
    super();
    this.message = 'Authentication failed'; 
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, AuthenticationFailedError.prototype);
  }
}