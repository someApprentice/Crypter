import os

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DB_USER = os.getenv('DB_USER')
DB_PASSWORD = os.getenv('DB_PASSWORD')
DB_NAME = os.getenv('DB_NAME')

engine = create_engine("postgresql+psycopg2://{username}:{password}@/{database}?host=localhost".format(username=DB_USER, password=DB_PASSWORD, database=DB_NAME))

Base = declarative_base()

Session = sessionmaker(bind=engine)

session = Session()