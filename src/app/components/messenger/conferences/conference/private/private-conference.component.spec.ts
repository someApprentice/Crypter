import { async, inject, ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';


import { Subscriber, Subject, of } from 'rxjs';

import { hot, cold, getTestScheduler } from 'jasmine-marbles';

import { ReactiveFormsModule } from '@angular/forms';
import { AutofocusModule } from '../../../../../modules/autofocus/autofocus.module';

import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { BrowserTransferStateModule } from '@angular/platform-browser';

import { RouterTestingModule } from '@angular/router/testing'
import { Router, ActivatedRoute, Data, UrlSegment } from '@angular/router';

import { AuthService } from '../../../../auth/auth.service';

import { Client } from 'thruway.js';
import { ResultMessage } from 'thruway.js/src/Messages/ResultMessage';
import { WelcomeMessage } from 'thruway.js/src/Messages/WelcomeMessage';

import { DatabaseService } from '../../../../../services/database/database.service';


import { PrivateConferenceComponent } from './private-conference.component';

import { User } from '../../../../../models/User';
import { Conference } from '../../../../../models/Conference';
import { Message } from '../../../../../models/Message';

describe('PrivateConferenceComponent', () => {
  let activatedRoute: ActivatedRoute;
  let httpTestingController: HttpTestingController;

  let wampService: Client;
  let databaseService: DatabaseService;

  let authServiceStub: Partial<AuthService>;
  let activatedRouteStub: Partial<ActivatedRoute>;

  let conference: Conference;
  let message: Message;

  let component: PrivateConferenceComponent;
  let fixture: ComponentFixture<PrivateConferenceComponent>;

  beforeEach(async(() => {
    authServiceStub = {
      user: <User> {
        uuid: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        email: 'alice@crypter.com',
        name: 'Alice',
        jwt: 'BmsjIrAJvqz9V3HD8GlQwMXKMJ4Qm_NHLOQWiUZO_HY'
      }
    };

    conference = <Conference> {
      "uuid":"62212a71-acb8-4dc5-b1fe-63cf538182f2",
      "updated":1560541328,
      "count": 0,
      "unread":0,
      "participant":{
        "uuid":"3ddfeb6e-ce7a-4e1e-808c-85a2a0d3d5e9",
        "name":"Bob"
      }
    };

    message = <Message> {
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
    };

    activatedRouteStub = {
      data: of<Data>({}),
      url: of<UrlSegment[]>([ new UrlSegment('conference', { uuid: conference.uuid }) ])
    }

    function wampClientFactory() {
      const resultMessage = new ResultMessage(null, {}, [ message ], {});

      const messages = cold('--w-r|', {w: new WelcomeMessage(12345, {}), r: resultMessage});
      const subscriptions = '^---!';
      const expected = '----(d|)';

      const observer = new Subscriber(
        // (msg: any) => {
        //   resultMessage['_requestId'] = msg.requestId;
        //   recordWampMessage(msg);
        // }
      );

      const ws = Subject.create(observer, messages);
      ws.onOpen = new Subject();

      const client = new Client(ws, 'realm1', {});
    }

    TestBed.configureTestingModule({
      declarations: [ PrivateConferenceComponent ],
      imports: [
        ReactiveFormsModule,
        AutofocusModule,
        HttpClientTestingModule,
        BrowserTransferStateModule,
        RouterTestingModule.withRoutes(
          [
            { path: 'login', component: PrivateConferenceComponent, data: {} }
          ]
        ),
      ],
      providers: [
        { provide: AuthService, useValue: authServiceStub },
        { provide: Client, useFactory: wampClientFactory },
        { provide: ActivatedRoute, useValue: activatedRouteStub},
        DatabaseService
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrivateConferenceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should upsert conference to IndexeDB from API and render it information', () => {
    let req = httpTestingController.expectOne('/api/messenger/conference');

    req.flush(conference);

    fixture.detectChanges();

    let spanDe = fixture.debugElement.query(By.css('span'));
    let span = spanDe.nativeElement;

    let inputToDe = fixture.debugElement.query(By.css('input[name="to"]'));
    let inputTo = inputToDe.nativeElement;

    expect(span).toContain(conference.participant.name);
    expect(inputTo.value).toEqual(conference.participant.uuid);
  });

  it('should upsert messsages to IndexeDB from API and render them', () => {
    let conference = <Conference> {
      "uuid":"14e5cf2b-4d63-43c2-85bb-fbf37f4fbe87",
      "updated":1560541328,
      "count": 0,
      "unread":0,
      "participant":{
        "uuid":"3ddfeb6e-ce7a-4e1e-808c-85a2a0d3d5e9",
        "name":"Bob"
      }
    };

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

    let req = httpTestingController.expectOne(`/api/messenger/messages/${conference.uuid}`);

    req.flush(messages);

    fixture.detectChanges();

    let elementsDe = fixture.debugElement.queryAll(By.css('li'));

    expect(elementsDe.length).toEqual(2);
  });

  // should upsert conference to IndexeDB from WAMP and render it
  // should upsert message to IndexeDB from WAMP and render it

  it('should send message to WAMP, upsert into IndexeDB and render it', () => {
    getTestScheduler().flush();

    fixture.detectChanges();

    let listDe = fixture.debugElement.query(By.css('ul'));
    let list = fixture.nativeElement;

    expect(list.textContent).toContain(message.content);
  });
});
