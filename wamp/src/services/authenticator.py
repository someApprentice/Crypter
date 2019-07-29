import os
import datetime

import jwt
from jwt.exceptions import InvalidSignatureError

import database

from models.errors.authentication import UserNotFoundError, WrongTokenError

from user import User

# Does dotenv loading from database module?
JWT_SECRET = os.getenv('JWT_SECRET');

def authenticate(token):
    payload = jwt.decode(token, JWT_SECRET, algorithms='HS256')

    user = database.session.query(User).get(payload['uuid'])

    if not user:
      raise UserNotFoundError()

    if payload['hash'] != user.hash:
      raise WrongTokenError()

    return user


def seen(token):
    payload = jwt.decode(token, JWT_SECRET, algorithms='HS256')

    user = database.session.query(User).get(payload['uuid'])

    user.last_seen = datetime.datetime.utcnow()

    database.session.add(user)

    database.session.commit()