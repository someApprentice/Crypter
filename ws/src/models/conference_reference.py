import uuid
import datetime

from sqlalchemy import Column, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, INTEGER, TIMESTAMP

from database import Base

# from user import User
# from conference import Conference

class Conference_Reference(Base):
    __tablename__ = 'conference_reference'

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_uuid = Column('user', UUID(as_uuid=True), ForeignKey('user.uuid'), nullable=False)
    conference_uuid = Column('conference', UUID(as_uuid=True), ForeignKey('conference.uuid'), nullable=False)
    messages_count = Column(INTEGER, nullable=False, default=0)
    unread_messages_count = Column(INTEGER, nullable=False, default=0)
    participant_uuid = Column('participant', UUID(as_uuid=True), ForeignKey('user.uuid'))
    updated_at =  Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.datetime.utcnow)
    last_message_uuid = Column('last_message', UUID(as_uuid=True), ForeignKey('message.uuid'))

    user = relationship("User", foreign_keys=[user_uuid])
    conference = relationship("Conference")
    participant = relationship("User", foreign_keys=[participant_uuid])
    last_message = relationship("Message", foreign_keys=[last_message_uuid])
