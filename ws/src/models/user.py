import uuid
import datetime

from sqlalchemy import Column
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, INTEGER, VARCHAR, TEXT, TIMESTAMP

from database import Base

from conference import Conference
from conference_reference import Conference_Reference

class User(Base):
    __tablename__ = 'user'

    uuid = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(VARCHAR(255), nullable=False)
    name = Column(VARCHAR(255), nullable=False)
    hash = Column(VARCHAR(60), nullable=False)
    last_seen = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.datetime.utcnow)
    conferences_count = Column(INTEGER, nullable=False, default=0)
    fingerprint = Column(VARCHAR(255), nullable=False)
    public_key = Column(TEXT, nullable=False)
    private_key = Column(TEXT, nullable=False)
    revocation_certificate = Column(TEXT, nullable=False)

    conferences = relationship("Conference",
        secondary="join(Conference, Conference_Reference, Conference.uuid == Conference_Reference.conference_uuid)",
        primaryjoin="Conference_Reference.user_uuid == User.uuid",
        secondaryjoin="Conference_Reference.user_uuid == User.uuid",
        # back_populates="user"
    )
