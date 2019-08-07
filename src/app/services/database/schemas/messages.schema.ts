import { RxJsonSchema } from 'rxdb';

import { Message } from '../../../models/Message'

const messagesSchema: RxJsonSchema<Message> = {
  version: 0,
  type: 'object',
  properties: {
    uuid: {
      type: 'string',
      primary: true
    },
    author: {
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
    },
    conference: {
      type: 'object',
      properties: {
        uuid: {
          type: 'string'
        },
        participant: {
          type: 'string'
        }
      },
      required: ['uuid']
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

export default messagesSchema;