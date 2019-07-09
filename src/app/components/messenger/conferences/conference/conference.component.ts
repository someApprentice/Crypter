import { Component, Injector, Inject, ViewChild, ElementRef, QueryList, OnInit, AfterViewInit, AfterViewChecked, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { TransferState, makeStateKey, DOCUMENT } from '@angular/platform-browser';

import { Subscription, of, iif, throwError } from 'rxjs';
import { switchMap, map, tap, first } from 'rxjs/operators';

import { WampService } from '../../../../services/wamp.service'
import { EventMessage } from 'thruway.js/src/Messages/EventMessage'

import { MessengerService } from '../../messenger.service';

import { AuthService } from '../../../auth/auth.service';

import { DatabaseService } from '../../../../services/Database/database.service';
import { ConferenceDocument } from '../../../../services/Database/documents/conference.document';
import { MessageDocument } from '../../../../services/Database/documents/message.document';

import { Conference } from '../../../../models/Conference';
import { Message }  from '../../../../models/Message';

const CONFERENCE_STATE_KEY = makeStateKey('conference');
const MESSAGES_STATE_KEY = makeStateKey('messages');

@Component({
  selector: 'app-conference',
  templateUrl: './conference.component.html',
  styleUrls: ['./conference.component.css']
})
export class ConferenceComponent implements OnInit, AfterViewInit, AfterViewChecked, OnDestroy {
  @ViewChild('scroller') private scroller: ElementRef;
  previousScrollTop: number;
  previousScrollHeight: number;

  uuid?: string;

  conference?: Conference;
  messages: Message[] = [];
  
  error?: string;

  subscriptions$: { [key: string]: Subscription } = { };

  private wamp: WampService;
  private databaseService: DatabaseService;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private messengerService: MessengerService,
    private authService: AuthService,
    private state: TransferState,
    private route: ActivatedRoute,
    private injector: Injector,
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.wamp = injector.get(WampService);
      this.databaseService = injector.get(DatabaseService);
    }
  }

  ngOnInit() {
    this.subscriptions$['params'] = this.route.params.subscribe(params => {
      this.uuid = params['uuid'];
    });

    this.conference = this.state.get(CONFERENCE_STATE_KEY, undefined);    
    this.messages = this.state.get(MESSAGES_STATE_KEY, [] as Message[]);

    // get Conference from api
    // if it's a browser push it into indexeDB
    // if it's a server set it into conference property
    this.subscriptions$['messengerService.getConference'] = this.messengerService.getConference(this.uuid)
    .subscribe((conference: Conference) => {
      if (isPlatformBrowser(this.platformId)) {
        let c = <Conference> {
          uuid: conference.uuid,
          updated: conference.updated,
          count: conference.count,
          unread: conference.unread,
          participant: conference.participant
        };

        this.databaseService.upsertConference(c).subscribe();
      }

      if (isPlatformServer(this.platformId)) {
        this.conference = conference;
      }

      this.state.set(CONFERENCE_STATE_KEY, conference as Conference);
    });

    if (isPlatformBrowser(this.platformId)) {
      this.subscriptions$['databaseService.getConference'] = this.databaseService.getConference(this.uuid).subscribe((conference: Conference) => {
        this.conference = conference;
      });


      this.subscriptions$['databaseService.getMessagesByConference'] = this.databaseService.getMessagesByConference(this.uuid).subscribe((messages: Message[]) => {
        for (let message of messages) {
          this.messages.find(m => m.uuid == message.uuid) ? this.messages[this.messages.findIndex(m => m.uuid == message.uuid)] = message : this.messages.push(message);
        }

        this.messages.sort((a: Message, b: Message) => a.date - b.date);

        // needs to define wheather or not the scroll was at the bottom or not before messages bound into template - ngAfterViewChecked
        this.previousScrollTop = this.scroller.nativeElement.scrollTop;
        this.previousScrollHeight = this.scroller.nativeElement.scrollHeight;
      }); 
    }

    // get Messages from api
    // if it's a browser push them into indexeDB
    // if it's a server push them into messages array
    this.subscriptions$['messengerService.getMessagesByConference'] = this.messengerService.getMessagesByConference(this.uuid)
    .subscribe(
      (messages: Message[]) => {
        if (isPlatformBrowser(this.platformId)) {
          for (let message of messages) {
            this.databaseService.upsertMessage(message).subscribe();
          }
        }

        if (isPlatformServer(this.platformId)) {
          this.messages = messages;

          this.messages.sort((a: Message, b: Message) => a.date - b.date);
        }

        this.state.set(MESSAGES_STATE_KEY, messages as Message[]);

        this.scrollDown();
      },
      err => {
        if (err instanceof Error || 'message' in err) { // TypeScript instance of interface check
          this.error = err.message;
        }
      }
    );
  }

  onScrollUp(timestamp: number) {
    if (this.messages.length === this.conference.count) {
      return;
    }

    // first take messages from the local storage
    // then load the remaind messages from the API
    this.subscriptions$['databaseService.getOldMessagesByConference'] = this.databaseService.getOldMessagesByConference(this.uuid, timestamp).pipe(
      switchMap((dbMessages: Message[]) => {
          dbMessages.sort((a: Message, b: Message) => b.date - a.date);

          let timestamp = (dbMessages[0]) ? dbMessages[0].date : this.messages[0].date;

          return iif(
            () => dbMessages.length < DatabaseService.BATCH_SIZE,
            this.messengerService.getOldMessageByConference(this.uuid, timestamp, DatabaseService.BATCH_SIZE - dbMessages.length).pipe(
              tap((apiMessages: Message[]) => {
                for (let message of apiMessages) {
                  this.databaseService.upsertMessage(message).subscribe();
                }
              }),
              map((apiMessages: Message[]) => dbMessages.concat(apiMessages)),
              first()
            ), 
            of(dbMessages)
          )
        }
      )
    ).subscribe((messages: Message[]) => {
      for (let message of messages) {
        this.messages.find(m => m.uuid == message.uuid) ? this.messages[this.messages.findIndex(m => m.uuid == message.uuid)] = message : this.messages.unshift(message);
      }

      this.messages.sort((a: Message, b: Message) => a.date - b.date);
    });
  }

  onSent(message: Message) {}

  scrollDown() {
    this.scroller.nativeElement.scrollTop = this.scroller.nativeElement.scrollHeight;
  }

  ngAfterViewInit() {
    this.scrollDown();
  }

  ngAfterViewChecked() {
    // scroll down on new message if the scroll was at the bottom
    if (this.previousScrollTop + this.scroller.nativeElement.offsetHeight == this.previousScrollHeight) {
      this.scrollDown();

      // reset
      this.previousScrollTop = 0;
      this.previousScrollHeight = 0;
    }
  }  

  ngOnDestroy() {
    this.state.remove(CONFERENCE_STATE_KEY);
    this.state.remove(MESSAGES_STATE_KEY);

    for (let key in this.subscriptions$) {
      this.subscriptions$[key].unsubscribe();
    }
  }
}
