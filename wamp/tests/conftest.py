# pytest --rootdir=./wamp/tests/ --ignore=./wamp/venv --ignore=./node_modules -v -s
import pytest

import database

import contextlib
from sqlalchemy import MetaData

import uuid
import datetime

from user import User
from conference import Conference
from conference_reference import Conference_Reference
from participant import Participant
from message import Message
from message_reference import Message_Reference

@pytest.fixture
def populate_users():
    alice = User(uuid='ea155bbf-726a-4f11-a2b6-f8bf04331d4d', email='alice@crypter.com', name='Alice', hash='$2y$13$4f4Z7J6GkzJcNg2Rg81TAuWh8pXZIanYEk6q3zFAEl2Y95HKKPEei')
    bob = User(uuid='3ddfeb6e-ce7a-4e1e-808c-85a2a0d3d5e9', email='bob@crypter.com', name='Bob', hash='$2y$13$t8Q2cI3dXPiiSX5G8Toc7OlmTDLrqmqxuYFbamz4qmR3CYoCTarI6')

    database.session.add_all([
        alice,
        bob
    ])

    database.session.commit()

    # teardown
    yield (alice, bob)

    database.session.execute('TRUNCATE TABLE "user" CASCADE')
    database.session.commit()

@pytest.fixture
def populate_conference(populate_users):
    alice, bob = populate_users

    sender = alice
    receiver = bob

    conference = Conference(uuid=uuid.uuid4(), updated=datetime.datetime.utcnow() - datetime.timedelta(days=1))
    sender_conference_reference = Conference_Reference(user=sender, conference=conference, participant=receiver)
    receiver_conference_reference = Conference_Reference(user=receiver, conference=conference, participant=sender)
    sender_participant = Participant(conference=conference, user=sender)
    receiver_participant = Participant(conference=conference, user=receiver)

    database.session.add(conference)
    database.session.flush()

    database.session.add(sender_conference_reference)
    database.session.add(receiver_conference_reference)
    database.session.add(sender_participant)
    database.session.add(receiver_participant)
    database.session.flush()

    database.session.commit()

    yield (alice, bob, conference, sender_conference_reference, receiver_conference_reference, sender_participant, receiver_participant)

    database.session.execute('TRUNCATE TABLE conference, conference_reference, participant CASCADE')
    database.session.commit()