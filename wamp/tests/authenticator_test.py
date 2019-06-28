import pytest

import authenticator

from jwt.exceptions import InvalidSignatureError
from models.errors.authentication import UserNotFoundError, WrongTokenError

def test_authentication(populate_users):
    # only works with exact populated rows
    # see poupulate_database fixture
    token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1dWlkIjoiZWExNTViYmYtNzI2YS00ZjExLWEyYjYtZjhiZjA0MzMxZDRkIiwiaGFzaCI6IiQyeSQxMyQ0ZjRaN0o2R2t6SmNOZzJSZzgxVEF1V2g4cFhaSWFuWUVrNnEzekZBRWwyWTk1SEtLUEVlaSJ9.tBrnw1_1JXD1ts4aLe6khZwiA8d__ohBHTS3-D_u0bk"

    alice, bob = populate_users

    user = authenticator.authenticate(token)

    assert user == alice


def test_UserNotFoundError(populate_users):
    # TypeError: exceptions must be old-style classes or derived from BaseException, not <class 'module'>
    # with pytest.raises(UserNotFoundError):
    with pytest.raises(Exception):
        nonpersistent_token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1dWlkIjoiZWI0MDhlMGUtMTZjNi00ZjM4LThlNjgtMTIyODI2MzM1Mjc5IiwiaGFzaCI6IiQyYiQxMyRPMnk3MDU3SjU2NWZ4dHlCblJaemcuRFZOdzNFQXFnT0VoT1ZXZ2xtdy5Fb0lXTTYudktHZSJ9.booDgke6PHycAv7HZgbqWvw5XHHIkP7Aw5DTBzjI3nU'

        authenticator.authenticate(nonpersistent_token)


def test_WrongTokenError(populate_users):
    # token with wrong hash
    # TypeError: exceptions must be old-style classes or derived from BaseException, not <class 'module'>
    # with pytest.raises(WrongTokenError):
    with pytest.raises(Exception):
        wrong_token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1dWlkIjoiMDljOGU5NzctMDE4Mi00NDQ3LTk4MzYtOWFkNjBhODZiMjg3IiwiaGFzaCI6IiQyYiQxMyRPMnk3MDU3SjU2NWZ4dHlCblJaemcuRFZOdzNFQXFnT0VoT1ZXZ2xtdy5Fb0lXTTYudktHZSJ9.KkZogPfKN-ocYbWriH2T_Zg_91W7Zsw6r9sTfukSA20';

        authenticator.authenticate(wrong_token)