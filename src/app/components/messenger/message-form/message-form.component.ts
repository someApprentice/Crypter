import { Component, Injector, Inject, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';

import { Subscription, throwError, of } from 'rxjs';
import { switchMap, delayWhen } from 'rxjs/operators';

import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';

import { WampService } from '../../../services/wamp.service'
import { EventMessage } from 'thruway.js/src/Messages/EventMessage'

import { AuthService } from '../../auth/auth.service';

import { DatabaseService } from '../../../services/Database/database.service';
import { MessageDocument } from '../../../services/Database/documents/message.document';

import { Conference } from '../../../models/Conference';
import { Message }  from '../../../models/Message';


@Component({
  selector: 'app-message-form',
  templateUrl: './message-form.component.html',
  styleUrls: ['./message-form.component.css']
})
export class MessageFormComponent implements OnInit, OnChanges {
  @Input() to: string;
  @Output() sent = new EventEmitter<Message>();

  form = new FormGroup({
    to: new FormControl('', [
      Validators.required
    ]),
    message: new FormControl('', [
      Validators.required
    ])
  });

  error?: string;


  private wamp: WampService;
  private databaseService: DatabaseService;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private authService: AuthService,
    private injector: Injector
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.wamp = injector.get(WampService);
      this.databaseService = injector.get(DatabaseService);
    }
  }

  ngOnChanges() {
    this.form.get('to').setValue(this.to);
  }

  ngOnInit() {
    this.form.get('to').setValue(this.to);
  }

  send(to: string, text: string) {
    let data = {
      'to': to,
      'text': text,
      'Bearer token': this.authService.user.jwt
    };

    // handle response errors
    // then upsert conference
    // then upsert message
    // and only after that reset a form and emit event
    this.wamp.call('send', [data])
    .pipe(
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

        return this.databaseService.upsertMessage(message);
      })
    )
    .subscribe(
      res => {
        let message: Message = res.args[0].message;

        this.sent.emit(message);

        this.form.get('message').reset();
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

    let to = this.form.get('to').value
    let text = this.form.get('message').value

    this.send(to, text);
  }

  onEnter(e: KeyboardEvent) {
    if (e.key == "Enter" && !e.shiftKey) {      
      e.preventDefault();

      let to = this.form.get('to').value
      let text = this.form.get('message').value

      this.send(to, text);
    }
  }
}
