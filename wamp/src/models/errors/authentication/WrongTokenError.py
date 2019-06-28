class WrongTokenError(Exception):
    def __init__(self):
        self.message = "Access denied: Wrong token"

        super().__init__(self.message)