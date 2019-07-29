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

   def __init__(self, config=None):
      ApplicationSession.__init__(self, config)

      self.sessions = { }


   @inlineCallbacks
   def onJoin(self, details):
      try:
         # yield self.subscribe(self.onSessionJoin, 'wamp.session.on_join')

         yield self.register(self.authenticate, 'authenticate')
         print("WAMP-Anonymous dynamic authenticator registered!")

         yield self.subscribe(self.onSessionLeave, 'wamp.session.on_leave')

      except Exception as e:
         print("Failed to register dynamic authenticator: {0}".format(e))


   def authenticate(self, realm, authid, details):
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
         user = authenticator.authenticate(token)

         principal['extra']['user'] = {
            'uuid': str(user.uuid),
            'email': user.email,
            'name': user.name,
            'jwt': token,
            'last_seen': user.last_seen.timestamp()
         }

         self.sessions[details['session']] = details
      # builtins.TypeError: catching classes that do not inherit from BaseException is not allowed
      # except (InvalidSignatureError, UserNotFoundError, WrongTokenError, Exception) as e:
      except Exception as e:
         # todo: Log in case of system error

         principal['extra']['error'] = str(e)

         return principal

      principal['role'] = 'user'

      return principal


   # def onSessionJoin(self, details):
   #    authextra = details.get('authextra')
   #
   #    if authextra or 'Bearer token' in authextra:
   #       self.sessions[details[session]] = details


   def onSessionLeave(self, session_id):
      if session_id in self.sessions:
         details = self.sessions[session_id]

         authextra = details.get('authextra')

         if authextra or 'Bearer token' in authextra:
            authenticator.seen(details['authextra']['Bearer token']);

         del self.sessions[session_id]