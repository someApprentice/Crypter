import { Component, Injector, Inject, ViewChild, ViewChildren, ElementRef, QueryList, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { TransferState, makeStateKey, DOCUMENT } from '@angular/platform-browser';

import { Subscription, of, throwError, from } from 'rxjs';
import { switchMap, map, tap, first, delay } from 'rxjs/operators';

import { WampService } from '../../../../../services/wamp.service'
import { EventMessage } from 'thruway.js/src/Messages/EventMessage'

import { MessengerService } from '../../../messenger.service';

import { AuthService } from '../../../../auth/auth.service';

import { DatabaseService } from '../../../../../services/database/database.service';
import { ConferenceDocument } from '../../../../../services/database/documents/conference.document';
import { MessageDocument } from '../../../../../services/database/documents/message.document';

import { User } from '../../../../../models/User';
import { Conference } from '../../../../../models/Conference';
import { Message }  from '../../../../../models/Message';

const CONFERENCE_STATE_KEY = makeStateKey('conference');
const MESSAGES_STATE_KEY = makeStateKey('messages');

@Component({
  selector: 'app-public-conference',
  templateUrl: './public-conference.component.html',
  styleUrls: ['./public-conference.component.css']
})
export class PublicConferenceComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('scroller') private scroller: ElementRef;
  previousScrollTop: number = 0;
  previousScrollHeight: number = 0;
  previousOffsetHeight: number = 0;

  @ViewChildren('messagesList') private messagesList: QueryList<ElementRef>;

  conference?: Conference;
  messages: Message[] = [];

  writing: User|null = null;
  
  error?: string;

  subscriptions$: { [key: string]: Subscription } = { };

  private wamp: WampService;
  private databaseService: DatabaseService;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private messengerService: MessengerService,
    public authService: AuthService,
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
    this.conference = this.state.get(CONFERENCE_STATE_KEY, undefined);
    this.messages = this.state.get(MESSAGES_STATE_KEY, [] as Message[]);

    // Get uuid from route params
    // Then get Conference from API
    //   If it's a browser
    //     Push it into indexeDB
    //     And subscribe to writing event
    // Then get Messages from API
    //   And if count of unread messages > BATCH_SIZE get batch of new messages
    //   Else get last batch of messages
    // Then if it's a browser push them into indexeDB
    // And then, if it's a browser
    //   Subscribe to the conference from IndexeDB
    //   Then subscribe to the initial messagesList changes
    //     to detect whether or not scroller has a overflow
    //     and if it isn't so subscribe to the last messages
    this.subscriptions$['this.messengerService.getMessagesBy'] = this.route.params.pipe(
      map(params => params['uuid']),
      switchMap((uuid: string) => this.messengerService.getConference(uuid)),
      switchMap((conference: Conference) => {
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

        this.conference = conference;

        this.state.set(CONFERENCE_STATE_KEY, conference as Conference);

        if (isPlatformBrowser(this.platformId)) {
          this.subscriptions$[`this.wamp.topic(writing.for.${this.authService.user.uuid})`] = this.wamp.topic(`writing.for.${this.authService.user.uuid}`).pipe(
            tap((e: EventMessage) => {
              if (e.args[0].conference == this.conference.uuid) {
                this.writing = <User> {
                  uuid: e.args[0].user.uuid,
                  name: e.args[0].user.name
                }
              }
            }),
            delay(2300)
          ).subscribe(() => {
            this.writing = null;
          });
        }

        if (conference.unread > MessengerService.BATCH_SIZE) {
          return this.messengerService.getUnreadMessagesByConference(conference.uuid);
        }

        return this.messengerService.getMessagesByConference(conference.uuid);
      })
    )
    .subscribe(
      (messages: Message[]) => {
        if (isPlatformBrowser(this.platformId)) {
          for (let message of messages) {
            this.databaseService.upsertMessage(message).subscribe();
          }
        }

        this.messages = messages;

        this.messages.sort((a: Message, b: Message) => a.date - b.date);

        this.state.set(MESSAGES_STATE_KEY, messages as Message[]);

        // How to properly switch to this observables on browser condition?
        if (isPlatformBrowser(this.platformId)) {
          this.subscriptions$['this.databaseService.getConference'] = this.databaseService.getConference(this.conference.uuid).subscribe(
            (conference: Conference) => {
              this.conference = conference;
            }
          );

          this.messagesList.changes.pipe(
            first()
          ).subscribe((ql: QueryList<ElementRef>) => {
            if (this.scroller.nativeElement.clientHeight === this.scroller.nativeElement.scrollHeight) {
              this.subscriptions$['this.databaseService.getMessagesByConference'] = this.databaseService.getMessagesByConference(this.conference.uuid).subscribe((messages: Message[]) => {

                for (let message of messages) {
                  this.messages.find(m => m.uuid == message.uuid) ? this.messages[this.messages.findIndex(m => m.uuid == message.uuid)] = message : this.messages.push(message);
                }

                this.messages.sort((a: Message, b: Message) => a.date - b.date);
              });
            }
          });
        }
      }
    );
  }

  onScrollUp(timestamp: number) {
    if (this.messages.length === this.conference.count) {
      return;
    }

    this.subscriptions$[`this.databaseService.getOldMessagesByConference-${timestamp}`] = this.messengerService.getOldMessagesByConference(this.conference.uuid, timestamp).pipe(
      tap((messages: Message[]) => {
        for (let message of messages) {
          this.databaseService.upsertMessage(message).subscribe();
        }

        return messages;
      }),
      switchMap(() => {
        return this.databaseService.getOldMessagesByConference(this.conference.uuid, timestamp)
      })
    ).subscribe((messages: Message[]) => {
        messages.sort((a: Message, b: Message) => b.date - a.date);

        // scroll to the last obtained message in case if a scroll was at the very top
        if (!(`this.messagesList.changes-${timestamp}` in this.subscriptions$) && messages.length > 0) {
          this.subscriptions$[`this.messagesList.changes-${timestamp}`] = this.messagesList.changes.pipe(
            first()
          ).subscribe((ql: QueryList<ElementRef>) => {
            if (this.scroller.nativeElement.scrollTop === 0 && messages.length > 0) {
              let lastMessage = ql.find(el => el.nativeElement.id === messages[0].uuid);

              lastMessage.nativeElement.scrollIntoView();
            }
          });
        }

        for (let message of messages) {
          this.messages.find(m => m.uuid == message.uuid) ? this.messages[this.messages.findIndex(m => m.uuid == message.uuid)] = message : this.messages.unshift(message);
        }

        this.messages.sort((a: Message, b: Message) => a.date - b.date);
    });

    // needs to define whether or not the scroll was
    // at the bottom before messages bound into template
    this.previousScrollTop = this.scroller.nativeElement.scrollTop;
    this.previousScrollHeight = this.scroller.nativeElement.scrollHeight;
    this.previousOffsetHeight = this.scroller.nativeElement.offsetHeight;
  }

  onScrollDown(timestamp: number) {
    if (this.conference.unread === 0) {
      if (!('this.databaseService.getMessagesByConference' in this.subscriptions$)) {
        this.subscriptions$['this.databaseService.getMessagesByConference'] = this.databaseService.getMessagesByConference(this.conference.uuid).subscribe((messages: Message[]) => {
          for (let message of messages) {
            this.messages.find(m => m.uuid == message.uuid) ? this.messages[this.messages.findIndex(m => m.uuid == message.uuid)] = message : this.messages.push(message);
          }

          this.messages.sort((a: Message, b: Message) => a.date - b.date);
        });
      }
    }

    if (this.conference.unread > 0) {
      this.subscriptions$[`this.databaseService.getNewMessagesByConference-${timestamp}`] = this.messengerService.getNewMessagesByConference(this.conference.uuid, timestamp).pipe(
        tap((messages: Message[]) => {
          for (let message of messages) {
            this.databaseService.upsertMessage(message).subscribe();
          }
        }),
        switchMap((messages: Message[]) => {
          return this.databaseService.getNewMessagesByConference(this.conference.uuid, timestamp)
        })
      ).subscribe((messages: Message[]) => {
        for (let message of messages) {
          this.messages.find(m => m.uuid == message.uuid) ? this.messages[this.messages.findIndex(m => m.uuid == message.uuid)] = message : this.messages.push(message);
        }

        this.messages.sort((a: Message, b: Message) => a.date - b.date);
      });

      // needs to define whether or not the scroll was
      // at the bottom before messages bound into template
      this.previousScrollTop = this.scroller.nativeElement.scrollTop;
      this.previousScrollHeight = this.scroller.nativeElement.scrollHeight;
      this.previousOffsetHeight = this.scroller.nativeElement.offsetHeight;
    }
  }

  public onIntersection({ target, visible }: { target: Element; visible: boolean }): void {
    if (isPlatformBrowser(this.platformId)) {
      if (visible) {
        let message = this.messages.find(m => m.uuid == target.id);

        if (message && message.author.uuid != this.authService.user.uuid && !message.readed) {
          let data = {
            'by': this.authService.user.uuid,
            'message': message.uuid,
            'Bearer token': this.authService.user.jwt
          };

          this.wamp.call('read', [data]).pipe(
            // Handle errors
            switchMap(res => (Object.keys(res.args[0].errors).length > 0) ? throwError(JSON.stringify(res.args[0].errors)) : of(res)),
          ).subscribe(
            res => {
              let message: Message = res.args[0].message;

              this.databaseService.upsertMessage(message).subscribe();
            },
            err => {
              if (err instanceof Error || 'message' in err) { // TypeScript instance of interface check
                this.error = err.message;
              }
            }
          );
        }
      }
    }
  }

  onSent(message: Message) {
    // needs to define whether or not the scroll was
    // at the bottom before messages bound into template
    this.previousScrollTop = this.scroller.nativeElement.scrollTop;
    this.previousScrollHeight = this.scroller.nativeElement.scrollHeight;
    this.previousOffsetHeight = this.scroller.nativeElement.offsetHeight;
  }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      // scroll down on init
      if (this.messages.length > 0 && this.messages.filter(m => m.author.uuid !== this.authService.user.uuid  && !m.readed).length === 0) {
        let lastMessage = this.messagesList.find(el => el.nativeElement.id === this.messages[this.messages.length - 1].uuid);

        lastMessage.nativeElement.scrollIntoView();
      }

      // autoscroll on new message
      this.subscriptions$['this.messagesList.changes'] = this.messagesList.changes.subscribe((ql: QueryList<ElementRef>) => {
        let scrollerEl: HTMLElement = this.scroller.nativeElement;

        if (this.previousScrollTop + this.previousOffsetHeight == this.previousScrollHeight) {
          if (this.messages.length > 0 && this.messages.filter(m => m.author.uuid !== this.authService.user.uuid  && !m.readed).length === 0) {
            let lastMessage = this.messagesList.find(el => el.nativeElement.id === this.messages[this.messages.length - 1].uuid);

            lastMessage.nativeElement.scrollIntoView();
          }
        }
      });
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