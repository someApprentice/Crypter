import { environment } from '../../environments/environment';

import { Injectable, OnDestroy } from '@angular/core';

import { Observable, Subject, of, fromEvent, zip } from 'rxjs';
import { map, concatMap, shareReplay, takeUntil } from 'rxjs/operators';

import { AuthService } from '../components/auth/auth.service'
import { DatabaseService } from './database/database.service';
import { CrypterService } from './crypter.service';

import io from 'socket.io-client';
 
import { User } from '../models/user.model';
import { Conference } from '../models/conference.model';
import { Message } from '../models/message.model';

@Injectable()
export class SocketService implements OnDestroy {
  private unsubscribe$ = new Subject<void>();

  public socket = io(environment.socket_url, { path: environment.socket_path });

  public connected$: Observable<unknown> = fromEvent(this.socket, 'connect').pipe(
    takeUntil(this.unsubscribe$),
  );

  public disconnected$: Observable<unknown> = fromEvent(this.socket, 'disconnect').pipe(
    takeUntil(this.unsubscribe$)
  )

  public userUpdated$: Observable<User> = fromEvent(this.socket, 'user.updated').pipe(
    map(data => {
      // Type '{}' is not assignable to type 'User'. Property 'uuid' is missing in type '{}'.
      let user: User = data as User;

      return user;
    }),
    takeUntil(this.unsubscribe$)
  );

  public conferenceUpdated$: Observable<Conference> = fromEvent(this.socket, 'conference.updated').pipe(
    map(data => {
      // Type '{}' is not assignable to type 'Conference'. Property 'uuid' is missing in type '{}'.
      let conference: Conference = data as Conference;

      return conference;
    }),
    takeUntil(this.unsubscribe$)
  );

  public privateMessage$: Observable<Message> = fromEvent(this.socket, 'private.message.sent').pipe(
    map(data => {
      // Type '{}' is not assignable to type 'Message'. Property 'uuid' is missing in type '{}'.
      let message: Message = data as Message;

      return message;
    }),
    concatMap((message: Message) => zip(of(message), this.databaseService.user$)),
    concatMap(([ message, user ]) => {
      let decrypted$ = this.crypterService.decrypt(message.content, user.private_key);

      return zip(of(message), decrypted$).pipe(
        map(([ message, decrypted ]) => {
          message.content = decrypted;

          return message;
        })
      );
    }),
    takeUntil(this.unsubscribe$)
  );

  public privateMessageRead$: Observable<Message> = fromEvent(this.socket, 'private.message.read').pipe(
    map(data => {
      // Type '{}' is not assignable to type 'Message'. Property 'uuid' is missing in type '{}'.
      let message: Message = data as Message;

      return message;
    }),
    takeUntil(this.unsubscribe$)
  );

  public wroteToUser$: Observable<User> = fromEvent(this.socket, 'wrote.to.user').pipe(
    map(data => {
      // Type '{}' is not assignable to type 'User'. Property 'uuid' is missing in type '{}'.
      let user: User = data as User;

      return user;
    }),
    takeUntil(this.unsubscribe$)
  );

  constructor(
    private authService: AuthService,
    private databaseService: DatabaseService,
    private crypterService: CrypterService
  ) { }

  emit(e: string, data: any): Observable<any> {
    let observable = new Observable(subscriber => {
      this.socket.emit(e, data, (d: any) => {
        if (d)
          subscriber.next(d);

        subscriber.complete();
      })
    });

    return observable;
  }

  ngOnDestroy() {
    this.socket.close();

    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
