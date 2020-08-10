import { environment } from '../../../../../../environments/environment';

import { Component, Injector, Inject, ViewChild, ViewChildren, ElementRef, QueryList, HostListener, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer, DOCUMENT } from '@angular/common';
import { TransferState, makeStateKey } from '@angular/platform-browser';

import { Observable, Subscription, Subject, of, from, fromEvent, zip, concat, timer, empty, throwError } from 'rxjs';
import { switchMap, concatMap, exhaustMap, delayWhen, map, tap, first, reduce, filter, debounceTime, distinctUntilChanged, retry, takeUntil } from 'rxjs/operators';

import { CrypterService } from '../../../../../services/crypter.service';

import { AuthService } from '../../../../auth/auth.service';
import { DatabaseService } from '../../../../../services/database.service';
import { MessengerService } from '../../../messenger.service';
import { RepositoryService } from '../../../../../services/repository.service';
import { SocketService } from '../../../../../services/socket.service'

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
  form = new FormGroup({
    message: new FormControl('', [
      Validators.required
    ])
  });

  @ViewChild('scroller') private scroller: ElementRef;
  isScrolledDown: boolean = false;

  isParticipantLoading: boolean = false;

  isOldMessagesLoading: boolean = false;
  isMessagesLoading: boolean = false;
  isNewMessagesLoading: boolean = false;

  @ViewChildren('messagesList') private messagesList: QueryList<ElementRef>;

  participant? : User;
  conference?: Conference;
  messages: Message[] = [];

  writing$ = new Subject<string>();
  writing: boolean = false;
  
  private unsubscribe$ = new Subject<void>();

  private document: Document;
  private databaseService: DatabaseService;
  private repositoryService: RepositoryService;
  private socketService: SocketService;

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
      this.document = injector.get(DOCUMENT);
      this.databaseService = injector.get(DatabaseService);
      this.repositoryService = injector.get(RepositoryService);
      this.socketService = injector.get(SocketService);
    }
  }

  ngOnInit() {
    if (isPlatformServer(this.platformId)) {
      this.route.params.pipe(
        first(),
        map(params => params['uuid']),
        switchMap((uuid: string) => this.authService.getUser(uuid).pipe(
          tap((participant: User) => {
            this.participant = participant;

            this.state.set(PARTICIPANT_STATE_KEY, participant as User);
          })
        )),
        switchMap((participant: User) => this.messengerService.getConferenceByParticipant(participant.uuid).pipe(
          tap((conference: Conference|null) => {
            if (conference) {
              this.conference = conference;

              this.state.set(CONFERENCE_STATE_KEY, conference as Conference);
            }
          })
        )),
        switchMap((conference: Conference|null) => {
          if (!conference)
            return of([] as Message[]);

          if (conference.unread_messages_count > environment.batch_size)
            return this.messengerService.getUnreadMessagesByParticipant(conference.participant.uuid);

          return this.messengerService.getMessagesByParticipant(conference.participant.uuid);
        })
      ).subscribe((messages: Message[]) => {
        this.messages = messages;

        this.messages.sort((a: Message, b: Message) => a.date - b.date);

        this.state.set(MESSAGES_STATE_KEY, messages as Message[]);
      });
    }

    if (isPlatformBrowser(this.platformId)) {
      this.participant = this.state.get(PARTICIPANT_STATE_KEY, undefined);
      this.conference = this.state.get(CONFERENCE_STATE_KEY, undefined);
      this.messages = this.state.get(MESSAGES_STATE_KEY, [] as Message[]);

      if (this.participant) {
        this.databaseService.upsertUser(this.participant).subscribe();

        of(this.participant).pipe(
          switchMap((participant: User) => {
            // In case Conference already loaded from server-side-rendering
            // Or already came from socket subscription
            if (this.conference)
              return of(this.conference);

            return this.repositoryService.getConferenceByParticipant(participant.uuid).pipe(
              tap((conference: Conference|null) => {
                if (conference)
                  this.conference = conference;
              })
            );
          }),
          switchMap((conference: Conference|null) => {
            if (!conference)
              return of([] as Message[]);

            if (!conference.messages_count)
              return of([] as Message[]);

            if (!!this.messages.length) {
              // decryption mutates Message objects in template
              // and breaks scroll down on initialization that triggers on a first change
              let clone = JSON.parse(JSON.stringify(this.messages));

              return of(clone).pipe(
                delayWhen(() => this.databaseService.user$),
                switchMap((messages: Message[]) => {
                  let decrypted$ = concat(...messages.map(m => this.crypterService.decrypt(m.content, this.authService.user.private_key)));

                  return zip(from(messages), decrypted$).pipe(
                    reduce((acc, [ message, decrypted ]) => {
                      message.content = decrypted;

                      return [ ...acc, message ];
                    }, [] as Message[])
                  );
                }),
                // In order to store a records into the IndexeDB in the background, you have to apply a nested subscribes anti-pattern
                // Let me know if you know a solution how to avoid this
                tap((messages: Message[]) => this.databaseService.bulkMessages(messages).subscribe())
              );
            }

            this.isMessagesLoading = true;

            if (conference.unread_messages_count > environment.batch_size)
              return this.repositoryService.getUnreadMessagesByParticipant(conference.participant.uuid);

            return this.repositoryService.getMessagesByParticipant(conference.participant.uuid);
          }),
          takeUntil(this.unsubscribe$)
        ).subscribe((messages: Message[]) => {
          // read & scroll down on init
          if (!!messages.length) {
            this.messagesList.changes.pipe(
              first((ql: QueryList<ElementRef>) => !!ql.length),
              takeUntil(this.unsubscribe$)
            ).subscribe((ql: QueryList<ElementRef>) => {
              if (!!this.messages.length) {
                this.read$().subscribe();

                let unreadMessages = this.messages.filter(m => m.author.uuid !== this.authService.user.uuid && !m.readed);

                if (unreadMessages.length === 0) {
                  this.messagesList.last.nativeElement.scrollIntoView();
                }

                if (!!unreadMessages.length) {
                  let firstUnreadMessage = this.messagesList.find(el => el.nativeElement.getAttribute('data-uuid') === unreadMessages[0].uuid);

                  firstUnreadMessage.nativeElement.scrollIntoView();
                }
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

          this.isMessagesLoading = false;
        });
      }

      if (!this.participant) {
        this.route.params.pipe(
          first(),
          map(params => params['uuid']),
          switchMap((uuid: string) => {
            this.isParticipantLoading = true;

            return this.repositoryService.getUser(uuid).pipe(
              tap((participant: User) => {
                this.participant = participant;

                this.isParticipantLoading = false;
              })
            );
          }),
          switchMap((participant: User) => this.repositoryService.getConferenceByParticipant(participant.uuid).pipe(
            tap((conference: Conference|null) => {
              if (conference)
                this.conference = conference;
            })
          )),
          switchMap((conference: Conference|null) => {
            if (!conference)
              return of([] as Message[]);

            if (conference && !conference.messages_count)
              return of([] as Message[]);

            this.isMessagesLoading = true;

            if (conference.unread_messages_count > environment.batch_size)
              return this.repositoryService.getUnreadMessagesByParticipant(conference.participant.uuid);

            return this.repositoryService.getMessagesByParticipant(conference.participant.uuid);
          }),
          takeUntil(this.unsubscribe$)
        ).subscribe((messages: Message[]) => {
          // read & scroll down on init
          if (!!messages.length) {
            this.messagesList.changes.pipe(
              first((ql: QueryList<ElementRef>) => !!ql.length),
              takeUntil(this.unsubscribe$)
            ).subscribe((ql: QueryList<ElementRef>) => {
              this.read$().subscribe();

              let unreadMessages = this.messages.filter(m => m.author.uuid !== this.authService.user.uuid && !m.readed);

              if (unreadMessages.length === 0) {
                this.messagesList.last.nativeElement.scrollIntoView();
              }

              if (!!unreadMessages.length) {
                let firstUnreadMessage = this.messagesList.find(el => el.nativeElement.getAttribute('data-uuid') === unreadMessages[0].uuid);

                firstUnreadMessage.nativeElement.scrollIntoView();
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

          this.isMessagesLoading = false;
        });
      }

      this.socketService.conferenceUpdated$.pipe(
        filter((conference: Conference) => conference.participant && conference.participant.uuid === this.participant.uuid),
        takeUntil(this.unsubscribe$)
      ).subscribe((conference: Conference) => {
        this.conference = conference;
      });

      this.socketService.privateMessage$.pipe(
        filter((message: Message) =>  (
          message.conference.participant &&
          message.conference.participant.uuid === this.participant.uuid
        )),
        takeUntil(this.unsubscribe$)
      ).subscribe((message: Message) => {
        if (this.messages.find((m: Message) => m.uuid === message.uuid))
          return this.messages[this.messages.findIndex((m: Message) => m.uuid === message.uuid)] = message;

        return this.messages.push(message);
      });

      this.socketService.privateMessageRead$.pipe(
        filter((message: Message) => message.conference.participant && message.conference.participant.uuid === this.participant.uuid),
        takeUntil(this.unsubscribe$)
      ).subscribe((message: Message) => {
        let unread = this.messages.find(m => m.uuid == message.uuid);

        if (unread) {
          // abusing muttable js behavior
          unread.readed = message.readed;
          unread.readedAt = message.readedAt;
        }
      });

      this.socketService.privateMessageReadSince$.pipe(
        map((messages: Message[]) => messages.filter((m: Message) => m.conference.participant && m.conference.participant.uuid === this.participant.uuid)),
        takeUntil(this.unsubscribe$)
      ).subscribe((messages: Message[]) => {
        for (let message of messages) {
          let unread = this.messages.find((m: Message) => m.uuid === message.uuid);

          if (unread) {
            // abusing muttable js behavior
            unread.readed = message.readed;
            unread.readedAt = message.readedAt;
          }
        }
      });

      this.writing$.pipe(
        filter((value: string) => !!value),
        // Commented out for achieving smoother notification
        // Uncomment if you experiencing overload issues
        // debounceTime(333),
        distinctUntilChanged(),
        exhaustMap(() => this.socketService.emit('wrote.to.user', { 'to': this.participant.uuid })),
        takeUntil(this.unsubscribe$)
      ).subscribe();

      this.socketService.wroteToUser$.pipe(
        filter((user: User) => user.uuid === this.participant.uuid),
        tap((user: User) => this.writing = true),
        switchMap(() => timer(2333)),
        tap(() => this.writing = false),
        takeUntil(this.unsubscribe$)
      ).subscribe();
    }
  }

  onScrollUp(timestamp: number) {
    if (this.messages.length === this.conference.messages_count) {
      return;
    }

    if (!this.isOldMessagesLoading) {
      this.isOldMessagesLoading = true;

      this.repositoryService.getOldMessagesByParticipant(this.participant.uuid, timestamp).pipe(
        takeUntil(this.unsubscribe$)
      ).subscribe((messages: Message[]) => {
        // scroll to the last obtained message in case if a scroll was at the very top
        if (!!messages.length) {
          this.messagesList.changes.pipe(
            first((ql: QueryList<ElementRef>) => ql.first.nativeElement.getAttribute('data-uuid') === messages[0].uuid),
            takeUntil(this.unsubscribe$)
          ).subscribe((ql: QueryList<ElementRef>) => {
            if (this.scroller.nativeElement.scrollTop === 0) {
              let lastMessage = ql.find(el => el.nativeElement.getAttribute('data-uuid') === messages[messages.length - 1].uuid);

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
  }

  onScrollDown(timestamp: number) {
    if (this.conference.unread_messages_count === 0 && this.isScrolledDown) {
      return;
    }

    if (!this.isNewMessagesLoading) {
      this.isNewMessagesLoading = true;

      this.repositoryService.getNewMessagesByParticipant(this.participant.uuid, timestamp).pipe(
        takeUntil(this.unsubscribe$)
      ).subscribe((messages: Message[]) => {
        // scroll to the first obtained message in case if a scroll was at the very bottom
        if (!!messages.length) {
          this.messagesList.changes.pipe(
            first((ql: QueryList<ElementRef>) => !!ql.find(el => el.nativeElement.getAttribute('data-uuid') === messages[0].uuid)),
            takeUntil(this.unsubscribe$)
          ).subscribe((ql: QueryList<ElementRef>) => {
            if (this.isScrolledDown) {
              let firstMessage = ql.find(el => el.nativeElement.getAttribute('data-uuid') === messages[0].uuid);

              firstMessage.nativeElement.scrollIntoView({ block: 'end' });
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

        this.isNewMessagesLoading = false;
      });
    }
  }

  onScroll(e: Event) {
    let scrollerEl = this.scroller.nativeElement;

    this.isScrolledDown = scrollerEl.scrollTop + scrollerEl.offsetHeight === scrollerEl.scrollHeight;
  }

  @HostListener('window:focus', ['$event'])
  onFocus(event: Event): void {
    this.read$().subscribe();
  }

  onSubmit(e: Event) {
    e.preventDefault()

    let text = this.form.get('message').value

    if (this.form.valid)
      this.send(text);
  }

  onEnter(e: KeyboardEvent) {
    if (e.key == "Enter" && !e.shiftKey) {      
      e.preventDefault();

      let text = this.form.get('message').value

      if (this.form.valid)
        this.send(text);
    }
  }

  onWriting(value: string) {
    this.writing$.next(value);
  }

  send(text: string) {
    this.form.get('message').reset();

    // Wait unit User initialize from IndexeDB
    // Encrypt message
    // Then send message to the ws service
    // Then handle response errors
    // Then push message to the template
    // Then upsert conference
    // Then upsert message
    this.databaseService.user$.pipe(
      first(),
      switchMap(() => this.crypterService.encrypt(text, [ this.authService.user.public_key, this.participant.public_key  ])),
      map(encrypted => {
        return { 'to': this.participant.uuid, 'text': encrypted  };
      }),
      switchMap(data => this.socketService.emit('private.message.sent', data)),
      switchMap(data => 'errors' in data ? throwError(JSON.stringify(data.errors)) : of(data)),
      map(data => {
        let message: Message = data.message;

        message.content = text;

        return message;
      }),
      tap((message: Message) => {
        this.messages.push(message);

        this.messages.sort((a: Message, b: Message) => a.date - b.date);
      }),
      switchMap((message: Message) => this.databaseService.upsertMessage(message))
    ).subscribe();
  }

  read$(): Observable<any> {
    let scrollerEl = this.scroller.nativeElement as HTMLElement;

    let messages = this.messagesList.toArray()
      .filter(ref => {
        let el = ref.nativeElement as HTMLElement;

        return (
          el.offsetTop - scrollerEl.offsetTop >= scrollerEl.scrollTop &&
          el.offsetLeft - scrollerEl.offsetLeft >= scrollerEl.scrollLeft &&
          el.offsetTop - scrollerEl.offsetTop + el.offsetHeight <= scrollerEl.scrollTop + scrollerEl.offsetHeight &&
          el.offsetLeft - scrollerEl.offsetLeft + el.offsetWidth <= scrollerEl.scrollLeft + scrollerEl.offsetWidth
        );
      })
      .map(ref => {
        return this.messages.find((m: Message) => m.uuid == ref.nativeElement.getAttribute('data-uuid'));
      })
      .filter((m: Message) => m.author.uuid !== this.authService.user.uuid && !m.readed);

    if (!messages.length)
      return empty();

    let message = messages[messages.length - 1];

    return this.socketService.emit('private.message.read_since', { message: message.uuid }).pipe(
      switchMap(data => 'errors' in data ? throwError(JSON.stringify(data.errors)) : of(data['messages'])),
      tap((messages: Message[]) => {
        for (let message of messages) {
          let unread = this.messages.find((m: Message) => m.uuid === message.uuid);

          if (unread) {
            // abusing muttable js behavior
            unread.readed = message.readed;
            unread.readedAt = message.readedAt;
          }
        }
      })
    );
  }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      // autoscroll on new message
      this.messagesList.changes.pipe(
        takeUntil(this.unsubscribe$)
      ).subscribe((ql: QueryList<ElementRef>) => {
        if (this.isScrolledDown) {
          let unreadMessages = this.messages.filter(m => m.author.uuid !== this.authService.user.uuid && !m.readed);

          if (!!this.messages.length && !unreadMessages.length) {
            this.messagesList.last.nativeElement.scrollIntoView();
          }

          if (unreadMessages.length === 1) {
            let firstUnreadMessage = this.messagesList.find(el => el.nativeElement.getAttribute('data-uuid') === unreadMessages[0].uuid);

            firstUnreadMessage.nativeElement.scrollIntoView();
          }
        }
      });

      this.read$().subscribe();

      fromEvent(this.scroller.nativeElement as HTMLElement, 'scroll').pipe(
        concatMap((e: Event) => this.read$()),
        retry(),
        takeUntil(this.unsubscribe$)
      ).subscribe();
    }
  }

  ngOnDestroy() {
    this.state.remove(PARTICIPANT_STATE_KEY);
    this.state.remove(CONFERENCE_STATE_KEY);
    this.state.remove(MESSAGES_STATE_KEY);

    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
