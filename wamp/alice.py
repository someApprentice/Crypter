from twisted.internet.defer import inlineCallbacks
from autobahn.twisted.component import Component
from autobahn.twisted.component import run

token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1dWlkIjoiZWExNTViYmYtNzI2YS00ZjExLWEyYjYtZjhiZjA0MzMxZDRkIiwiaGFzaCI6IiQyeSQxMyQ0ZjRaN0o2R2t6SmNOZzJSZzgxVEF1V2g4cFhaSWFuWUVrNnEzekZBRWwyWTk1SEtLUEVlaSJ9.tBrnw1_1JXD1ts4aLe6khZwiA8d__ohBHTS3-D_u0bk";

comp = Component(
    transports=u"ws://localhost:/wamp",
    realm=u"realm1",
    authentication={
        u"anonymous": {
            u"authrole": "user",
            u"authextra": {
                u"Bearer token": token
            }
        }
    }
)

@comp.on_join
@inlineCallbacks
def joined(session, details):
    print("Alice session ready")

    # session.publish(u'private.message.to.103f1fcb-148a-48a2-91fe-d9fdc13c5e09', { 'message': u"Hey, Bob", 'from': 'Alice' })

    try:
        res = yield session.call(u'send', {
            'to': '103f1fcb-148a-48a2-91fe-d9fdc13c5e09',
            'text':'Hey, Bob',
            'Bearer token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1dWlkIjoiMDljOGU5NzctMDE4Mi00NDQ3LTk4MzYtOWFkNjBhODZiMjg3IiwiZW1haWwiOiJhbGljZUBjcnlwdGVyLmNvbSIsIm5hbWUiOiJBbGljZSIsImhhc2giOiIkMmIkMTMkbEZTTjQuYVRyMS9yN3ExQjBzYlhHLlg0TkpxZnUxakZiZXVyYi41WGFhT1dBUU5OSjN5cXEiLCJpYXQiOjE1NTM1MTc5NDl9.pqTrO3EcbkuKezBYLrv6wk3r1vROHA1xVwETSLZgBqo'
        })

        print("call result: {}".format(res))
    except Exception as e:
        print("call error: {0}".format(e))

    # while True:
    #     # publish() only returns a Deferred if we asked for an acknowledgement
    #     session.publish(u'com.myapp.oncounter', counter)
    #     counter += 1
    #     yield sleep(1)

    # @component.subscribe(u"message.to.alice")
    # def handler(message):
    #     print("event received: {0}", message)

    def handler(message):
       print("message received:")
       print(message)
       print("")

    try:
        topic = u'private.message.to.09c8e977-0182-4447-9836-9ad60a86b287'

        yield session.subscribe(handler, topic)
        print("subscribed to {0}", topic)
    except Exception as e:
        print("could not subscribe to topic: {0}".format(e))


if __name__ == "__main__":
    run([comp])