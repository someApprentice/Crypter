import sys, os

# Each component executes this line and adds 'src' path again and again
sys.path.append(os.path.abspath((os.path.join(os.path.split(__file__)[0], 'src'))))

import src

from twisted.internet.defer import inlineCallbacks

from autobahn.twisted.wamp import ApplicationSession
from autobahn.wamp.exception import ApplicationError

import database
import authenticator

from jwt.exceptions import InvalidSignatureError
from models.errors.authentication import UserNotFoundError, WrongTokenError

from pprint import pprint

class AuthenticatorSession(ApplicationSession):

   @inlineCallbacks
   def onJoin(self, details):

      def authenticate(realm, authid, details):
         # Should log it?
         print("WAMP-Anonymous dynamic authenticator invoked: realm='{}', authid='{}'".format(realm, authid))
         pprint(details)

         principal = {
            'role': 'anonymous',
            'extra': { }
         }
         
         authextra = details.get('authextra')
         
         # Is it best way to response error?
         if not details or not authextra or 'Bearer token' not in authextra:
            principal['extra']['error'] = "Access denied: No Bearer token in authexta"

            return principal

         token = details['authextra']['Bearer token']

         principal['extra']['Bearer token'] = token

         try:
            authenticator.authenticate(token)
         # builtins.TypeError: catching classes that do not inherit from BaseException is not allowed
         # except (InvalidSignatureError, UserNotFoundError, WrongTokenError, Exception) as e:
         except Exception as e:
            # todo: Log in case of system error

            principal['extra']['error'] = str(e)

            return principal

         principal['role'] = 'user'

         return principal

      try:
         yield self.register(authenticate, 'authenticate')
         print("WAMP-Anonymous dynamic authenticator registered!")
      except Exception as e:
         print("Failed to register dynamic authenticator: {0}".format(e))