import { Component, Injector, Inject, ViewChild, ViewChildren, ElementRef, QueryList, HostListener, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer, DOCUMENT } from '@angular/common';
import { TransferState, makeStateKey } from '@angular/platform-browser';

import { Observable, Subscription, Subject, of, from, fromEvent, zip, concat, throwError } from 'rxjs';
import { switchMap, delayWhen, map, tap, first, delay, reduce, takeUntil } from 'rxjs/operators';

import { CrypterService } from '../../../../../services/crypter.service';

import { WampService } from '../../../../../services/wamp.service'
import { EventMessage } from 'thruway.js/src/Messages/EventMessage'

import { MessengerService } from '../../../messenger.service';

import { AuthService } from '../../../../auth/auth.service';

import { DatabaseService } from '../../../../../services/database/database.service';

import { User } from '../../../../../models/user.model';
import { Conference } from '../../../../../models/conference.model';
import { Message }  from '../../../../../models/message.model';

const PARTICIPANT_STATE_KEY = makeStateKey('participant');
const CONFERENCE_STATE_KEY = makeStateKey('conference');
const MESSAGES_STATE_KEY = makeStateKey('messages');

@Component({
  selector: 'app-private-conference',
  templateUrl: './private-conference.component.html',
  styleUrls: ['./private-conference.component.css']
})
export class PrivateConferenceComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('scroller') private scroller: ElementRef;
  previousScrollTop: number = 0;
  previousScrollHeight: number = 0;
  previousOffsetHeight: number = 0;

  isParticipantLoading: boolean = false;

  isOldMessagesLoading: boolean = false;
  isMessagesLoading: boolean = false;
  isNewMessagesLoading: boolean = false;

  @ViewChildren('messagesList') private messagesList: QueryList<ElementRef>;

  user?: User;
  participant? : User;
  conference?: Conference;
  messages: Message[] = [];

  writing: User|null = null;
  
  error?: string;

  subscriptions: { [key: string]: Subscription } = { };

  private unsubscribe$ = new Subject<void>();

  private wamp: WampService;
  private databaseService: DatabaseService;
  private document: Document;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private crypterService: CrypterService,
    private messengerService: MessengerService,
    public authService: AuthService,
    private state: TransferState,
    private route: ActivatedRoute,
    private injector: Injector,
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.wamp = injector.get(WampService);
      this.databaseService = injector.get(DatabaseService);
      this.document = injector.get(DOCUMENT);
    }
  }

  ngOnInit() {
    this.participant = this.state.get(PARTICIPANT_STATE_KEY, undefined);
    this.conference = this.state.get(CONFERENCE_STATE_KEY, undefined);
    this.messages = this.state.get(MESSAGES_STATE_KEY, [] as Message[]);

    // Get uuid from route params
    // Then get participant User from API
    //   If it's a browser
    //     Push it into indexeDB
    // Then get Conference from API
    //   If it's a browser
    //     Push it into indexeDB
    //     And subscribe to writing event
    // Wait until logged in User to fetch from IndexeDB
    // Then get Messages from API
    //   And if count of unread messages > BATCH_SIZE get batch of new messages
    //   Else get last batch of messages
    // Then if it's a browser push them into IndexeDB
    // And then, if it's a browser
    //   Subscribe to the conference from IndexeDB
    //   Then
    //    If messages = 0 subscribe to the last messages
    //    Else subscribe to the initial messagesList changes
    //      to detect whether or not scroller has a overflow
    //      and if it isn't so subscribe to the last messages
    this.subscriptions['this.messengerService.getMessagesBy'] = this.route.params.pipe(
      map(params => params['uuid']),
      switchMap((uuid: string) => {
        this.isParticipantLoading = true;

        return this.authService.getUser(uuid);
      }),
      switchMap((participant: User) => {
        if (isPlatformBrowser(this.platformId)) {
          return this.databaseService.upsertUser(participant);
        }

        return of(participant);
      }),
      tap((participant: User) => {
        this.isParticipantLoading = false;

        this.participant = participant;

        this.state.set(PARTICIPANT_STATE_KEY, participant as User);

        if (isPlatformBrowser(this.platformId)) {
          this.wamp.topic(`writing.for.${this.authService.user.uuid}`).pipe(
            takeUntil(this.unsubscribe$),
            tap((e: EventMessage) => {
              if (e.args[0].user.uuid === this.participant.uuid) {
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
      }),
      switchMap((participant: User) => this.messengerService.getConferenceByParticipant(participant.uuid)),
      switchMap((conference: Conference|null) => {
        if (conference) {
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

          if (this.messages.length === 0) {
            this.isMessagesLoading = true;
          }

          if (conference.unread > MessengerService.BATCH_SIZE) {
            return this.messengerService.getUnreadMessagesByParticipant(conference.participant.uuid);
          }

          return this.messengerService.getMessagesByParticipant(conference.participant.uuid);
        }

        return of([] as Message[]);
      }),
      delayWhen((messages: Message[]) => {
        if (isPlatformBrowser(this.platformId)) {
          return this.databaseService.user$.pipe(
            tap((user: User) => this.user = user)
          );
        }

        return of(messages);
      }),
      switchMap((messages: Message[]) => {
        if (isPlatformBrowser(this.platformId)) {
          let decrypted$ = concat(...messages.map(m => this.crypterService.decrypt(m.content, this.user.private_key)));

          return zip(from(messages), decrypted$).pipe(
            reduce((acc, [ message, decrypted ]) => {
              message.content = decrypted;

              acc.push(message);

              return acc;
            }, [])
          );
        }

        return of(messages);
      }),
      tap(() => this.isMessagesLoading = false)
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
          this.databaseService.getConferenceByParticipant(this.participant.uuid).pipe(
            takeUntil(this.unsubscribe$)
          ).subscribe(
            (conference: Conference) => {
              this.conference = conference;
            }
          );

          if (this.messages.length === 0) {
            // will be cleaned after refactoring
            this.subscriptions['this.databaseService.getMessagesByParticipant'] = this.databaseService.getMessagesByParticipant(this.participant.uuid).pipe(
              takeUntil(this.unsubscribe$)
            ).subscribe((messages: Message[]) => {
              this.messages = messages.reduce((acc, cur) => {
                if (acc.find((m: Message) => m.uuid === cur.uuid)) {
                  acc[acc.findIndex((m: Message) => m.uuid === cur.uuid)] = cur;

                  return acc;
                }

                return [ ...acc, cur ];
              }, this.messages);

              this.messages.sort((a: Message, b: Message) => a.date - b.date);
            });
          }

          if (this.messages.length > 0) {
            this.messagesList.changes.pipe(
              first()
            ).subscribe((ql: QueryList<ElementRef>) => {
              if (this.scroller.nativeElement.clientHeight === this.scroller.nativeElement.scrollHeight) {
                // will be cleaned after refactoring
                this.subscriptions['this.databaseService.getMessagesByParticipant'] = this.databaseService.getMessagesByParticipant(this.participant.uuid).pipe(
                  takeUntil(this.unsubscribe$)
                ).subscribe((messages: Message[]) => {
                  this.messages = messages.reduce((acc, cur) => {
                    if (acc.find((m: Message) => m.uuid === cur.uuid)) {
                      acc[acc.findIndex((m: Message) => m.uuid === cur.uuid)] = cur;

                      return acc;
                    }

                    return [ ...acc, cur ];
                  }, this.messages);

                  this.messages.sort((a: Message, b: Message) => a.date - b.date);
                });
              }
            });
          }
        }
      }
    );
  }

  onScrollUp(timestamp: number) {
    if (this.messages.length === this.conference.count) {
      return;
    }

    if (!this.isOldMessagesLoading) {
      this.messengerService.getOldMessagesByParticipant(this.participant.uuid, timestamp).pipe(
        tap(() => this.isOldMessagesLoading = true),
        switchMap((messages: Message[]) => {
          if (messages.length === 0) {
            return of(messages);
          }

          let decrypted$ = concat(...messages.map(m => this.crypterService.decrypt(m.content, this.user.private_key)));

          return zip(from(messages), decrypted$).pipe(
            reduce((acc, [ message, decrypted ]) => {
              message.content = decrypted;

              acc.push(message);

              return acc;
            }, [])
          );
        }),
        tap((messages: Message[]) => {
          for (let message of messages) {
            this.databaseService.upsertMessage(message).subscribe();
          }

          return messages;
        }),
        switchMap(() => {
          return this.databaseService.getOldMessagesByParticipant(this.participant.uuid, timestamp).pipe(
            takeUntil(this.unsubscribe$)
          )
        })
      ).subscribe((messages: Message[]) => {
          messages.sort((a: Message, b: Message) => b.date - a.date);

          // scroll to the last obtained message in case if a scroll was at the very top
          if (!(`this.messagesList.changes-${timestamp}` in this.subscriptions) && messages.length > 0) {
            this.subscriptions[`this.messagesList.changes-${timestamp}`] = this.messagesList.changes.pipe(
              takeUntil(this.unsubscribe$),
              first()
            ).subscribe((ql: QueryList<ElementRef>) => {
              if (this.scroller.nativeElement.scrollTop === 0 && messages.length > 0) {
                let lastMessage = ql.find(el => el.nativeElement.id === messages[0].uuid);

                lastMessage.nativeElement.scrollIntoView();
              }
            });
          }

          this.messages = messages.reduce((acc, cur) => {
            if (acc.find((m: Message) => m.uuid === cur.uuid)) {
              acc[acc.findIndex((m: Message) => m.uuid === cur.uuid)] = cur;

              return acc;
            }

            return [ ...acc, cur ];
          }, this.messages);

          this.messages.sort((a: Message, b: Message) => a.date - b.date);

          this.isOldMessagesLoading = false;
      });
    }

    // needs to define whether or not the scroll was
    // at the bottom before messages bound into template
    this.previousScrollTop = this.scroller.nativeElement.scrollTop;
    this.previousScrollHeight = this.scroller.nativeElement.scrollHeight;
    this.previousOffsetHeight = this.scroller.nativeElement.offsetHeight;
  }

  onScrollDown(timestamp: number) {
    if (this.conference.unread === 0) {
      // will be cleaned after refactoring
      if (!('this.databaseService.getMessagesByParticipant' in this.subscriptions)) {
        this.subscriptions['this.databaseService.getMessagesByParticipant'] = this.databaseService.getMessagesByParticipant(this.participant.uuid).pipe(
          takeUntil(this.unsubscribe$)
        ).subscribe((messages: Message[]) => {
          this.messages = messages.reduce((acc, cur) => {
            if (acc.find((m: Message) => m.uuid === cur.uuid)) {
              acc[acc.findIndex((m: Message) => m.uuid === cur.uuid)] = cur;

              return acc;
            }

            return [ ...acc, cur ];
          }, this.messages);

          this.messages.sort((a: Message, b: Message) => a.date - b.date);
        });
      }
    }

    if (this.conference.unread > 0) {
      this.isNewMessagesLoading = true;

      this.messengerService.getNewMessagesByParticipant(this.participant.uuid, timestamp).pipe(
        switchMap((messages: Message[]) => {
          if (messages.length === 0) {
            return of([] as Message[]);
          }

          let decrypted$ = concat(...messages.map(m => this.crypterService.decrypt(m.content, this.user.private_key)));

          return zip(from(messages), decrypted$).pipe(
            reduce((acc, [ message, decrypted ]) => {
              message.content = decrypted;

              acc.push(message);

              return acc;
            }, [])
          );
        }),
        tap((messages: Message[]) => {
          for (let message of messages) {
            this.databaseService.upsertMessage(message).subscribe();
          }
        }),
        switchMap((messages: Message[]) => {
          return this.databaseService.getNewMessagesByParticipant(this.participant.uuid, timestamp).pipe(
            takeUntil(this.unsubscribe$)
          )
        }),
        tap(() => this.isNewMessagesLoading = false)
      ).subscribe((messages: Message[]) => {
        this.messages = messages.reduce((acc, cur) => {
          if (acc.find((m: Message) => m.uuid === cur.uuid)) {
            acc[acc.findIndex((m: Message) => m.uuid === cur.uuid)] = cur;

            return acc;
          }

          return [ ...acc, cur ];
        }, this.messages);

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
      if (visible && this.document.hasFocus() && !this.document.hidden) {
        let message = this.messages.find(m => m.uuid == target.id);

        this.read(message);
      }
    }
  }

  @HostListener('window:focus', ['$event'])
  onFocus(event: Event): void {
    let scrollerEl = this.scroller.nativeElement;

    for (let v of this.messagesList.toArray()) {
      let el = v.nativeElement;

      if (
        el.offsetTop - scrollerEl.offsetTop >= scrollerEl.scrollTop &&
        el.offsetLeft - scrollerEl.offsetLeft >= scrollerEl.scrollLeft &&
        el.offsetTop - scrollerEl.offsetTop + el.offsetHeight <= scrollerEl.scrollTop + scrollerEl.offsetHeight &&
        el.offsetLeft - scrollerEl.offsetLeft + el.offsetWidth <= scrollerEl.scrollLeft + scrollerEl.offsetWidth
      ) {
        let message = this.messages.find(m => m.uuid == el.id);

        this.read(message);
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

  read(message: Message):void {
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
          let m: Message = res.args[0].message;

          // No need to update message in IndexeDB since Messenger do this on the background
          // Update message in document to shortcut IndexeDB
          message.readed = m.readed;
          message.readedAt = m.readedAt;
        },
        err => {
          if (err instanceof Error || 'message' in err) { // TypeScript instance of interface check
            this.error = err.message;
          }
        }
      );
    }
  }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      // scroll down on init
      if (this.messages.length > 0 && this.messages.filter(m => m.author.uuid !== this.authService.user.uuid  && !m.readed).length === 0) {
        let lastMessage = this.messagesList.find(el => el.nativeElement.id === this.messages[this.messages.length - 1].uuid);

        lastMessage.nativeElement.scrollIntoView();
      }

      // autoscroll on new message
      this.messagesList.changes.pipe(
        takeUntil(this.unsubscribe$)
      ).subscribe((ql: QueryList<ElementRef>) => {
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
    this.state.remove(PARTICIPANT_STATE_KEY);
    this.state.remove(CONFERENCE_STATE_KEY);
    this.state.remove(MESSAGES_STATE_KEY);

    this.unsubscribe$.next();
    this.unsubscribe$.complete();

    // will be cleaned after rafactroing
    for (let key in this.subscriptions) {
      this.subscriptions[key].unsubscribe();
    }
  }
}
