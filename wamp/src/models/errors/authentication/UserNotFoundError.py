class UserNotFoundError(Exception):
    def __init__(self):
        self.message = "Access denied: No such user"

        super().__init__(self.message)