import { RxJsonSchema } from 'rxdb';

import { ConferenceDocType } from './../documents/conference.document';

const conferenceSchema: RxJsonSchema<ConferenceDocType> = {
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
      ref: 'users',
      type: 'string'
    }
  },
  required: ['uuid', 'updated', 'count', 'unread']
};

export default conferenceSchema;
