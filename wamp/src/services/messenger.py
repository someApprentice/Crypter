from uuid import UUID, uuid4
import datetime

import cerberus, validator
import database
import authenticator

from sqlalchemy.orm import aliased
from sqlalchemy.sql import exists
from sqlalchemy.sql.expression import and_

from user import User
from conference import Conference
from conference_reference import Conference_Reference
from participant import Participant
from message import Message
from message_reference import Message_Reference

class Messenger():
    def write(data):
        result = {
            'data': data,
            'user': {},
            'conference': {},
            'errors': {}
        }

        v = cerberus.Validator()

        v.schema = {
            'user': {
                'type': 'UUID',
                'required': True,
                'coerce': UUID
            },
            'to': {
                'type': 'UUID',
                'required': True,
                'coerce': UUID
            },
            'Bearer token': {
                'type': 'string',
                'required': True
            }
        }

        if not v.validate(data):
            result['errors'] = v.errors

            return result

        user = authenticator.authenticate(data['Bearer token'])

        conference = database.session.query(Conference).join(Conference_Reference).filter(and_(Conference_Reference.conference_uuid == Conference.uuid, Conference_Reference.user_uuid == user.uuid, Conference_Reference.participant_uuid == data['to'])).one_or_none()

        if not conference:
            result['errors'] = { 'conference': 'Conference does not exist' }

            return result

        conference_reference = database.session.query(Conference_Reference).filter(and_(Conference_Reference.participant_uuid == data['to'], Conference_Reference.user_uuid == user.uuid)).one_or_none()

        if not conference_reference:
            result['errors'] = { 'conference': 'You do not have this conference' }

            return result



        result['user'] = {
            'uuid': str(user.uuid),
            'name': user.name
        }
        result['conference'] = {
            'uuid': str(conference.uuid),
            'updated': conference.updated.timestamp(),
            'participants': []
        }

        for participant in conference.participants:
            result['conference']['participants'].append(
                {
                    'uuid': str(participant.uuid),
                    'name': participant.name
                }
            )

        return result;

    def read_message(data):
        result = {
            'data': data,
            'message': None,
            'conference': None,
            'conference_references': [],
            'errors': {}
        }

        v = cerberus.Validator()

        v.schema = {
            'by': {
                'type': 'UUID',
                'required': True,
                'coerce': UUID
            },
            'message': {
                'type': 'UUID',
                'required': True,
                'coerce': UUID
            },
            'Bearer token': {
                'type': 'string',
                'required': True
            }
        }

        if not v.validate(data):
            result['errors'] = v.errors

            return result


        user = authenticator.authenticate(data['Bearer token'])

        message = database.session.query(Message).filter(Message.uuid == data['message']).one_or_none()


        if not message:
            result['errors'] = { 'message': "Message doesn't exists" }

            return result

        if message.author.uuid == user.uuid:
            result['errors'] = { 'message': "You're author of this message" }

            return result

        if message.readed:
            result['errors'] = { 'message': "Message already readed" }

            return result


        message_reference = None

        for mr in message.message_references:
            if mr.user_uuid == user.uuid:
                message_reference = mr

                break

        if not message_reference:
            result['errors'] = { 'message': "Message doesn't exists" }

            return result


        message.readed = True
        message.readed_at = datetime.datetime.utcnow()

        database.session.add(message)

        database.session.flush()

        conference_reference = database.session.query(Conference_Reference).filter(and_(Conference_Reference.conference_uuid == message_reference.conference_uuid, Conference_Reference.user_uuid == user.uuid)).one_or_none()

        if conference_reference:
            conference_reference.unread -= 1

            database.session.add(conference_reference)

            database.session.flush()


        database.session.commit()


        result['message'] = {
            'uuid': str(message.uuid),
            'author': {
                'uuid': str(message.author.uuid),
                'name':  message.author.name
            },
            'conference': {
                'uuid': str(conference_reference.conference.uuid)
            },
            'readed': message.readed,
            'readedAt': message.readed_at.timestamp() if message.readed_at is not None else message.readed_at,
            'date': message.date.timestamp(),
            'type': message.type,
            'content': message.content,
            'consumed': message.consumed,
            'edited': message.edited
        }
        result['conference'] = {
            'uuid': str(conference_reference.conference.uuid),
            'updated': conference_reference.conference.updated.timestamp(),
            'count': conference_reference.count,
            'unread': conference_reference.unread,
            'participant': {
                'uuid': str(conference_reference.participant.uuid),
                'name': conference_reference.participant.name
            },
            'participants': []
        }

        for participant in message_reference.conference.participants:
            result['conference']['participants'].append(
                {
                    'uuid': str(participant.uuid),
                    'name': participant.name
                }
            )

        conference_references = database.session.query(Conference_Reference).filter(Conference_Reference.conference_uuid == conference_reference.conference.uuid).all()

        for conference_reference in conference_references:
            result['conference_references'].append(
                {
                    'user': str(conference_reference.user_uuid),
                    'conference': str(conference_reference.conference_uuid),
                    'count': conference_reference.count,
                    'unread': conference_reference.unread,
                    'participant': {
                        'uuid': str(conference_reference.participant.uuid),
                        'name': conference_reference.participant.name
                    }
                },
            )

        return result;



    def send(data):
        result = {
            'data': data,
            'conference': None,
            'conference_references': [],
            'message': None,
            'errors': {}
        }

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
            },
            'Bearer token': {
                'type': 'string',
                'required': True
            }
        }

        if not v.validate(data):
            result['errors'] = v.errors

            return result

        sender = authenticator.authenticate(data['Bearer token'])

        receiver = database.session.query(User).get(data['to'])

        if not receiver:
            result['errors'] = { 'to': "Receiver doesn't exists" }

            return result

        # TODO: check for blacklist

        conference = database.session.query(Conference).join(Conference_Reference).filter(and_(Conference_Reference.conference_uuid == Conference.uuid, Conference_Reference.user_uuid == sender.uuid, Conference_Reference.participant_uuid == receiver.uuid)).one_or_none()
        
        if not conference:
            conference = Conference(uuid=uuid4())
            sender_conference_reference = Conference_Reference(user=sender, conference=conference, participant=receiver)
            receiver_conference_reference = Conference_Reference(user=receiver, conference=conference, participant=sender)
            sender_participant = Participant(conference=conference, user=sender)
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


        sender_conference_reference = database.session.query(Conference_Reference).filter(and_(Conference_Reference.user_uuid == sender.uuid, Conference_Reference.conference_uuid == conference.uuid)).one_or_none()

        # in case sender has deleted his own conference
        if not sender_conference_reference:
            sender_conference_reference = Conference_Reference(user=sender, conference=conference, participant=receiver)
            database.session.add(sender_conference_reference)
            database.session.flush()


        receiver_conference_reference = database.session.query(Conference_Reference).filter(and_(Conference_Reference.user_uuid == receiver.uuid, Conference_Reference.conference_uuid == conference.uuid)).one_or_none()

        # in case receiver has deleted his own conference
        if not receiver_conference_reference:
            receiver_conference_reference = Conference_Reference(user=receiver, conference=conference, participant=sender)
            database.session.add(receiver_conference_reference)
            database.session.flush()


        message = Message(uuid=uuid4(), author=sender, type='text/plain', content=data['text'], edited=False)
        sender_message_reference = Message_Reference(conference=conference, user=sender, message=message)
        receiver_message_reference = Message_Reference(conference=conference, user=receiver, message=message)

        database.session.add(message)
        database.session.flush()

        database.session.add(sender_message_reference)
        database.session.add(receiver_message_reference)
        database.session.flush()

        conference.updated = datetime.datetime.utcnow()

        sender_conference_reference.count += 1

        receiver_conference_reference.count += 1
        receiver_conference_reference.unread += 1

        database.session.add(conference)
        database.session.add(sender_conference_reference)
        database.session.add(receiver_conference_reference)
        database.session.flush()

        database.session.commit()

        result['data']['to'] = str(result['data']['to'])
        result['conference'] = {
            'uuid': str(conference.uuid),
            'updated': conference.updated.timestamp(),
            'count': sender_conference_reference.count,
            'unread': sender_conference_reference.unread, 
            'participant': {
                'uuid': str(receiver.uuid),
                'name': receiver.name
            },
            'participants': [
                {
                    'uuid': str(sender.uuid),
                    'name': sender.name
                },
                {
                    'uuid': str(receiver.uuid),
                    'name': receiver.name
                }
            ]
        }
        result['conference_references'] = [
            {
                'user': str(sender_conference_reference.user_uuid),
                'conference': str(sender_conference_reference.conference_uuid),
                'count': sender_conference_reference.count,
                'unread': sender_conference_reference.unread,
                'participant': {
                    'uuid': str(receiver.uuid),
                    'name': receiver.name
                }
            },
            {
                'user': str(receiver_conference_reference.user_uuid),
                'conference': str(receiver_conference_reference.conference_uuid),
                'count': receiver_conference_reference.count,
                'unread': receiver_conference_reference.unread,
                'participant': {
                    'uuid': str(sender.uuid),
                    'name': sender.name
                },
            }
        ]
        result['message'] = {
            'uuid': str(message.uuid),
            'author': {
                'uuid': str(sender.uuid),
                'name':  sender.name
            },
            'conference': {
                'uuid': str(conference.uuid)
            },
            'readed': message.readed,
            'readedAt': message.readed_at.timestamp() if message.readed_at is not None else message.readed_at,
            'date': message.date.timestamp(),
            'type': message.type,
            'content': message.content,
            'consumed': message.consumed,
            'edited': message.edited
        }

        return result
