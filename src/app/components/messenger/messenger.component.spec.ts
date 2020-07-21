import { async, fakeAsync, tick, ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { from, Subscriber, Subject } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { hot, cold, getTestScheduler } from 'jasmine-marbles';

import { ReactiveFormsModule } from '@angular/forms';
import { AutofocusModule } from '../../modules/autofocus/autofocus.module';

import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { BrowserTransferStateModule } from '@angular/platform-browser';

import { DatabaseService } from '../../services/database.service';
import RxDB, { RxDatabase } from 'rxdb';

import { AuthService } from '../auth/auth.service';
import { User } from '../../models/user.model';

import { MessengerComponent } from './messenger.component';

import { Conference } from '../../models/conference.model';
import { Message } from '../../models/message.model';


describe('MessengerComponent', () => {
  let httpTestingController: HttpTestingController;

  // let wampService: Client;
  let dataBaseService: DatabaseService;
  let authService: AuthService;

  let authServiceStub: Partial<AuthService>;

  let conference: Conference;
  let message: Message;

  let component: MessengerComponent;
  let fixture: ComponentFixture<MessengerComponent>;

  beforeEach(async(() => {
    authServiceStub = {
      user: <User> {
        uuid: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        email: 'alice@crypter.com',
        name: 'Alice',
        hash: 'BmsjIrAJvqz9V3HD8GlQwMXKMJ4Qm_NHLOQWiUZO_HY'
      }
    };

    conference = <Conference> {
      "uuid":"14e5cf2b-4d63-43c2-85bb-fbf37f4fbe87",
      "updated":1560541328,
      "unread":0,
      "participant":{
        "uuid":"3ddfeb6e-ce7a-4e1e-808c-85a2a0d3d5e9",
        "name":"Bob"
      }
    };

    message = <Message> {
      "uuid":"4c98ed1e-253a-436e-8497-44a1db99f9c9 ",
      "author":{
        "uuid":"3ddfeb6e-ce7a-4e1e-808c-85a2a0d3d5e9",
        "name":"Bob"
      },
      "conference": {
        "uuid": "14e5cf2b-4d63-43c2-85bb-fbf37f4fbe87"
      },
      "readed":false,
      "date":1559016403,
      "type":"text\/plain",
      "content":"Hey, Alice",
      "consumed":null,
      "edited":false
    };

    // https://github.com/voryx/thruway.js/blob/master/spec/client/client-spec.ts#L101-L121
    // function wampClientFactory() {
    //   const resultMessage = new ResultMessage(null, {}, [ conference ], {});

    //   const messages = cold('--w-r|', {w: new WelcomeMessage(12345, {}), r: resultMessage});
    //   const subscriptions = '^---!';
    //   const expected = '----(d|)';

    //   const observer = new Subscriber(
    //     // (msg: any) => {
    //     //   resultMessage['_requestId'] = msg.requestId;
    //     //   recordWampMessage(msg);
    //     // }
    //   );

    //   const ws = Subject.create(observer, messages);
    //   ws.onOpen = new Subject();

    //   const client = new Client(ws, 'realm1', {});
    // }

    // TestBed.configureTestingModule({
    //   declarations: [ MessengerComponent ],
    //   imports:      [
    //     BrowserTransferStateModule,
    //     HttpClientTestingModule,
    //   ],
    //   providers:    [ 
    //     { provide: AuthService, useValue: authServiceStub },
    //     { provide: Client, useFactory: wampClientFactory }
    //   ]
    // })
    // .compileComponents();

    // wampService = TestBed.get(Client);
    dataBaseService = TestBed.get(DatabaseService);
    authService = TestBed.get(AuthService);

    httpTestingController = TestBed.get(HttpTestingController);

    fixture = TestBed.createComponent(MessengerComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
  }));

  it('should create', () => {
      expect(component).toBeTruthy();
  });

  it('should upsert conference to IndexeDB from WAMP and render it', () => {
    getTestScheduler().flush();

    fixture.detectChanges();

    dataBaseService.getConference(conference.uuid).subscribe(c => {
      expect(c).toEqual(conference);
    });
  });

  // should upsert message to IndexeDB from WAMP and render it (how to emit different values for certain tests from wampClientFactory)?
});

