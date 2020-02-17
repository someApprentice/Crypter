import { Component, Injector, Inject, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';

import { Subscription, Subject, throwError, of } from 'rxjs';
import { map, switchMap, delayWhen, debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';

import { CrypterService } from '../../../services/crypter.service';

import { WampService } from '../../../services/wamp.service'
import { EventMessage } from 'thruway.js/src/Messages/EventMessage'

import { AuthService } from '../../auth/auth.service';

import { DatabaseService } from '../../../services/database/database.service';
import { MessageDocument } from '../../../services/database/documents/message.document';

import { User } from '../../../models/User';
import { Conference } from '../../../models/Conference';
import { Message }  from '../../../models/Message';


@Component({
  selector: 'app-message-form',
  templateUrl: './message-form.component.html',
  styleUrls: ['./message-form.component.css']
})
export class MessageFormComponent implements OnInit, OnDestroy {
  @Input() from: User;
  @Input() to: User;
  @Output() sent = new EventEmitter<Message>();

  form = new FormGroup({
    message: new FormControl('', [
      Validators.required
    ])
  });

  error?: string;

  writing = new Subject<string>()
  writing$?: Subscription;

  private wamp: WampService;
  private databaseService: DatabaseService;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private crypterService: CrypterService,
    private authService: AuthService,
    private injector: Injector
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.wamp = injector.get(WampService);
      this.databaseService = injector.get(DatabaseService);
    }
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.writing$ = this.writing.pipe(
        debounceTime(333),
        distinctUntilChanged(),
        switchMap(() => {
          let data = {
            'user': this.authService.user.uuid,
            'to': this.to,
            'Bearer token': this.authService.user.jwt
          }

          return this.wamp.call('write', [data]);
        })
      ).subscribe();
    }
  }

  send(text: string) {
    this.form.get('message').reset();

    // Encrypt message
    // Then send message to the wamp service
    // Then handle response errors
    // Then upsert conference
    // Then upsert message
    // And only after that reset form and emit event 
    this.crypterService.encrypt(text, [ this.from.public_key, this.to.public_key  ]).pipe(
      map(encrypted => {
        return { 'to': this.to.uuid, 'text': encrypted, 'Bearer token': this.authService.user.jwt  };
      }),
      switchMap(data => this.wamp.call('send', [data])),
      switchMap(res => (Object.keys(res.args[0].errors).length > 0) ? throwError(JSON.stringify(res.args[0].errors)) : of(res)),
      delayWhen(res => {
        let conference: Conference = {
          uuid: res.args[0].conference.uuid,
          updated: res.args[0].conference.updated,
          count: res.args[0].conference.count,
          unread: res.args[0].conference.unread,
          participant: res.args[0].conference.participant
        };

        return this.databaseService.upsertConference(conference);
      }),
      delayWhen(res => {
        let message: Message = res.args[0].message;

        message.content = text;

        return this.databaseService.upsertMessage(message);
      })
    ).subscribe(
      res => {
        let message: Message = res.args[0].message;

        this.sent.emit(message);
      },
      err => {
        if (err instanceof Error || 'message' in err) { // TypeScript instance of interface check
          this.error = err.message;
        }
      }
    );
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
    this.writing.next(value);
  }

  ngOnDestroy() {
    if (this.writing$) {
      this.writing$.unsubscribe();
    }
  }
}
