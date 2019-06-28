import sys, os

# Each component executes this line and adds 'src' path again and again
sys.path.append(os.path.abspath((os.path.join(os.path.split(__file__)[0], 'src'))))

import src

from autobahn.twisted.wamp import ApplicationSession
from twisted.internet.defer import inlineCallbacks

from messanger import Messanger

class MessangerSession(ApplicationSession):

    @inlineCallbacks
    def onJoin(self, details):
        yield self.register(self.send, 'send')

    def send(self, data):
        result = Messanger.send(data)

        response = {
            'data': data,
            'conference': result['conference'],
            'message': result['message'],
            'errors': result['errors']
        }

        if response['errors']:
            return response


        for conference_reference in result['conference_references']:
            conference = {
                'uuid': result['conference']['uuid'],
                'updated': result['conference']['updated'],
                'count': conference_reference['count'],
                'unread': conference_reference['unread'],
                'participant': conference_reference['participant']
            }

            self.publish(f"conference.updated.for.{conference_reference['user']}", conference)


        message = {
            'uuid': result['message']['uuid'],
            'author': result['message']['author'],
            'conference': result['message']['conference'],
            'readed': result['message']['readed'],
            'date': result['message']['date'],
            'type': result['message']['type'],
            'content': result['message']['content'],
            'consumed': result['message']['consumed'],
            'edited': result['message']['edited']
        }

        self.publish(f"private.message.to.{result['data']['to']}", message)


        return response