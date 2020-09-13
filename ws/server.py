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

    if not user:
        raise ConnectionRefusedError('Access denied: Matches not found')

    json = {
        'uuid': str(user.uuid),
        'email': user.email,
        'name': user.name,
        'hash': token,
        'last_seen': user.last_seen.timestamp(),
        'conferences_count': user.conferences_count,
        'fingerprint': user.fingerprint,
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

@sio.on('start.secret.chat')
async def start_secret_chat(sid, data):
    json = {}

    v = cerberus.Validator()

    v.schema = {
        'user': {
            'type': 'UUID',
            'required': True,
            'coerce': UUID
        }
    }

    if not v.validate(data):
        json['errors'] = v.errors

        return json

    user = await sio.get_session(sid);

    requester = database.session.query(User).get(user['uuid'])

    participant = database.session.query(User).get(data['user'])

    if not participant:
        json['errors'] = { 'user': "Participant doesn't exist" }

        return json

    conference = database.session.query(Conference) \
        .join(Conference_Reference) \
        .filter(and_(
            Conference.type == 'secret',
            Conference_Reference.conference_uuid == Conference.uuid,
            Conference_Reference.user_uuid == requester.uuid,
            Conference_Reference.participant_uuid == participant.uuid
        )) \
        .one_or_none()

    if conference:
        conference_reference = database.session.query(Conference_Reference) \
            .filter(and_(
                Conference_Reference.user_uuid == requester.uuid,
                Conference_Reference.conference_uuid == conference.uuid
            )) \
            .one_or_none()

        json['conference'] = {
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
        }

        if conference_reference.last_message is not None:
            last_message = conference_reference.last_message

            json['conference']['last_message'] = {
                'uuid': str(last_message.uuid),
                'author': {
                    'uuid': str(last_message.author.uuid),
                    'name': last_message.author.name,
                    'public_key': last_message.author.public_key
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
                'read': last_message.read,
                'readAt': last_message.read_at.timestamp() if last_message.read_at is not None else last_message.read_at,
                'date': last_message.date.timestamp(),
                'type': last_message.type,
                'content': last_message.content,
                'consumed': last_message.consumed,
                'edited': last_message.edited
           }

        return json

    # if not conference:
    conference = Conference(uuid=uuid4(), type='secret')

    requester_conference_reference = Conference_Reference(
        user=requester,
        conference=conference,
        participant=participant
    )

    participant_conference_reference = Conference_Reference(
        user=participant,
        conference=conference,
        participant=requester
    )

    requester_participant = Participant(conference=conference, user_uuid=requester.uuid)

    participant_participant = Participant(conference=conference, user=participant)

    database.session.add(conference)
    database.session.flush()

    database.session.add_all([
        requester_conference_reference,
        participant_conference_reference,
        requester_participant,
        participant_participant
    ])
    database.session.flush()

    requester.conferences_count += 1
    participant.conferences_count += 1

    database.session.add_all([
        requester,
        participant
    ])
    database.session.flush()

    await sio.emit('user.conferences_count.updated', { 'conferences_count': requester.conferences_count }, room=str(requester.uuid))
    await sio.emit('user.conferences_count.updated', { 'conferences_count': participant.conferences_count }, room=str(participant.uuid))

    conference_references = [
        requester_conference_reference,
        participant_conference_reference
    ]

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
            }
        }

        await sio.emit('secret.chat.started', c, room=str(conference_reference.user.uuid))

    json['conference'] = {
        'uuid': str(conference.uuid),
        'type': conference.type,
        'updated_at': requester_conference_reference.updated_at.timestamp(),
        'messages_count': requester_conference_reference.messages_count,
        'unread_messages_count': requester_conference_reference.unread_messages_count,
        'participant': {
            'uuid': str(requester_conference_reference.participant.uuid),
            'name': requester_conference_reference.participant.name,
            'public_key': requester_conference_reference.participant.public_key
        }
    }

    return json


@sio.on('secret.message.sent')
async def send_secret_message(sid, data):
    json = {}

    v = cerberus.Validator()

    v.schema = {
        'to': {
            'type': 'UUID',
            'required': True,
            'coerce': UUID
        },
        'encrypted': {
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
                Conference.type == 'secret',
                Conference_Reference.conference_uuid == Conference.uuid,
                Conference_Reference.user_uuid == sender.uuid,
                Conference_Reference.participant_uuid == receiver.uuid
            )) \
            .one_or_none()

    if not conference:
        json['errors'] = { 'conference': "Secret conference doesn't exist" }

        return json

    message = Message(
        uuid=uuid4(),
        conference=conference,
        author_uuid=sender.uuid,
        type='text/plain',
        content=data['encrypted'],
        edited=False
    )

    sender_message_reference = Message_Reference(user_uuid=sender.uuid, message=message)
    receiver_message_reference = Message_Reference(user=receiver, message=message)

    database.session.add(message)
    database.session.flush()

    database.session.add(sender_message_reference)
    database.session.add(receiver_message_reference)
    database.session.flush()

    conference_references = database.session.query(Conference_Reference).filter(Conference_Reference.conference_uuid == conference.uuid).all()

    sender_conference_reference = [cr for cr in conference_references if cr.user_uuid == sender.uuid][0]
    receiver_conference_reference = [cr for cr in conference_references if cr.user_uuid == receiver.uuid][0]

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
                'read': message.read,
                'readAt': message.read_at.timestamp() if message.read_at is not None else message.read_at,
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
            'read': message.read,
            'readAt': message.read_at.timestamp() if message.read_at is not None else message.read_at,
            'date': message.date.timestamp(),
            'type': message.type,
            'content': message.content,
            'consumed': message.consumed,
            'edited': message.edited
        }

        await sio.emit('secret.message.sent', m, room=str(conference_reference.user.uuid))

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
        'read': message.read,
        'readAt': message.read_at.timestamp() if message.read_at is not None else message.read_at,
        'date': message.date.timestamp(),
        'type': message.type,
        'content': message.content,
        'consumed': message.consumed,
        'edited': message.edited
    }

    return json

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
                Conference.type == 'private',
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
                'read': message.read,
                'readAt': message.read_at.timestamp() if message.read_at is not None else message.read_at,
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
            'read': message.read,
            'readAt': message.read_at.timestamp() if message.read_at is not None else message.read_at,
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
        'read': message.read,
        'readAt': message.read_at.timestamp() if message.read_at is not None else message.read_at,
        'date': message.date.timestamp(),
        'type': message.type,
        'content': message.content,
        'consumed': message.consumed,
        'edited': message.edited
    }

    return json

@sio.on('read.message')
async def read_message(sid, data):
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
        json['errors'] = v.errors

        return json

    user = await sio.get_session(sid)

    message = database.session.query(Message).filter(Message.uuid == data['message']).one_or_none()

    if not message:
        json['errors'] = { 'message': "Message doesn't exist" }

        return json

    if message.author.uuid == user['uuid']:
        json['errors'] = { 'message': "You're author of this message" }

        return json

    if message.read:
        json['errors'] = { 'message': "Message already read" }

        return json

    message_reference = database.session.query(Message_Reference) \
        .filter(Message_Reference.message_uuid == message.uuid, Message_Reference.user_uuid == user['uuid']) \
        .one_or_none()

    if not message_reference:
        json['errors'] = { 'message': "Message doesn't exists" }

        return json

    message.read = True
    message.read_at = datetime.datetime.utcnow()

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
                'read': conference_reference.last_message.read,
                'readAt': conference_reference.last_message.read_at.timestamp() if conference_reference.last_message.read_at is not None else conference_reference.last_message.read_at,
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
            'read': message.read,
            'readAt': message.read_at.timestamp() if message.read_at is not None else message.read_at,
            'date': message.date.timestamp(),
            'type': message.type,
            'content': message.content,
            'consumed': message.consumed,
            'edited': message.edited
        }

        await sio.emit('message.read', m, room=str(cr.user.uuid))

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
        'read': message.read,
        'readAt': message.read_at.timestamp() if message.read_at is not None else message.read_at,
        'date': message.date.timestamp(),
        'type': message.type,
        'content': message.content,
        'consumed': message.consumed,
        'edited': message.edited
    }

    return json

@sio.on('read.messages.since')
async def read_messages_since(sid, data):
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
            Message.read == False,
            Message.date <= message.date
        ) \
        .all()

    for m in messages:
        m.read = True
        m.read_at = datetime.datetime.utcnow()

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
                'read': cr.last_message.read,
                'readAt': cr.last_message.read_at.timestamp() if conference_reference.last_message.read_at is not None else conference_reference.last_message.read_at,
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
                'read': m.read,
                'readAt': m.read_at.timestamp() if m.read_at is not None else m.read_at,
                'date': m.date.timestamp(),
                'type': m.type,
                'content': m.content,
                'consumed': m.consumed,
                'edited': m.edited
            })

        await sio.emit('messages.read.since', ms, room=str(cr.user.uuid))

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
            'read': m.read,
            'readAt': m.read_at.timestamp() if m.read_at is not None else m.read_at,
            'date': m.date.timestamp(),
            'type': m.type,
            'content': m.content,
            'consumed': m.consumed,
            'edited': m.edited
        })

    return json

@sio.on('write.to.user')
async def write_to_user(sid, data):
    json = {}

    v = cerberus.Validator()

    v.schema = {
        'user': {
            'type': 'UUID',
            'required': True,
            'coerce': UUID
        }
    }

    if not v.validate(data):
        result['errors'] = v.errors

        return result

    user = await sio.get_session(sid)

    receiver = database.session.query(User).get(data['user'])

    if not receiver:
        json['errors'] = { 'to': "Reciever doesn't exist" }

        return json

    u = {
        'uuid': user['uuid'],
        'name': user['name'],
        'public_key': user['public_key']
    }

    await sio.emit('wrote.to.user', u, room=str(receiver.uuid))

    json['user'] = {
        'uuid': str(receiver.uuid),
        'name': receiver.name,
        'public_key': receiver.public_key
    }

    return json

@sio.on('write.to.secret.conference')
async def write_to_secret_conference(sid, data):
    json = {}

    v = cerberus.Validator()

    v.schema = {
        'conference': {
            'type': 'UUID',
            'required': True,
            'coerce': UUID
        }
    }

    if not v.validate(data):
        json['errors'] = v.errors

        return json

    user = await sio.get_session(sid)

    conference = database.session.query(Conference).get(data['conference'])

    if not conference:
        json['errors'] = { 'conference': "Conference doesn't exist" }

        return json

    conference_reference = database.session.query(Conference_Reference).filter(and_(
        Conference_Reference.user_uuid == user['uuid'],
        Conference_Reference.conference_uuid == conference.uuid
    )).one_or_none()

    if not conference_reference:
        json['errors'] = { 'conference': "Conference doesn't exist" }

        return json

    u = {
        'uuid': user['uuid'],
        'name': user['name'],
        'public_key': user['public_key']
    }

    conference_references = database.session.query(Conference_Reference).filter(Conference_Reference.conference_uuid == conference.uuid).all()

    for cr in conference_references:
        if cr.user_uuid != user['uuid']:
            await sio.emit('wrote.to.secret.conference', u, room=str(cr.user_uuid))

    json['conference'] = {
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
    }

    if conference_reference.last_message is not None:
        last_message = conference_reference.last_message

        json['conference']['last_message'] = {
            'uuid': str(last_message.uuid),
            'author': {
                'uuid': str(last_message.author.uuid),
                'name': last_message.author.name,
                'public_key': last_message.author.public_key
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
            'read': last_message.read,
            'readAt': last_message.read_at.timestamp() if last_message.read_at is not None else last_message.read_at,
            'date': last_message.date.timestamp(),
            'type': last_message.type,
            'content': last_message.content,
            'consumed': last_message.consumed,
            'edited': last_message.edited
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
