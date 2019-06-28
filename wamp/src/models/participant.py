import uuid

from sqlalchemy import Column, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from database import Base, session

# from conference import Conference
# from user import User
# from message import Message
# from message_reference import Message_Reference


class Participant(Base):
    __tablename__ = 'participant'

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conference_uuid = Column('conference', UUID(as_uuid=True), ForeignKey('conference.uuid'), nullable=False)
    user_uuid = Column('user', UUID(as_uuid=True), ForeignKey('user.uuid'), nullable=False)

    conference = relationship("Conference")
    user = relationship("User")
    messages = relationship("Message",
        secondary="join(Message, Message_Reference, Message.uuid == Message_Reference.message_uuid)",
        primaryjoin="Message_Reference.user_uuid == Participant.user_uuid",
        secondaryjoin="Message_Reference.user_uuid == Participant.user_uuid"
    )