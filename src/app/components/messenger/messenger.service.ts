import { environment } from '../../../environments/environment';

import { Injectable } from '@angular/core';

import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';

import { Observable, of, throwError } from 'rxjs';
import { first, catchError } from 'rxjs/operators';

import { AuthService } from '../auth/auth.service';

import User from '../../models/user.model';
import Conference from '../../models/conference.model';
import Message from '../../models/message.model';

@Injectable({
  providedIn: 'root'
})
export class MessengerService {
  constructor(private http: HttpClient, private authService: AuthService) { }

  searchUsers(name: string): Observable<User[]> {
    return this.http.get<User[]>(
      `/api/search?name=${name}`,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.hash}` })}
    ).pipe(
      first()
    );
  }

  getConferences(timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Conference[]> {
    return this.http.get<Conference[]>(
      `/api/messenger/conferences?timestamp=${timestamp}&limit=${limit}`,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.hash}` })}
    ).pipe(
      first()
    );
  }

  getOldConferences(timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Conference[]> {
    return this.http.get<Conference[]>(
      `/api/messenger/old_conferences?timestamp=${timestamp}&limit=${limit}`,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.hash}` })}
    ).pipe(
      first()
    );
  }

  getNewConferences(timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Conference[]> {
    return this.http.get<Conference[]>(
      `/api/messenger/new_conferences?timestamp=${timestamp}&limit=${limit}`,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.hash}` })}
    ).pipe(
      first()
    );
  }

  getConference(uuid: string): Observable<Conference> {
    return this.http.get<Conference>(
      `/api/messenger/conference/${uuid}`,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.hash}` }) }
    ).pipe(
      first()
    );
  }

  getConferenceByParticipant(uuid: string): Observable<Conference|null> {
    return this.http.get<Conference>(
      `/api/messenger/conference_by_participant/${uuid}`,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.hash}` }) }
    ).pipe(
      first(),
      catchError(err => {
        if (err.status === 404)
          return of(null);

        return throwError(err);
      })
    );
  }

  getSecretConferenceByParticipant(uuid: string): Observable<Conference|null> {
    return this.http.get<Conference>(
      `/api/messenger/secret_conference_by_participant/${uuid}`,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.hash}` }) }
    ).pipe(
      first(),
      catchError(err => {
        if (err.status === 404)
          return of(null);

        return throwError(err);
      })
    );
  }

  getReadMessages(timestamp: number = 0): Observable<Message[]> {
    return this.http.get<Message[]>(
      `/api/messenger/read_messages/?timestamp=${timestamp}`,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.hash}` }) }
    ).pipe(
      first()
    );
  }

  getMessages(): Observable<Message[]> {
    return this.http.get<Message[]>(
      '/api/messenger/messages',
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.hash}` }) }
    ).pipe(
      first()
    );
  }

  getMessagesByConference(uuid: string, timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Message[]> {
    return this.http.get<Message[]>(
      `/api/messenger/messages/${uuid}?timestamp=${timestamp}&limit=${limit}`,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.hash}` }) }
    ).pipe(
      first()
    );
  }

  getUnreadMessagesByConference(uuid: string, timestamp: number = 0, limit: number = environment.batch_size): Observable<Message[]> {
    return this.http.get<Message[]>(
      `/api/messenger/unread_messages/${uuid}?timestamp=${timestamp}&limit=${limit}`,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.hash}` }) }
    ).pipe(
      first()
    );
  }

  getUnreadMessagesWithMessagesBeforeByConference(uuid: string, timestamp: number = 0, limit: number = environment.batch_size): Observable<Message[]> {
    return this.http.get<Message[]>(
      `/api/messenger/unread_messages_with_messages_before/${uuid}?timestamp=${timestamp}&limit=${limit}`,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.hash}` }) }
    ).pipe(
      first()
    );
  }

  getOldMessagesByConference(uuid: string, timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Message[]> {
    return this.http.get<Message[]>(
      `/api/messenger/old_messages/${uuid}?timestamp=${timestamp}&limit=${limit}`,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.hash}` }) }
    ).pipe(
      first()
    );
  }

  getNewMessagesByConference(uuid: string, timestamp: number = 0, limit: number = environment.batch_size): Observable<Message[]> {
    return this.http.get<Message[]>(
      `/api/messenger/new_messages/${uuid}?timestamp=${timestamp}&limit=${limit}`,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.hash}` }) }
    ).pipe(
      first()
    );
  }

  getMessagesByParticipant(uuid: string, timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Message[]> {
    return this.http.get<Message[]>(
      `/api/messenger/messages_by_participant/${uuid}?timestamp=${timestamp}&limit=${limit}`,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.hash}` }) }
    ).pipe(
      first()
    );
  }

  getUnreadMessagesByParticipant(uuid: string, timestamp: number = 0, limit: number = environment.batch_size): Observable<Message[]> {
    return this.http.get<Message[]>(
      `/api/messenger/unread_messages_by_participant/${uuid}?timestamp=${timestamp}&limit=${limit}`,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.hash}` }) }
    ).pipe(
      first()
    );
  }

  getUnreadMessagesWithMessagesBeforeByParticipant(uuid: string, timestamp: number = 0, limit: number = environment.batch_size): Observable<Message[]> {
    return this.http.get<Message[]>(
      `/api/messenger/unread_messages_with_messages_before_by_participant/${uuid}?timestamp=${timestamp}&limit=${limit}`,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.hash}` }) }
    ).pipe(
      first()
    );
  }

  getOldMessagesByParticipant(uuid: string, timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Message[]> {
    return this.http.get<Message[]>(
      `/api/messenger/old_messages_by_participant/${uuid}?timestamp=${timestamp}&limit=${limit}`,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.hash}` }) }
    ).pipe(
      first()
    );
  }

  getNewMessagesByParticipant(uuid: string, timestamp: number = 0, limit: number = environment.batch_size): Observable<Message[]> {
    return this.http.get<Message[]>(
      `/api/messenger/new_messages_by_participant/${uuid}?timestamp=${timestamp}&limit=${limit}`,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.hash}` }) }
    ).pipe(
      first()
    );
  }

  getSecretMessagesByParticipant(uuid: string, timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Message[]> {
    return this.http.get<Message[]>(
      `/api/messenger/secret_messages_by_participant/${uuid}?timestamp=${timestamp}&limit=${limit}`,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.hash}` }) }
    ).pipe(
      first()
    );
  }

  getUnreadSecretMessagesByParticipant(uuid: string, timestamp: number = 0, limit: number = environment.batch_size): Observable<Message[]> {
    return this.http.get<Message[]>(
      `/api/messenger/unread_secret_messages_by_participant/${uuid}?timestamp=${timestamp}&limit=${limit}`,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.hash}` }) }
    ).pipe(
      first()
    );
  }

  getUnreadSecretMessagesWithMessagesBeforeByParticipant(uuid: string, timestamp: number = 0, limit: number = environment.batch_size): Observable<Message[]> {
    return this.http.get<Message[]>(
      `/api/messenger/unread_secret_messages_with_messages_before_by_participant/${uuid}?timestamp=${timestamp}&limit=${limit}`,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.hash}` }) }
    ).pipe(
      first()
    );
  }

  getOldSecretMessagesByParticipant(uuid: string, timestamp: number = Date.now() / 1000, limit: number = environment.batch_size): Observable<Message[]> {
    return this.http.get<Message[]>(
      `/api/messenger/old_secret_messages_by_participant/${uuid}?timestamp=${timestamp}&limit=${limit}`,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.hash}` }) }
    ).pipe(
      first()
    );
  }

  getNewSecretMessagesByParticipant(uuid: string, timestamp: number = 0, limit: number = environment.batch_size): Observable<Message[]> {
    return this.http.get<Message[]>(
      `/api/messenger/new_secret_messages_by_participant/${uuid}?timestamp=${timestamp}&limit=${limit}`,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.hash}` }) }
    ).pipe(
      first()
    );
  }

  synchronize(min_timestamp: number = Date.now() / 1000, max_timestamp: number = 0): Observable<{ conferences: Conference[], messages: Message[], read_messages: Message[], unread_messages: Message[] }> {
    return this.http.get<{ conferences: Conference[], messages: Message[], read_messages: Message[], unread_messages: Message[] }>(
      `/api/messenger/synchronize/?min_timestamp=${min_timestamp}&max_timestamp=${max_timestamp}`,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.hash}` }) }
    ).pipe(
      first()
    );
  }
}
