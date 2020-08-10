import uuid
import datetime

from sqlalchemy import Column
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, ENUM, TIMESTAMP

from database import Base

# from user import User
# from participant import Participant
from message import Message
from message_reference import Message_Reference

class Conference(Base):
    __tablename__ = 'conference'

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type = Column(ENUM('private', 'public', 'secret', name="conference_type", create_type=False))
    created_at =  Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.datetime.utcnow)

    # user = relationship("User", back_populates="conference")

    participants = relationship("User",
        secondary="join(User, Participant, User.uuid == Participant.user_uuid)",
        primaryjoin="Participant.conference_uuid == Conference.uuid",
        secondaryjoin="Participant.conference_uuid == Conference.uuid"
    )

    messages = relationship("Message",
        secondary="join(Message, Message_Reference, Message.uuid == Message_Reference.message_uuid)",
        primaryjoin="Message.conference_uuid == Conference.uuid",
        secondaryjoin="Message.conference_uuid == Conference.uuid",
        # back_populates="user"
    )
