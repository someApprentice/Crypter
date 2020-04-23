import { RxJsonSchema } from 'rxdb';

import { User } from '../../../models/user.model';

const userSchema: RxJsonSchema<User> = {
  version: 0,
  type: 'object',
  properties: {
    uuid: {
      type: 'string',
      primary: true
    },
    email: {
      type: 'string'
    },
    name: {
      type: 'string'
    },
    hash: {
      type: 'string'
    },
    last_seen: {
      type: 'number'
    },
    public_key: {
      type: 'string'
    },
    private_key: {
      type: 'string'
    },
    revocation_certificate: {
      type: 'string'
    }
  },
  required: [ 'uuid', 'name' ]
};

export default userSchema;
