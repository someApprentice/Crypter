import { async, inject, ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';


import { Subscriber, Subject } from 'rxjs';

import { hot, cold, getTestScheduler } from 'jasmine-marbles';


import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { RouterTestingModule } from '@angular/router/testing';

import { BrowserTransferStateModule } from '@angular/platform-browser';

import { DatabaseService } from '../../../services/database.service';

import { MessengerComponent } from '../messenger.component';
import { ConferencesComponent } from './conferences.component';

import { Conference } from '../../../models/conference.model';
import { Message } from '../../../models/message.model';

describe('ConferencesComponent', () => {
  let httpTestingController: HttpTestingController;

  let databaseService: DatabaseService;

  let component: ConferencesComponent;
  let fixture: ComponentFixture<ConferencesComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ConferencesComponent ],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        BrowserTransferStateModule
      ],
      providers: [ DatabaseService ]
    })
    .compileComponents();

    databaseService = TestBed.get(DatabaseService);

    // LOG: DatabaseService{$: Observable{_isScalar: false, source: Observable{_isScalar: ..., source: ..., operator: ...}, operator: function shareReplayOperation(source) { ... }}}
    console.log(databaseService)

    httpTestingController = TestBed.get(HttpTestingController);

    fixture = TestBed.createComponent(ConferencesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  // ???
  // Failed: StaticInjectorError(DynamicTestModule)[DatabaseService]: 
  //   StaticInjectorError(Platform: core)[DatabaseService]: 
  //     NullInjectorError: No provider for DatabaseService!
  it('should create', inject([DatabaseService], (databaseService: DatabaseService) => {
    expect(component).toBeTruthy();
  }));


  it('should upsert conferences to IndexeDB from api and render them', () => {
    let conferences: Conference[] = [
      {
        "uuid":"04ba1734-1a03-494c-b608-ea2e88412210",
        "type": "private",
        "updated_at":1560276253,
        "messages_count": 0,
        "unread_messages_count":0,
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
        ]
      },
      {
        "uuid":"62212a71-acb8-4dc5-b1fe-63cf538182f2",
        "type": "private",
        "updated_at":1560541328,
        "messages_count": 0,
        "unread_messages_count":0,
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
        ]
      }
    ];

    let req = httpTestingController.expectOne('/api/messenger/conferences');

    req.flush(conferences);

    fixture.detectChanges();


    databaseService.getConferences().subscribe((conferences: Conference[]) => {
      expect(conferences.length).toEqual(2);
    });


    let elementsDe = fixture.debugElement.queryAll(By.css('li'));
    expect(elementsDe.length).toEqual(2);
  });

  it('should retrive conferences from IndexeDB and push or update them in template', () => {
    component.conferences.push(
      <Conference> {
        "uuid":"04ba1734-1a03-494c-b608-ea2e88412210",
        "type": "private",
        "updated_at":1560276253,
        "messages_count": 0,
        "unread_messages_count":0,
        "participant":{
          "uuid":"ea155bbf-726a-4f11-a2b6-f8bf04331d4d",
          "name":"Alice"
        }
      }
    );

    databaseService.upsertConference(
      <Conference> {
        "uuid":"62212a71-acb8-4dc5-b1fe-63cf538182f2",
        "type": "private",
        "messages_count": 0,
        "updated_at":1560541328,
        "unread_messages_count":0,
        "participant":{
          "uuid":"3ddfeb6e-ce7a-4e1e-808c-85a2a0d3d5e9",
          "name":"Bob"
        }
      }
    ).subscribe();

    fixture.detectChanges();

    let elementsDe = fixture.debugElement.queryAll(By.css('li'));
    expect(elementsDe.length).toEqual(2);

    databaseService.upsertConference(
      <Conference> {
        "uuid":"62212a71-acb8-4dc5-b1fe-63cf538182f2",
        "type": "private",
        "updated_at":Math.round((new Date()).getTime() / 1000),
        "messages_count": 1,
        "unread_messages_count":1,
        "participant":{
          "uuid":"3ddfeb6e-ce7a-4e1e-808c-85a2a0d3d5e9",
          "name":"Bob"
        }
      }
    ).subscribe();

    // TODO: get element by id
    let listDe = fixture.debugElement.query(By.css('ul'));
    let list = listDe.nativeElement;

    // should contain updated conference with 1 unreaded message
    expect(list.textContent).toContain('Bob (1)');
  });


  // should upsert conference to IndexeDB from WAMP and render it
});
