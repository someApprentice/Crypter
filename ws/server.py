import os, datetime

from uuid import UUID, uuid4

import socketio

import tornado.ioloop
import tornado.web

from http.cookies import SimpleCookie

import jwt
from jwt.exceptions import InvalidTokenError, InvalidSignatureError

import src.services.database as database
from sqlalchemy.sql.expression import and_

import cerberus, src.services.validator

from user import User
from conference import Conference
from conference_reference import Conference_Reference
from participant import Participant
from message import Message
from message_reference import Message_Reference

JWT_SECRET = os.getenv('JWT_SECRET')

sio = socketio.AsyncServer(async_mode='tornado')

@sio.event
async def connect(sid, environ):
    # Is it good solution to authenticate User with a cookies?
    if 'HTTP_COOKIE' not in environ:
        raise ConnectionRefusedError('Access denied: No cookie with a hash')

    cookies = SimpleCookie(environ['HTTP_COOKIE'])

    if 'hash' not in cookies:
        raise ConnectionRefusedError('Access denied: No cookie with a hash')

    token = cookies.get('hash').value

    try:
        payload = jwt.decode(token, JWT_SECRET)
    except (InvalidTokenError, InvalidSignatureError) as e:
        raise ConnectionRefusedError('Access denied: Invalid hash')

    user = database.session.query(User).get(payload['uuid'])

    if not user or user.hash != payload['hash']:
        raise ConnectionRefusedError('Access denied: Matches not found')

    json = {
        'uuid': str(user.uuid),
        'email': user.email,
        'name': user.name,
        'hash': token,
        'last_seen': user.last_seen.timestamp(),
        'conferences_count': user.conferences_count,
        'public_key': user.public_key,
        'private_key': user.private_key,
        'revocation_certificate': user.revocation_certificate
    }

    # To emit event for a specific User you need to define the room with his uuid
    sio.enter_room(sid, str(user.uuid))

    await sio.save_session(sid, json)

    await sio.emit('user.updated', {k: json[k] for k in json if k not in {'public_key', 'private_key', 'revocation_certificate'}}, room=sid)

@sio.event
async def disconnect(sid):
    session = await sio.get_session(sid)

    user = database.session.query(User).get(session['uuid'])

    user.last_seen = datetime.datetime.utcnow()

    database.session.add(user)
    database.session.commit()

@sio.on('private.message.sent')
async def send_private_message(sid, data):
    json = {}

    v = cerberus.Validator()

    v.schema = {
        'to': {
            'type': 'UUID',
            'required': True,
            'coerce': UUID
        },
        'text': {
            'type': 'string',
            'required': True
        }
    }

    if not v.validate(data):
        json['errors'] = v.errors

        return json

    user = await sio.get_session(sid)

    sender = database.session.query(User).get(user['uuid'])

    receiver = database.session.query(User).get(data['to'])

    if not receiver:
        json['errors'] = { 'to': "Reciever doesn't exist" }

        return json

    conference = database.session.query(Conference) \
            .join(Conference_Reference) \
            .filter(and_(
                Conference_Reference.conference_uuid == Conference.uuid,
                Conference_Reference.user_uuid == sender.uuid,
                Conference_Reference.participant_uuid == receiver.uuid
            )) \
            .one_or_none()

    if not conference:
        conference = Conference(uuid=uuid4(), type='private')

        sender_conference_reference = Conference_Reference(
            user_uuid=sender.uuid,
            conference=conference,
            participant=receiver
        )

        receiver_conference_reference = Conference_Reference(
            user=receiver,
            conference=conference,
            participant_uuid=sender.uuid
        )

        sender_participant = Participant(conference=conference, user_uuid=sender.uuid)

        receiver_participant = Participant(conference=conference, user=receiver)

        database.session.add(conference)
        database.session.flush()

        database.session.add_all([
            sender_conference_reference,
            receiver_conference_reference,
            sender_participant,
            receiver_participant
        ])
        database.session.flush()

        sender.conferences_count += 1
        receiver.conferences_count += 1

        database.session.add_all([
            sender,
            receiver
        ])
        database.session.flush()

    sender_conference_reference = database.session.query(Conference_Reference) \
        .filter(and_(
            Conference_Reference.user_uuid == sender.uuid,
            Conference_Reference.conference_uuid == conference.uuid
        )) \
        .one_or_none()

    # In case sender has deleted his own conference
    if not sender_conference_reference:
        sender_conference_reference = Conference_Reference(
            user_uuid=sender.uuid,
            conference=conference,
            participant=receiver
        )

        database.session.add(sender_conference_reference)
        database.session.flush()

        sender.conferences_count += 1

        database.session.add(sender)
        database.session.flush()

    receiver_conference_reference = database.session.query(Conference_Reference) \
        .filter(and_(
            Conference_Reference.user_uuid == receiver.uuid,
            Conference_Reference.conference_uuid == conference.uuid
        )) \
        .one_or_none()

    # In case receiver has deleted his own conference
    if not receiver_conference_reference:
        receiver_conference_reference = Conference_Reference(
            user=receiver,
            conference=conference,
            participant_uuid=sender.uuid
        )

        database.session.add(receiver_conference_reference)
        database.session.flush()

        receiver.conferences_count += 1

        database.session.add(receiver)
        database.session.flush()

    message = Message(
        uuid=uuid4(),
        conference=conference,
        author_uuid=sender.uuid,
        type='text/plain',
        content=data['text'],
        edited=False
    )

    sender_message_reference = Message_Reference(user_uuid=sender.uuid, message=message)
    receiver_message_reference = Message_Reference(user=receiver, message=message)

    database.session.add(message)
    database.session.flush()

    database.session.add(sender_message_reference)
    database.session.add(receiver_message_reference)
    database.session.flush()

    sender_conference_reference.updated_at = datetime.datetime.utcnow()
    sender_conference_reference.messages_count += 1
    sender_conference_reference.last_message = message

    receiver_conference_reference.updated_at = datetime.datetime.utcnow()
    receiver_conference_reference.messages_count += 1
    receiver_conference_reference.unread_messages_count += 1
    receiver_conference_reference.last_message = message

    database.session.add(sender_conference_reference)
    database.session.add(receiver_conference_reference)
    database.session.flush()

    database.session.commit()

    conference_references = [
        sender_conference_reference,
        receiver_conference_reference
    ]

    await sio.emit('user.conferences_count.updated', { 'conferences_count': sender.conferences_count }, room=str(sender.uuid))
    await sio.emit('user.conferences_count.updated', { 'conferences_count': receiver.conferences_count }, room=str(receiver.uuid))

    for conference_reference in conference_references:
        c = {
            'uuid': str(conference.uuid),
            'type': conference.type,
            'updated_at': conference_reference.updated_at.timestamp(),
            'messages_count': conference_reference.messages_count,
            'unread_messages_count': conference_reference.unread_messages_count,
            'participant': {
                'uuid': str(conference_reference.participant.uuid),
                'name': conference_reference.participant.name,
                'public_key': conference_reference.participant.public_key
            },
            'last_message': {
                'uuid': str(message.uuid),
                'author': {
                    'uuid': str(message.author.uuid),
                    'name': message.author.name,
                    'public_key': message.author.public_key
                },
                'conference': {
                    'uuid': str(conference.uuid),
                    'type': conference.type,
                    'updated_at': conference_reference.updated_at.timestamp(),
                    'messages_count': conference_reference.messages_count,
                    'unread_messages_count': conference_reference.unread_messages_count,
                    'participant': {
                        'uuid': str(conference_reference.participant.uuid),
                        'name': conference_reference.participant.name,
                        'public_key': conference_reference.participant.public_key
                    }
                },
                'readed': message.readed,
                'readedAt': message.readed_at.timestamp() if message.readed_at is not None else message.readed_at,
                'date': message.date.timestamp(),
                'type': message.type,
                'content': message.content,
                'consumed': message.consumed,
                'edited': message.edited
           }
        }

        await sio.emit('conference.updated', c, room=str(conference_reference.user.uuid))

        m = {
            'uuid': str(message.uuid),
            'author': {
                'uuid': str(message.author.uuid),
                'name': message.author.name,
                'public_key': message.author.public_key
            },
            'conference': {
                'uuid': str(conference.uuid),
                'type': conference.type,
                'updated_at': conference_reference.updated_at.timestamp(),
                'messages_count': conference_reference.messages_count,
                'unread_messages_count': conference_reference.unread_messages_count,
                'participant': {
                    'uuid': str(conference_reference.participant.uuid),
                    'name': conference_reference.participant.name,
                    'public_key': conference_reference.participant.public_key
                }
            },
            'readed': message.readed,
            'readedAt': message.readed_at.timestamp() if message.readed_at is not None else message.readed_at,
            'date': message.date.timestamp(),
            'type': message.type,
            'content': message.content,
            'consumed': message.consumed,
            'edited': message.edited
        }

        await sio.emit('private.message.sent', m, room=str(conference_reference.user.uuid))

    json['message'] = {
        'uuid': str(message.uuid),
        'author': {
            'uuid': str(message.author.uuid),
            'name': message.author.name,
            'public_key': message.author.public_key
        },
        'conference': {
            'uuid': str(conference.uuid),
            'type': conference.type,
            'updated_at': sender_conference_reference.updated_at.timestamp(),
            'messages_count': sender_conference_reference.messages_count,
            'unread_messages_count': sender_conference_reference.unread_messages_count,
            'participant': {
                'uuid': str(sender_conference_reference.participant.uuid),
                'name': sender_conference_reference.participant.name,
                'public_key': sender_conference_reference.participant.public_key
            }
        },
        'readed': message.readed,
        'readedAt': message.readed_at.timestamp() if message.readed_at is not None else message.readed_at,
        'date': message.date.timestamp(),
        'type': message.type,
        'content': message.content,
        'consumed': message.consumed,
        'edited': message.edited
    }

    return json

@sio.on('private.message.read')
async def read_private_message(sid, data):
    json = {}

    v = cerberus.Validator()

    v.schema = {
        'message': {
            'type': 'UUID',
            'required': True,
            'coerce': UUID
        }
    }

    if not v.validate(data):
        result['errors'] = v.errors

        return result

    user = await sio.get_session(sid)

    message = database.session.query(Message).filter(Message.uuid == data['message']).one_or_none()

    if not message:
        json['errors'] = { 'message': "Message doesn't exist" }

        return json

    if message.author.uuid == user['uuid']:
        json['errors'] = { 'message': "You're author of this message" }

        return json

    if message.readed:
        json['errors'] = { 'message': "Message already read" }

        return json

    message_reference = database.session.query(Message_Reference) \
        .filter(Message_Reference.message_uuid == message.uuid, Message_Reference.user_uuid == user['uuid']) \
        .one_or_none()

    if not message_reference:
        json['errors'] = { 'message': "Message doesn't exists" }

        return json

    message.readed = True
    message.readed_at = datetime.datetime.utcnow()

    database.session.add(message)

    database.session.flush()

    conference_reference = database.session.query(Conference_Reference) \
        .filter(
            Conference_Reference.conference_uuid == message.conference_uuid,
            Conference_Reference.user_uuid == user['uuid']
        ) \
        .one_or_none()

    if conference_reference:
        conference_reference.unread_messages_count -= 1

        database.session.add(conference_reference)

        database.session.flush()

    database.session.commit()

    conference_references = database.session.query(Conference_Reference) \
        .filter(Conference_Reference.conference_uuid == conference_reference.conference.uuid) \
        .all()

    for cr in conference_references:
        c = {
            'uuid': str(conference_reference.conference.uuid),
            'type': conference_reference.conference.type,
            'updated_at': conference_reference.updated_at.timestamp(),
            'messages_count': conference_reference.messages_count,
            'unread_messages_count': conference_reference.unread_messages_count,
            'participant': {
                'uuid': str(conference_reference.participant.uuid),
                'name': conference_reference.participant.name,
                'public_key': conference_reference.participant.public_key
            },
            'last_message': {
                'uuid': str(conference_reference.last_message.uuid),
                'author': {
                    'uuid': str(conference_reference.last_message.author.uuid),
                    'name': conference_reference.last_message.author.name,
                    'public_key': conference_reference.last_message.author.public_key
                },
                'conference': {
                    'uuid': str(conference_reference.conference.uuid),
                    'type': conference_reference.conference.type,
                    'updated_at': conference_reference.updated_at.timestamp(),
                    'messages_count': conference_reference.messages_count,
                    'unread_messages_count': conference_reference.unread_messages_count,
                    'participant': {
                        'uuid': str(conference_reference.participant.uuid),
                        'name': conference_reference.participant.name,
                        'public_key': conference_reference.participant.public_key
                    }
                },
                'readed': conference_reference.last_message.readed,
                'readedAt': conference_reference.last_message.readed_at.timestamp() if conference_reference.last_message.readed_at is not None else conference_reference.last_message.readed_at,
                'date': conference_reference.last_message.date.timestamp(),
                'type': conference_reference.last_message.type,
                'content': conference_reference.last_message.content,
                'consumed': conference_reference.last_message.consumed,
                'edited': conference_reference.last_message.edited
           }
        }

        await sio.emit('conference.updated', c, room=str(cr.user.uuid))

        m = {
            'uuid': str(message.uuid),
            'author': {
                'uuid': str(message.author.uuid),
                'name': message.author.name,
                'public_key': message.author.public_key
            },
            'conference': {
                'uuid': str(cr.conference.uuid),
                'type': cr.conference.type,
                'updated_at': cr.updated_at.timestamp(),
                'messages_count': cr.messages_count,
                'unread_messages_count': cr.unread_messages_count,
                'participant': {
                    'uuid': str(cr.participant.uuid),
                    'name': cr.participant.name,
                    'public_key': cr.participant.public_key
                }
            },
            'readed': message.readed,
            'readedAt': message.readed_at.timestamp() if message.readed_at is not None else message.readed_at,
            'date': message.date.timestamp(),
            'type': message.type,
            'content': message.content,
            'consumed': message.consumed,
            'edited': message.edited
        }

        await sio.emit('private.message.read', m, room=str(cr.user.uuid))

    json['message'] = {
        'uuid': str(message.uuid),
        'author': {
            'uuid': str(message.author.uuid),
            'name': message.author.name,
            'public_key': message.author.public_key
        },
        'conference': {
            'uuid': str(conference_reference.conference.uuid),
            'type': conference_reference.conference.type,
            'updated_at': conference_reference.updated_at.timestamp(),
            'messages_count': conference_reference.messages_count,
            'unread_messages_count': conference_reference.unread_messages_count,
            'participant': {
                'uuid': str(conference_reference.participant.uuid),
                'name': conference_reference.participant.name,
                'public_key': conference_reference.participant.public_key
            }
        },
        'readed': message.readed,
        'readedAt': message.readed_at.timestamp() if message.readed_at is not None else message.readed_at,
        'date': message.date.timestamp(),
        'type': message.type,
        'content': message.content,
        'consumed': message.consumed,
        'edited': message.edited
    }

    return json

@sio.on('private.message.read_since')
async def read_private_message_since(sid, data):
    json = {}

    v = cerberus.Validator()

    v.schema = {
        'message': {
            'type': 'UUID',
            'required': True,
            'coerce': UUID
        }
    }

    if not v.validate(data):
        result['errors'] = v.errors

        return result

    user = await sio.get_session(sid)

    message = database.session.query(Message).filter(Message.uuid == data['message']).one_or_none()

    if not message:
        json['errors'] = { 'message': "Message doesn't exist" }

        return json

    if message.author.uuid == user['uuid']:
        json['errors'] = { 'message': "You're author of this message" }

        return json

    message_reference = database.session.query(Message_Reference) \
        .filter(Message_Reference.message_uuid == message.uuid, Message_Reference.user_uuid == user['uuid']) \
        .one_or_none()

    if not message_reference:
        json['errors'] = { 'message': "Message doesn't exists" }

        return json

    messages = database.session.query(Message) \
        .filter(
            Message.conference_uuid == message.conference_uuid,
            Message.readed == False,
            Message.date <= message.date
        ) \
        .all()

    for m in messages:
        m.readed = True
        m.readed_at = datetime.datetime.utcnow()

    database.session.add_all(messages)

    database.session.flush()

    conference_reference = database.session.query(Conference_Reference) \
        .filter(
            Conference_Reference.conference_uuid == message.conference_uuid,
            Conference_Reference.user_uuid == user['uuid']
        ) \
        .one_or_none()

    if conference_reference:
        conference_reference.unread_messages_count -= len(messages)

        database.session.add(conference_reference)

        database.session.flush()

    database.session.commit()

    conference_references = database.session.query(Conference_Reference) \
        .filter(Conference_Reference.conference_uuid == conference_reference.conference.uuid) \
        .all()

    for cr in conference_references:
        c = {
            'uuid': str(cr.conference.uuid),
            'type': cr.conference.type,
            'updated_at': cr.updated_at.timestamp(),
            'messages_count': cr.messages_count,
            'unread_messages_count': cr.unread_messages_count,
            'participant': {
                'uuid': str(cr.participant.uuid),
                'name': cr.participant.name,
                'public_key': cr.participant.public_key
            },
            'last_message': {
                'uuid': str(cr.last_message.uuid),
                'author': {
                    'uuid': str(cr.last_message.author.uuid),
                    'name': cr.last_message.author.name,
                    'public_key': cr.last_message.author.public_key
                },
                'conference': {
                    'uuid': str(cr.conference.uuid),
                    'type': cr.conference.type,
                    'updated_at': cr.updated_at.timestamp(),
                    'messages_count': cr.messages_count,
                    'unread_messages_count': cr.unread_messages_count,
                    'participant': {
                        'uuid': str(cr.participant.uuid),
                        'name': cr.participant.name,
                        'public_key': cr.participant.public_key
                    }
                },
                'readed': cr.last_message.readed,
                'readedAt': cr.last_message.readed_at.timestamp() if conference_reference.last_message.readed_at is not None else conference_reference.last_message.readed_at,
                'date': cr.last_message.date.timestamp(),
                'type': cr.last_message.type,
                'content': cr.last_message.content,
                'consumed': cr.last_message.consumed,
                'edited': cr.last_message.edited
           }
        }

        await sio.emit('conference.updated', c, room=str(cr.user.uuid))

        ms = []

        for m in messages:
            ms.append({
                'uuid': str(m.uuid),
                'author': {
                    'uuid': str(m.author.uuid),
                    'name': m.author.name,
                    'public_key': m.author.public_key
                },
                'conference': {
                    'uuid': str(cr.conference.uuid),
                    'type': cr.conference.type,
                    'updated_at': cr.updated_at.timestamp(),
                    'messages_count': cr.messages_count,
                    'unread_messages_count': cr.unread_messages_count,
                    'participant': {
                        'uuid': str(cr.participant.uuid),
                        'name': cr.participant.name,
                        'public_key': cr.participant.public_key
                    }
                },
                'readed': m.readed,
                'readedAt': m.readed_at.timestamp() if m.readed_at is not None else m.readed_at,
                'date': m.date.timestamp(),
                'type': m.type,
                'content': m.content,
                'consumed': m.consumed,
                'edited': m.edited
            })

        await sio.emit('private.message.read_since', ms, room=str(cr.user.uuid))

    json['messages'] = []

    for m in messages:
        json['messages'].append({
            'uuid': str(m.uuid),
            'author': {
                'uuid': str(m.author.uuid),
                'name': m.author.name,
                'public_key': m.author.public_key
            },
            'conference': {
                'uuid': str(conference_reference.conference.uuid),
                'type': conference_reference.conference.type,
                'updated_at': conference_reference.updated_at.timestamp(),
                'messages_count': conference_reference.messages_count,
                'unread_messages_count': conference_reference.unread_messages_count,
                'participant': {
                    'uuid': str(conference_reference.participant.uuid),
                    'name': conference_reference.participant.name,
                    'public_key': conference_reference.participant.public_key
                }
            },
            'readed': m.readed,
            'readedAt': m.readed_at.timestamp() if m.readed_at is not None else m.readed_at,
            'date': m.date.timestamp(),
            'type': m.type,
            'content': m.content,
            'consumed': m.consumed,
            'edited': m.edited
        })

    return json

@sio.on('wrote.to.user')
async def write_to_user(sid, data):
    json = {}

    v = cerberus.Validator()

    v.schema = {
        'to': {
            'type': 'UUID',
            'required': True,
            'coerce': UUID
        }
    }

    if not v.validate(data):
        result['errors'] = v.errors

        return result

    user = await sio.get_session(sid)

    receiver = database.session.query(User).get(data['to'])

    if not receiver:
        json['errors'] = { 'to': "Reciever doesn't exist" }

        return json

    who = {
        'uuid': user['uuid'],
        'name': user['name'],
        'public_key': user['public_key']
    }

    await sio.emit('wrote.to.user', who, room=str(receiver.uuid))

    json['to'] = {
        'uuid': str(receiver.uuid),
        'name': receiver.name,
        'public_key': receiver.public_key
    }

    return json

if __name__ == '__main__':
    app = tornado.web.Application(
        [
            (r"/socket.io/", socketio.get_tornado_handler(sio))
        ]
    )

    app.listen(8080)

    tornado.ioloop.IOLoop.current().start()
