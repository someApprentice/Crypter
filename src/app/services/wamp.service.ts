import { Injectable } from '@angular/core';

import { Client } from 'thruway.js';
 
@Injectable()
export class WampService extends Client {
    constructor() {
        // https://github.com/voryx/thruway.js/blob/1670665fc215e598704a4c85601fbb8f5399ca7f/src/Transport/WebSocketTransport.ts#L88
        // Why is it in source code? console.log('socket opened');
        super('ws://localhost/wamp', 'realm1', {
            authmethods: ['anonymous'],
            role: 'user',
            authextra: {
                //'super' must be called before accessing 'this' in the constructor of a derived class.
                //'Bearer token': this.token
                'Bearer token': localStorage.jwt
            }
        });
    }
}