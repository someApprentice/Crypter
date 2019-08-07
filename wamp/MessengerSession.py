import sys, os
import copy

# Each component executes this line and adds 'src' path again and again
sys.path.append(os.path.abspath((os.path.join(os.path.split(__file__)[0], 'src'))))

import src

from autobahn.twisted.wamp import ApplicationSession
from twisted.internet.defer import inlineCallbacks

from messenger import Messenger

class MessengerSession(ApplicationSession):

    @inlineCallbacks
    def onJoin(self, details):
        yield self.register(self.send, 'send')
        yield self.register(self.read_message, 'read')
        yield self.register(self.write, 'write')

    def send(self, data):
        result = Messenger.send(data)

        response = {
            'data': data,
            'conference': result['conference'],
            'message': result['message'],
            'errors': result['errors']
        }

        response['message']['conference']['participant'] = result['conference']['participant']['uuid']

        if response['errors']:
            return response

        for conference_reference in result['conference_references']:
            if conference_reference['user'] == result['data']['to']:
                m = copy.deepcopy(result['message'])

                m['conference']['participant'] = conference_reference['participant']['uuid']

                self.publish(f"private.message.to.{result['data']['to']}", m)

            conference = {
                'uuid': result['conference']['uuid'],
                'updated': result['conference']['updated'],
                'count': conference_reference['count'],
                'unread': conference_reference['unread'],
                'participant': conference_reference['participant']
            }

            self.publish(f"conference.updated.for.{conference_reference['user']}", conference)

        return response


    def read_message(self, data):
        result = Messenger.read_message(data)

        response = {
            'data': data,
            'message': result['message'],
            'conference': result['conference'],
            'errors': result['errors']
        }

        if response['errors']:
            return response

        for conference_reference in result['conference_references']:
            m = result['message']

            m['conference']['participant'] = conference_reference['participant']['uuid']

            # self.publish(f"private.message.readed.for.{conference_reference['user']}", m)
            self.publish(f"private.message.updated.for.{conference_reference['user']}", m)

        self.publish(f"conference.updated.for.{result['data']['by']}", result['conference'])

        return response

    def write(self, data):
        result = Messenger.write(data)

        response = {
            'data': data,
            'user': result['user'],
            'conference': result['conference'],
            'errors':  result['errors']
        }

        if response['errors']:
            return response

        for participant in result['conference']['participants']:
            if participant['uuid'] != result['user']['uuid']:
                self.publish(f"writing.for.{participant['uuid']}", { 'conference': result['conference']['uuid'], 'user': result['user'] })

        return response
