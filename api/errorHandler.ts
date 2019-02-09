import { ValidationError  } from 'sequelize';
import * as token from 'jsonwebtoken';
import * as authenticate from 'express-jwt';

export function errorHandler(err, req, res, next) {
  if (err instanceof ValidationError) {
    return res.sendStatus(400); 
  }

  if (
    err instanceof authenticate.UnauthorizedError ||
    err instanceof token.TokenExpiredError
  ) {
    return res.set('WWW-Authenticate', 'Bearer').sendStatus(401);
  }

  return res.sendStatus(500);
}