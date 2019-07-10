import { RxJsonSchema } from 'rxdb';

import { Conference } from '../../../models/Conference'

const conferenceSchema: RxJsonSchema<Conference> = {
  version: 0,
  type: 'object',
  properties: {
    uuid: {
      type: 'string',
      primary: true
    },
    updated: {
      type: 'number',
      index: true
    },
    count: {
      type: 'number'
    },
    unread: {
      type: 'number'
    },
    participant: {
      type: 'object',
      properties: {
        uuid: {
          type: 'string'
        },
        name: {
          type: 'string'
        }
      },
      required: ['uuid', 'name']
    }
  },
  required: ['uuid', 'updated', 'count', 'unread']
};

export default conferenceSchema;