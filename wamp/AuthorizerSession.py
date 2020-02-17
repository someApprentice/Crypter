import sys, os
import re

# Each component executes this line and adds 'src' path again and again
sys.path.append(os.path.abspath((os.path.join(os.path.split(__file__)[0], 'src'))))

import src

from autobahn.twisted.wamp import ApplicationSession
from twisted.internet.defer import inlineCallbacks

import authenticator

class AuthorizerSession(ApplicationSession):

    @inlineCallbacks
    def onJoin(self, details):
        yield self.register(self.authorize, 'authorize')

    def authorize(self, session, uri, action, options):
        # Should log it?
        self.log.info('authorize: session={session}, uri={uri}, action={action}, options={options}',
                      session=session, uri=uri, action=action, options=options)

        if action == 'register':
            # not necessarily because server authorization occurs via config.json and all its actions are trusted
            # just for the record
            if uri == 'send' and session['authrole'] == 'server':
                return True

            if uri == 'read' and session['authrole'] == 'server':
                return True

            if uri == 'send' and session['authrole'] == 'server':
                return True


        if action == 'call':
            if uri == 'send' and session['authrole'] == 'user':
                return True

            if uri == 'read' and session['authrole'] == 'user':
                return True

            if uri == 'write' and session['authrole'] == 'user':
                return True


        if action == 'publish':
            # not necessarily because server authorization occurs via config.json and all its actions are trusted
            # just for the record
            if 'private.message.to.' in uri and session['authrole'] == 'server':
                return True

            if 'conference.updated.for.' in uri and session['authrole'] == 'server':
                return True

            if 'private.message.updated.for.' in uri and session['authrole'] == 'server':
                return True

            if 'writing.for.' in uri and session['authrole'] == 'server':
                return True



        if action == 'subscribe':
            # session.subscribe(handler, topic, SubscribeOptions(match='exact'))
            # if 'private.message.to.' in uri and options['match'] == 'exact':
            # apparently options doesn't work
            if 'private.message.to.' in uri:
                regex = re.compile('^private\.message\.to\.([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89aAbB][a-f0-9]{3}-[a-f0-9]{12})$')

                m = regex.match(uri)

                uuid = m.group(1) if m else None

                authextra = session.get('authextra')

                if not authextra or 'Bearer token' not in authextra:
                    return False

                token = session['authextra']['Bearer token']

                try:
                    user = authenticator.authenticate(token)
                except Exception as e:
                    # todo: Log in case of system error

                    return False

                if uuid == str(user.uuid):
                    return True


            if 'conference.updated.for.' in uri:
                regex = re.compile('^conference\.updated\.for\.([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89aAbB][a-f0-9]{3}-[a-f0-9]{12})$')

                m = regex.match(uri)

                uuid = m.group(1) if m else None

                authextra = session.get('authextra')

                if not authextra or 'Bearer token' not in authextra:
                    return False

                token = session['authextra']['Bearer token']

                try:
                    user = authenticator.authenticate(token)
                except Exception as e:
                    # todo: Log in case of system error

                    return False

                if uuid == str(user.uuid):
                    return True


            if 'private.message.updated.for.' in uri:
                regex = re.compile('^private\.message\.updated\.for\.([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89aAbB][a-f0-9]{3}-[a-f0-9]{12})$')

                m = regex.match(uri)

                uuid = m.group(1) if m else None

                authextra = session.get('authextra')

                if not authextra or 'Bearer token' not in authextra:
                    return False

                token = session['authextra']['Bearer token']

                try:
                    user = authenticator.authenticate(token)
                except Exception as e:
                    # todo: Log in case of system error

                    return False

                if uuid == str(user.uuid):
                    return True

            if 'writing.for.' in uri:
                regex = re.compile('^writing\.for\.([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89aAbB][a-f0-9]{3}-[a-f0-9]{12})$')

                m = regex.match(uri)

                uuid = m.group(1) if m else None

                authextra = session.get('authextra')

                if not authextra or 'Bearer token' not in authextra:
                    return False

                token = session['authextra']['Bearer token']

                try:
                    user = authenticator.authenticate(token)
                except Exception as e:
                    # todo: Log in case of system error

                    return False

                if uuid == str(user.uuid):
                    return True

        return False
