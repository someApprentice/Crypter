from twisted.internet.defer import inlineCallbacks
from autobahn.twisted.component import Component
from autobahn.twisted.component import run
from autobahn.wamp.types import PublishOptions
from autobahn.wamp.types import SubscribeOptions


token = u"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1dWlkIjoiM2RkZmViNmUtY2U3YS00ZTFlLTgwOGMtODVhMmEwZDNkNWU5IiwiaGFzaCI6IiQyeSQxMyR0OFEyY0kzZFhQaWlTWDVHOFRvYzdPbG1URExycW1xeHVZRmJhbXo0cW1SM0NZb0NUYXJJNiJ9.yDl4wlvKeX_l4BAiHGz7sPz2CtEr4g9UftJ8NmYbM1o";

comp = Component(
    transports=u"ws://localhost/wamp",
    realm=u"realm1",
    authentication={
        u"anonymous": {
            u"authrole": u"user",
            u"authextra": {
                # u"Bearer token": u"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJzaGgtc2VjcmV0IiwiaWF0IjoxNTUzOTI0NjgyfQ.Ol8szaQ2U00HR2QEO9V4a1QMEFCwaHGYRmLJH4xH4CQ"
                u"Bearer token": token
            }
        }
    }
)

@comp.on_join
@inlineCallbacks
def joined(session, details):
    print("Bob session ready")

    print("details: {}".format(details))

    # try:
    #     res = yield session.call(u'call', { 'KEY': "VALUE" })
    #     print("call result: {}".format(res))

    # except Exception as e:
    #     print("call error: {0}".format(e))

    # while True:
    #     # publish() only returns a Deferred if we asked for an acknowledgement
    #     session.publish(u'com.myapp.oncounter', counter)
    #     counter += 1
    #     yield sleep(1)

    # @component.subscribe(u"message.to.alice")
    # def handler(message):
    #     print("event received: {0}", message)

    @inlineCallbacks
    def handler(message):
       print("message received:")
       print(message)
       print("")

       try:
           res = yield session.call(u'send', data={
                'to': '09c8e977-0182-4447-9836-9ad60a86b287',
                'text':'Hey, Alice',
                'Bearer token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1dWlkIjoiMTAzZjFmY2ItMTQ4YS00OGEyLTkxZmUtZDlmZGMxM2M1ZTA5IiwiZW1haWwiOiJib2JAY3J5cHRlci5jb20iLCJuYW1lIjoiQm9iIiwiaGFzaCI6IiQyYiQxMyR3ZFNad1dRNXdHcjNjNFJZLjlJYndlMXVDN2lZWERWNkJaRTh6R28yQ1RqYy5HaFpRWmNBYSIsImlhdCI6MTU1MzM0NDc2Mn0.ybW-wjOSQGJ5je8Z_9ijpL5QEedxrZWQsJoDdu7XXhY'
            })

           print("call result: {}".format(res))
       except Exception as e:
           print("call error: {0}".format(e))   

       # p = yield session.publish(u'private.message.to.09c8e977-0182-4447-9836-9ad60a86b287', { 'message': u"Hey, Alice", 'from': "Bob" }, options = PublishOptions(acknowledge = True))
       # print("Published: {}".format(p))

    try:
        topic = u'private.message.to.103f1fcb-148a-48a2-91fe-d9fdc13c5e09'

        yield session.subscribe(handler, topic, SubscribeOptions(match='exact'))
        print("subscribed to {0}", topic)
    except Exception as e:
        print("could not subscribe to topic: {0}".format(e))


if __name__ == "__main__":
    run([comp])