import { RxJsonSchema } from 'rxdb';

import { MessageDocType } from '../documents/message.document';

const messageSchema: RxJsonSchema<MessageDocType> = {
  version: 0,
  type: 'object',
  properties: {
    uuid: {
      type: 'string',
      primary: true
    },
    conference: {
      ref: 'conferences',
      type: 'string'
    },
    author: {
      ref: 'users',
      type: 'string'
    },
    readed: {
      type: 'boolean'
    },
    readedAt: {
      type: ['number', 'null'],
    },
    type: {
      type: 'string'
    },
    date: {
      type: 'number',
      index: true
    },
    content: {
      type: 'string'
    },
    consumed: {
      type: ['boolean', 'null']
    },
    edited: {
      type: ['boolean', 'null']
    }
  },
  required: ['uuid', 'author', 'conference', 'readed', 'type', 'date', 'content']
};

export default messageSchema;
