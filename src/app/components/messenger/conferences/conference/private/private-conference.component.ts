import { environment } from '../../../../../../environments/environment';

import { Component, Injector, Inject, ViewChild, ViewChildren, ElementRef, QueryList, HostListener, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer, DOCUMENT } from '@angular/common';
import { TransferState, makeStateKey } from '@angular/platform-browser';

import { Observable, Subscription, Subject, of, from, fromEvent, zip, concat, merge, timer, empty, throwError } from 'rxjs';
import { switchMap, concatMap, exhaustMap, delayWhen, map, tap, first, reduce, filter, ignoreElements, debounceTime, distinctUntilChanged, retry, takeUntil } from 'rxjs/operators';

import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';

import { cloneDeep } from 'lodash';

import { CrypterService } from '../../../../../services/crypter.service';

import { AuthService } from '../../../../auth/auth.service';
import { DatabaseService } from '../../../../../services/database/database.service';
import { MessengerService } from '../../../messenger.service';
import { RepositoryService } from '../../../../../services/repository.service';
import { SocketService } from '../../../../../services/socket.service'

import User from '../../../../../models/user.model';
import Conference from '../../../../../models/conference.model';
import Message  from '../../../../../models/message.model';

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

  onOptionsClosed$ = new Subject<void>();

  @ViewChild('startSecretChat', { read: ElementRef }) private startSecretChat: ElementRef;
  isSecretChatLoading = false;

  @ViewChild('scroller') private scroller: ElementRef;
  isScrolledDown: boolean = false;

  isFocused: boolean = true;

  isSmallScreen: boolean = !this.breakpointObserver.isMatched('(min-width: 1200px)');

  isParticipantLoading: boolean = false;

  isOldMessagesLoading: boolean = false;
  isMessagesLoading: boolean = false;
  isNewMessagesLoading: boolean = false;

  @ViewChildren('messagesList') private messagesList: QueryList<ElementRef>;

  firstUnreadMessage?: Message;

  participant?: User;
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
    private router: Router,
    private route: ActivatedRoute,
    private breakpointObserver: BreakpointObserver,
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
        switchMap((uuid: string) => this.authService.getUser(uuid)),
        switchMap((participant: User|null) => {
          if (!participant)
            return throwError(new Error("User doesn't exist"));

          return of(participant);
        }),
        tap((participant: User) => {
          this.participant = participant;

          this.state.set(PARTICIPANT_STATE_KEY, participant as User);
        }),
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

          if (conference.unread_messages_count > environment.batch_size) {
            return this.messengerService.getUnreadMessagesWithMessagesBeforeByParticipant(conference.participant.uuid).pipe(
              tap((messages: Message[]) => {
                let unreadMessages = messages.filter((m: Message) => m.read);

                if (!!unreadMessages.length)
                  this.firstUnreadMessage = unreadMessages[0];
              })
            );
          }

          return this.messengerService.getMessagesByParticipant(conference.participant.uuid);
        })
      ).subscribe({
        next: (messages: Message[]) => {
          this.messages = messages;

          this.messages.sort((a: Message, b: Message) => a.date - b.date);

          this.state.set(MESSAGES_STATE_KEY, messages as Message[]);
        },
        error: err => this.router.navigate([''])
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

            if (!!this.messages.length)
              return of(this.messages);

            this.isMessagesLoading = true;

            if (conference.unread_messages_count > environment.batch_size) {
              return this.repositoryService.getUnreadMessagesWithMessagesBeforeByParticipant(conference.participant.uuid).pipe(
                tap((messages: Message[]) => {
                  let unreadMessages = messages.filter((m: Message) => m.read);

                  if (!!unreadMessages.length)
                    this.firstUnreadMessage = unreadMessages[0];
                })
              );
            }

            return this.repositoryService.getMessagesByParticipant(conference.participant.uuid);
          }),
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

          this.isMessagesLoading = false;
        });
      }

      if (!this.participant) {
        this.route.params.pipe(
          first(),
          map(params => params['uuid']),
          tap(() => this.isParticipantLoading = true),
          switchMap((uuid: string) => this.repositoryService.getUser(uuid)),
          switchMap((participant: User|null) => {
            if (!participant)
              return throwError(new Error("User doesn't exist"));

            return of(participant);
          }),
          tap((participant: User) => {
            this.participant = participant;

            this.isParticipantLoading = false;
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

            if (conference.unread_messages_count > environment.batch_size) {
              return this.repositoryService.getUnreadMessagesWithMessagesBeforeByParticipant(conference.participant.uuid).pipe(
                tap((messages: Message[]) => {
                  let unreadMessages = messages.filter((m: Message) => !m.read);

                  if (!!unreadMessages.length)
                    this.firstUnreadMessage = unreadMessages[0];
                })
              );
            }

            return this.repositoryService.getMessagesByParticipant(conference.participant.uuid);
          }),
          takeUntil(this.unsubscribe$)
        ).subscribe({
          next: (messages: Message[]) => {
            this.messages = messages.reduce((acc, cur) => {
              if (acc.find((m: Message) => m.uuid === cur.uuid)) {
                acc[acc.findIndex((m: Message) => m.uuid === cur.uuid)] = cur;

                return acc;
              }

              return [ ...acc, cur ];
            }, this.messages);

            this.messages.sort((a: Message, b: Message) => a.date - b.date);

            this.isMessagesLoading = false;
          },
          error: err => this.router.navigate([''])
        });
      }

      this.socketService.conferenceUpdated$.pipe(
        filter((conference: Conference) => (
          conference.type === 'private' &&
          conference.participant &&
          conference.participant.uuid === this.participant.uuid
        )),
        takeUntil(this.unsubscribe$)
      ).subscribe((conference: Conference) => {
        this.conference = conference;
      });

      this.socketService.privateMessage$.pipe(
        filter((message: Message) =>  (
          message.conference.type === 'private' &&
          message.conference.participant &&
          message.conference.participant.uuid === this.participant.uuid
        )),
        takeUntil(this.unsubscribe$)
      ).subscribe((message: Message) => {
        if (this.messages.find((m: Message) => m.uuid === message.uuid))
          return this.messages[this.messages.findIndex((m: Message) => m.uuid === message.uuid)] = message;

        return this.messages.push(message);
      });

      this.socketService.messageRead$.pipe(
        filter((message: Message) => (
          message.conference.type === 'private' &&
          message.conference.participant &&
          message.conference.participant.uuid === this.participant.uuid
        )),
        takeUntil(this.unsubscribe$)
      ).subscribe((message: Message) => {
        let unread = this.messages.find(m => m.uuid == message.uuid);

        if (unread) {
          // abusing muttable js behavior
          unread.read = message.read;
          unread.readAt = message.readAt;
        }
      });

      this.socketService.messagesReadSince$.pipe(
        map((messages: Message[]) => messages.filter((m: Message) => (
          m.conference.type === 'private' &&
          m.conference.participant &&
          m.conference.participant.uuid === this.participant.uuid
        ))),
        takeUntil(this.unsubscribe$)
      ).subscribe((messages: Message[]) => {
        for (let message of messages) {
          let unread = this.messages.find((m: Message) => m.uuid === message.uuid);

          if (unread) {
            // abusing muttable js behavior
            unread.read = message.read;
            unread.readAt = message.readAt;
          }
        }
      });

      this.writing$.pipe(
        filter((value: string) => !!value),
        // Commented out for achieving smoother notification
        // Uncomment if you experiencing overload issues
        // debounceTime(333),
        distinctUntilChanged(),
        exhaustMap(() => this.socketService.emit('write.to.user', { 'user': this.participant.uuid })),
        takeUntil(this.unsubscribe$)
      ).subscribe();

      this.socketService.wroteToUser$.pipe(
        filter((user: User) => user.uuid === this.participant.uuid),
        tap(() => this.writing = true),
        switchMap(() => timer(2333)),
        tap(() => this.writing = false),
        takeUntil(this.unsubscribe$)
      ).subscribe();

      this.breakpointObserver.observe('(min-width: 1200px)').pipe(
        tap((state: BreakpointState) => this.isSmallScreen = !state.matches),
        takeUntil(this.unsubscribe$)
      ).subscribe();
    }
  }

  onOptionsClosed(): void {
    this.onOptionsClosed$.next()
  }

  onScrollUp(timestamp: number) {
    if (this.messages.length === this.conference.messages_count) {
      return;
    }

    if (!this.isOldMessagesLoading) {
      this.isOldMessagesLoading = true;

      let firstMessage = this.messages[0];

      this.repositoryService.getOldMessagesByParticipant(this.participant.uuid, timestamp).pipe(
        switchMap((messages: Message[]) => {
          if (!!messages.length) {
            return merge(
              // scroll to the first message before request in case if a scroll was at the very top
              this.messagesList.changes.pipe(
                first((ql: QueryList<ElementRef>) => ql.first.nativeElement.getAttribute('data-uuid') === messages[0].uuid),
                tap((ql: QueryList<ElementRef>) => {
                  if (this.scroller.nativeElement.scrollTop === 0) {
                    let firstMessageBeforeRequest = ql.find(el => el.nativeElement.getAttribute('data-uuid') === firstMessage.uuid);

                    firstMessageBeforeRequest.nativeElement.scrollIntoView();
                  }
                }),
                ignoreElements()
              ),
              of(messages)
            );
          }

          return of(messages);
        }),
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

        this.isOldMessagesLoading = false;
      });
    }
  }

  onScrollDown(timestamp: number) {
    if (
      (this.messages[this.messages.length - 1].uuid === this.conference.last_message.uuid) ||
      (this.conference.unread_messages_count === 0 && this.isScrolledDown)
    ) {
      return;
    }

    if (!this.isNewMessagesLoading) {
      this.isNewMessagesLoading = true;

      let lastMessage = this.messages[this.messages.length - 1];

      this.repositoryService.getNewMessagesByParticipant(this.participant.uuid, timestamp).pipe(
        switchMap((messages: Message[]) => {
          if (!!messages.length) {
            return merge(
              // scroll to the last message before request in case if a scroll was at the very bottom
              this.messagesList.changes.pipe(
                first((ql: QueryList<ElementRef>) => !!ql.find(el => el.nativeElement.getAttribute('data-uuid') === messages[0].uuid)),
                tap((ql: QueryList<ElementRef>) => {
                  if (this.isScrolledDown) {
                    let lastMessageBeforeRequest = ql.find(el => el.nativeElement.getAttribute('data-uuid') === lastMessage.uuid);

                    lastMessageBeforeRequest.nativeElement.scrollIntoView({ block: 'end' });
                  }
                }),
                ignoreElements()
              ),
              of(messages)
            );
          }

          of(messages);
        }),
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

        this.isNewMessagesLoading = false;
      });
    }
  }

  onScroll(e: Event) {
    let scrollerEl = this.scroller.nativeElement;

    this.isScrolledDown = scrollerEl.scrollTop + scrollerEl.offsetHeight >= scrollerEl.scrollHeight;
  }

  @HostListener('window:focus', ['$event'])
  onFocus(event: Event): void {
    this.isFocused = true;

    this.read$().subscribe();
  }

  @HostListener('window:blur', ['$event'])
  onBlur(event: Event): void {
    this.isFocused = false;
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event): void {
    if (this.isScrolledDown && this.messagesList.last)
      this.messagesList.last.nativeElement.scrollIntoView();
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

    // Then send message to the ws service
    // Then handle response errors
    // Then push message to the template
    // Then upsert conference
    // Then upsert message
    this.socketService.emit('private.message.sent', { 'to': this.participant.uuid, 'text': text }).pipe(
      switchMap(data => 'errors' in data ? throwError(JSON.stringify(data.errors)) : of(data)),
      map(data => {
        let message: Message = data.message;

        message.content = text;

        return message;
      }),
      tap((message: Message) => {
        // in case message came too fast from socket service
        if (this.messages.find((m: Message) => m.uuid === message.uuid)) {
          this.messages[this.messages.findIndex((m: Message) => m.uuid === message.uuid)] = message;

          return;
        }

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
      .filter((m: Message) => m.author.uuid !== this.authService.user.uuid && !m.read);

    if (!messages.length)
      return empty();

    let message = messages[messages.length - 1];

    return this.socketService.emit('read.messages.since', { message: message.uuid }).pipe(
      switchMap(data => 'errors' in data ? throwError(JSON.stringify(data.errors)) : of(data['messages'])),
      tap((messages: Message[]) => {
        for (let message of messages) {
          let unread = this.messages.find((m: Message) => m.uuid === message.uuid);

          if (unread) {
            // abusing muttable js behavior
            unread.read = message.read;
            unread.readAt = message.readAt;
          }
        }
      })
    );
  }

  scrollDown(): void {
    let unreadMessages = this.messages.filter(m => m.author.uuid !== this.authService.user.uuid && !m.read);

    if (unreadMessages.length === 0) {
      this.messagesList.last.nativeElement.scrollIntoView();
    }

    if (!!unreadMessages.length) {
      let firstUnreadMessage = this.messagesList.find(el => el.nativeElement.getAttribute('data-uuid') === unreadMessages[0].uuid);

      firstUnreadMessage.nativeElement.scrollIntoView();
    }
  }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      // read & scroll down on init
      if (!!this.messagesList.length) {
        this.scrollDown();

        this.read$().subscribe();
      }

      if (!this.messagesList.length) {
        this.messagesList.changes.pipe(
          first((ql: QueryList<ElementRef>) => !!ql.length),
          tap(() => this.scrollDown()),
          switchMap((ql: QueryList<ElementRef>) => merge(
            this.read$().pipe(
              ignoreElements()
            ),
            of(ql)
          )),
          takeUntil(this.unsubscribe$)
        ).subscribe();
      }

      // autoscroll on new message
      this.messagesList.changes.pipe(
        takeUntil(this.unsubscribe$)
      ).subscribe((ql: QueryList<ElementRef>) => {
        if (this.isScrolledDown) {
          let unreadMessages = this.messages.filter(m => m.author.uuid !== this.authService.user.uuid && !m.read);

          if (!!this.messages.length && !unreadMessages.length) {
            this.messagesList.last.nativeElement.scrollIntoView();
          }

          if (unreadMessages.length === 1) {
            let firstUnreadMessage = this.messagesList.find(el => el.nativeElement.getAttribute('data-uuid') === unreadMessages[0].uuid);

            firstUnreadMessage.nativeElement.scrollIntoView();
          }
        }
      });

      fromEvent(this.startSecretChat.nativeElement as HTMLElement, 'click').pipe(
        tap(() => this.isSecretChatLoading = true),
        exhaustMap(() => this.repositoryService.getSecretConferenceByParticipant(this.participant.uuid).pipe(
          switchMap((conference: Conference|null) => {
            if (!conference) {
              return this.socketService.emit('start.secret.chat', { user: this.participant.uuid }).pipe(
                switchMap(data => {
                  if ('errors' in data)
                    return throwError(data['errors']);

                  let conference: Conference = data['conference'] as Conference;

                  return of(conference);
                }),
                switchMap((conference: Conference) => {
                  if (!('last_message' in conference))
                    return of(conference);

                  return zip(of(conference), this.databaseService.user$.pipe(first())).pipe(
                    switchMap(([ conference, user ]) => {
                      let decrypted$ = this.crypterService.decrypt(conference.last_message.content, user.private_key);

                      return zip(of(conference), decrypted$).pipe(
                        map(([ conference, decrypted ]) => {
                          conference.last_message.content = decrypted;

                          return conference;
                        })
                      );
                    })
                  );
                })
              );
            }

            return of(conference);
          }),
          takeUntil(this.onOptionsClosed$.pipe(
            tap(() => this.isSecretChatLoading = false)
          ))
        )),
        tap(() => this.isSecretChatLoading = false),
        tap((conference: Conference) => {
          // https://github.com/angular/angular/issues/25658
          let route = this.router.config
            .find(r => r.path === '')
            .children
            .find(r => r.path === 'conference/s/:uuid');

          route.data['conference'] = conference;

          this.router.navigate([`conference/s/${this.participant.uuid}`]);
        }),
        takeUntil(this.unsubscribe$)
      ).subscribe();

      fromEvent(this.scroller.nativeElement as HTMLElement, 'scroll').pipe(
        filter(() => this.isFocused),
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
