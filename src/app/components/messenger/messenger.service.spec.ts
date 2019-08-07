import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { MessengerService } from './messenger.service';

import { AuthService } from '../auth/auth.service';

import { User } from '../../models/User';

import { Conference } from '../../models/Conference';
import { Message } from '../../models/Message';

describe('MessengerService', () => {
  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;

  let service: MessengerService;
  let authService: AuthService;

  let authServiceStub: Partial<AuthService>;

  beforeEach(() => {
    authServiceStub = {
      user: <User> {
        uuid: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        email: 'tester@crypter.com',
        name: 'Tester',
        jwt: 'BmsjIrAJvqz9V3HD8GlQwMXKMJ4Qm_NHLOQWiUZO_HY'
      }
    };

    TestBed.configureTestingModule({
      imports: [ HttpClientTestingModule ],
      providers: [ { provide: AuthService, useValue: authServiceStub } ]
    });

    httpClient = TestBed.get(HttpClient);
    httpTestingController = TestBed.get(HttpTestingController);

    service = TestBed.get(MessengerService);
    authService = TestBed.get(AuthService);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should retrive conferences', () => {
    let conferences: Conference[] = [
      {
        "uuid":"04ba1734-1a03-494c-b608-ea2e88412210",
        "updated":1560276253,
        "count": 0,
        "unread":0,
        "participant":{
          "uuid":"ea155bbf-726a-4f11-a2b6-f8bf04331d4d",
          "name":"Alice"
        },
        "participants":[
          {
            "uuid":"1e98abc0-bde3-4b7a-a51c-cfa8a2d9ddda",
            "name":"Tester"
          },
          {
            "uuid":"ea155bbf-726a-4f11-a2b6-f8bf04331d4d",
            "name":"Alice"
          }
        ],
        "messages":[]
      },
      {
        "uuid":"62212a71-acb8-4dc5-b1fe-63cf538182f2",
        "updated":1560541328,
        "count": 0,
        "unread":0,
        "participant":{
          "uuid":"3ddfeb6e-ce7a-4e1e-808c-85a2a0d3d5e9",
          "name":"Bob"
        },
        "participants":[
          {
            "uuid":"1e98abc0-bde3-4b7a-a51c-cfa8a2d9ddda",
            "name":"Tester"
          },
          {
            "uuid":"3ddfeb6e-ce7a-4e1e-808c-85a2a0d3d5e9",
            "name":"Bob"
          }
        ],
        "messages":[]
      }
    ];

    service.getConferences().subscribe(d => {
      expect(d).toEqual(conferences);
    });

    let req = httpTestingController.expectOne('/api/messenger/messages');

    expect(req.request.method).toEqual('GET');
    expect(req.request.headers.has('Authorization')).toBeTruthy();
    expect(req.request.headers.get('Authorization')).toEqual(`Bearer ${authService.user.jwt}`);

    req.flush(conferences);
  });

  it('should retrive conference', () => {
    let conference: Conference = {
      "uuid":"14e5cf2b-4d63-43c2-85bb-fbf37f4fbe87",
      "updated":1560276253,
      "count": 0,
      "unread":0,
      "participant":{
        "uuid":"ea155bbf-726a-4f11-a2b6-f8bf04331d4d",
        "name":"Alice"
      },
      "participants":[
        {
          "uuid":"1e98abc0-bde3-4b7a-a51c-cfa8a2d9ddda",
          "name":"Tester"
        },
        {
          "uuid":"ea155bbf-726a-4f11-a2b6-f8bf04331d4d",
          "name":"Alice"
        }
      ],
      "messages":[]
    };

    service.getConference("14e5cf2b-4d63-43c2-85bb-fbf37f4fbe87").subscribe(d => {
      expect(d).toEqual(conference);
    });

    let req = httpTestingController.expectOne('/api/messenger/messages');

    expect(req.request.method).toEqual('GET');
    expect(req.request.headers.has('Authorization')).toBeTruthy();
    expect(req.request.headers.get('Authorization')).toEqual(`Bearer ${authService.user.jwt}`);

    req.flush(conference);
  });

  it('should retrive messages', () => {
    let messages: Message[] = [
      {
        "uuid":"9d3ceafd-1a0d-416a-b99f-26e2793db62b",
        "author":{
          "uuid":"ea155bbf-726a-4f11-a2b6-f8bf04331d4d",
          "name":"Alice"
        },
        "conference": {
          "uuid": "14e5cf2b-4d63-43c2-85bb-fbf37f4fbe87"
        },
        "readed":false,
        "date":1559016403,
        "type":"text\/plain",
        "content":"Hey, Bob",
        "consumed":null,
        "edited":false
      },
      {
        "uuid":"4c98ed1e-253a-436e-8497-44a1db99f9c9",
        "author":{
          "uuid":"3ddfeb6e-ce7a-4e1e-808c-85a2a0d3d5e9",
          "name":"Bob"
        },
        "conference": {
          "uuid": "14e5cf2b-4d63-43c2-85bb-fbf37f4fbe87"
        },
        "readed":false,
        "date":1559016403,
        "type":"audio\/ogg",
        "content":"path\/to\/Hey_Alice.ogg",
        "consumed":false,
        "edited":null
      }
    ];

    service.getMessages().subscribe(d => {
      expect(d).toEqual(messages);
    });

    let req = httpTestingController.expectOne('/api/messenger/messages');

    expect(req.request.method).toEqual('GET');
    expect(req.request.headers.has('Authorization')).toBeTruthy();
    expect(req.request.headers.get('Authorization')).toEqual(`Bearer ${authService.user.jwt}`);

    req.flush(messages);
  });

  it('should retrive messages by conference', () => {
    let messages: Message[] = [
      {
        "uuid":"9d3ceafd-1a0d-416a-b99f-26e2793db62b",
        "author":{
          "uuid":"ea155bbf-726a-4f11-a2b6-f8bf04331d4d",
          "name":"Alice"
        },
        "conference": {
          "uuid": "14e5cf2b-4d63-43c2-85bb-fbf37f4fbe87"
        },
        "readed":false,
        "date":1559016403,
        "type":"text\/plain",
        "content":"Hey, Bob",
        "consumed":null,
        "edited":false
      },
      {
        "uuid":"4c98ed1e-253a-436e-8497-44a1db99f9c9",
        "author":{
          "uuid":"3ddfeb6e-ce7a-4e1e-808c-85a2a0d3d5e9",
          "name":"Bob"
        },
        "conference": {
          "uuid": "14e5cf2b-4d63-43c2-85bb-fbf37f4fbe87"
        },
        "readed":false,
        "date":1559016403,
        "type":"audio\/ogg",
        "content":"path\/to\/Hey_Alice.ogg",
        "consumed":false,
        "edited":null
      }
    ];

    service.getMessagesByConference("14e5cf2b-4d63-43c2-85bb-fbf37f4fbe87").subscribe(d => {
      expect(d).toEqual(messages);
    });

    let req = httpTestingController.expectOne('/api/messenger/messages');

    expect(req.request.method).toEqual('GET');
    expect(req.request.headers.has('Authorization')).toBeTruthy();
    expect(req.request.headers.get('Authorization')).toEqual(`Bearer ${authService.user.jwt}`);

    req.flush(messages);
  });
});