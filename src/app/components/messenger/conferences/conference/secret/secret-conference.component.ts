import { environment } from '../../../../../../environments/environment';

import { Component, Injector, Inject, ViewChild, ViewChildren, ElementRef, QueryList, HostListener, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer, DOCUMENT } from '@angular/common';
import { TransferState, makeStateKey } from '@angular/platform-browser';

import { Observable, Subscription, Subject, of, from, fromEvent, zip, concat, merge, timer, empty, throwError } from 'rxjs';
import { switchMap, concatMap, exhaustMap, delayWhen, map, tap, first, reduce, filter, ignoreElements, debounceTime, distinctUntilChanged, retry, catchError, takeUntil } from 'rxjs/operators';

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
  selector: 'app-secret-conference',
  templateUrl: './secret-conference.component.html',
  styleUrls: ['./secret-conference.component.css']
})
export class SecretConferenceComponent implements OnInit, AfterViewInit, OnDestroy {
  form = new FormGroup({
    message: new FormControl('', [
      Validators.required
    ])
  });

  @ViewChild('backToNormalChat', { read: ElementRef }) private backToNormalChat: ElementRef;

  onOptionsClosed$ = new Subject<void>();

  @ViewChild('scroller') private scroller: ElementRef;
  isScrolledDown: boolean = false;

  isFocused: boolean = true;

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
        switchMap((uuid: string) => this.messengerService.getSecretConferenceByParticipant(uuid)),
        switchMap((conference: Conference|null) => {
          if (!conference)
            return throwError(new Error("Conference doesn't exist"));

          return of(conference);
        }),
        tap((conference: Conference) => {
          this.conference = conference;
          this.participant = conference.participant;

          this.state.set(CONFERENCE_STATE_KEY, conference);
          this.state.set(PARTICIPANT_STATE_KEY, conference.participant);
        }),
        switchMap((conference: Conference) => {
          if (!conference.messages_count)
            return of([] as Message[]);

          if (conference.unread_messages_count > environment.batch_size)
            return this.messengerService.getUnreadSecretMessagesWithMessagesBeforeByParticipant(conference.participant.uuid).pipe(
                tap((messages: Message[]) => {
                  let unreadMessages = messages.filter((m: Message) => !m.read);

                  if (!!unreadMessages.length)
                    this.firstUnreadMessage = unreadMessages[0];
                })
              );

          return this.messengerService.getSecretMessagesByParticipant(conference.participant.uuid);
        })
      ).subscribe({
        next: (messages: Message[]) => {
          this.messages = messages;

          this.messages.sort((a: Message, b: Message) => a.date - b.date);

          this.state.set(MESSAGES_STATE_KEY, messages as Message[]);
        },
        error: () => this.router.navigate([''])
      });
    }

    if (isPlatformBrowser(this.platformId)) {
      this.participant = this.state.get(PARTICIPANT_STATE_KEY, undefined);
      this.conference = this.state.get(CONFERENCE_STATE_KEY, undefined);
      this.messages = this.state.get(MESSAGES_STATE_KEY, [] as Message[]);

      if (this.conference) {
        if (!this.participant)
          this.participant = this.conference.participant;

        let conference = cloneDeep(this.conference);

        of(conference).pipe(
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
          }),
          tap((conference: Conference) => this.conference = conference),
          switchMap((conference: Conference) => merge(
            this.databaseService.upsertConference(conference).pipe(ignoreElements()),
            of(conference)
          )),
          switchMap((conference: Conference) => {
            if (!conference.messages_count)
              return of([] as Message[]);

            if (!!this.messages.length) {
              // decryption mutates Message objects in template
              // and breaks scroll down on initialization that triggers on a first change
              let clone = cloneDeep(this.messages);

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
                switchMap((messages: Message[]) => merge(
                  this.databaseService.bulkMessages(messages).pipe(ignoreElements()),
                  of(messages)
                ))
              );
            }

            this.isMessagesLoading = true;

            if (conference.unread_messages_count > environment.batch_size)
              return this.repositoryService.getUnreadSecretMessagesWithMessagesBeforeByParticipant(conference.participant.uuid).pipe(
                tap((messages: Message[]) => {
                  let unreadMessages = messages.filter((m: Message) => !m.read);

                  if (!!unreadMessages.length)
                    this.firstUnreadMessage = unreadMessages[0];
                })
              );

            return this.repositoryService.getSecretMessagesByParticipant(conference.participant.uuid);
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

      if (!this.conference) {
        this.route.data.pipe(
          first(),
          switchMap(data => {
            if ('conference' in data)
              return of(data['conference']);

            return this.route.params.pipe(
              first(),
              map(params => params['uuid']),
              tap(() => this.isParticipantLoading = true),
              switchMap((uuid: string) => this.repositoryService.getSecretConferenceByParticipant(uuid)),
              switchMap((conference: Conference|null) => {
                if (!conference)
                  return throwError(new Error("Conference doesn't exist"));
                  
                return of(conference);
              })
            );
          }),
          tap((conference: Conference) => this.conference = conference),
          tap((conference: Conference) => this.participant = conference.participant),
          tap(() => this.isParticipantLoading = false),
          tap(() => this.isMessagesLoading = true),
          switchMap((conference: Conference) => {
            if (conference && !conference.messages_count)
              return of([] as Message[]);

            if (conference.unread_messages_count > environment.batch_size)
              return this.repositoryService.getUnreadSecretMessagesWithMessagesBeforeByParticipant(conference.participant.uuid).pipe(
                tap((messages: Message[]) => {
                  let unreadMessages = messages.filter((m: Message) => !m.read);

                  if (!!unreadMessages.length)
                    this.firstUnreadMessage = unreadMessages[0];
                })
              );

            return this.repositoryService.getSecretMessagesByParticipant(conference.participant.uuid);
          }),
          tap(() => this.isMessagesLoading = false),
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
          error: (err) => this.router.navigate([''])
        });
      }

      this.socketService.conferenceUpdated$.pipe(
        filter((conference: Conference) => conference.uuid === this.conference.uuid),
        takeUntil(this.unsubscribe$)
      ).subscribe((conference: Conference) => {
        this.conference = conference;
      });

      this.socketService.secretMessage$.pipe(
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

      this.socketService.messageRead$.pipe(
        filter((message: Message) => message.conference.participant && message.conference.participant.uuid === this.participant.uuid),
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
        map((messages: Message[]) => messages.filter((m: Message) => m.conference.participant && m.conference.participant.uuid === this.participant.uuid)),
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
        exhaustMap(() => this.socketService.emit('write.to.secret.conference', { 'conference': this.conference.uuid })),
        takeUntil(this.unsubscribe$)
      ).subscribe();

      this.socketService.wroteToSecretConference$.pipe(
        filter((user: User) => user.uuid === this.participant.uuid),
        tap(() => this.writing = true),
        switchMap(() => timer(2333)),
        tap(() => this.writing = false),
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

      this.repositoryService.getOldSecretMessagesByParticipant(this.participant.uuid, timestamp).pipe(
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

      let lastMessage = this.messages[this.messages.length -1];

      this.repositoryService.getNewSecretMessagesByParticipant(this.participant.uuid, timestamp).pipe(
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
    this.isFocused = true;

    this.read$().subscribe();
  }

  @HostListener('window:blur', ['$event'])
  onBlur(event: Event): void {
    this.isFocused = false;
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
        return { 'to': this.participant.uuid, 'encrypted': encrypted };
      }),
      switchMap(data => this.socketService.emit('secret.message.sent', data)),
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

      fromEvent(this.backToNormalChat.nativeElement as HTMLElement, 'click').pipe(
        tap(() => this.router.navigate([`conference/u/${this.participant.uuid}`])),
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
    
    let route = this.router.config
      .find(r => r.path === '')
      .children
      .find(r => r.path === 'conference/s/:uuid');

    delete route.data['conference'];

    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
