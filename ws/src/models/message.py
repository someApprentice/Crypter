import uuid
import datetime

from sqlalchemy import Column, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, BOOLEAN, VARCHAR, TEXT, TIMESTAMP

from database import Base

# from user import User


class Message(Base):
    __tablename__ = 'message'

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conference_uuid = Column('conference', UUID(as_uuid=True), ForeignKey('conference.uuid'), nullable=False)
    author_uuid = Column('author', UUID(as_uuid=True), ForeignKey('user.uuid'), nullable=False)
    readed = Column(BOOLEAN, nullable=False, default=False)
    readed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    date =  Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.datetime.utcnow)
    type = Column(VARCHAR, nullable=False)
    content = Column(TEXT, nullable=False)
    consumed = Column(BOOLEAN, nullable=True)
    edited = Column(BOOLEAN, nullable=True)

    conference = relationship("Conference")
    author = relationship("User")
    message_references = relationship("Message_Reference", back_populates="message")
