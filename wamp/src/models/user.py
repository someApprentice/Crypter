import uuid

from sqlalchemy import Column
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, VARCHAR

from database import Base

from conference import Conference
from conference_reference import Conference_Reference

class User(Base):
    __tablename__ = 'user'

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(VARCHAR(255), nullable=False)
    name = Column(VARCHAR(255), nullable=False)
    hash = Column(VARCHAR(60), nullable=False)

    conferences = relationship("Conference",
        secondary="join(Conference, Conference_Reference, Conference.uuid == Conference_Reference.conference_uuid)",
        primaryjoin="Conference_Reference.user_uuid == User.uuid",
        secondaryjoin="Conference_Reference.user_uuid == User.uuid",
        # back_populates="user"
    )