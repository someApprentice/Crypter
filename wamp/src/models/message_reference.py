import uuid

from sqlalchemy import Column, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from database import Base

# from conference import Conference
# from participant import Participant
# from message import Message


class Message_Reference(Base):
    __tablename__ = 'message_reference'

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conference_uuid = Column('conference', UUID(as_uuid=True), ForeignKey('conference.uuid'), nullable=False)
    user_uuid = Column('user', UUID(as_uuid=True), ForeignKey('user.uuid'), nullable=False)
    message_uuid = Column('message', UUID(as_uuid=True), ForeignKey('message.uuid'), nullable=False)

    conference = relationship("Conference")
    user = relationship("User")
    message = relationship("Message", back_populates="message_references")