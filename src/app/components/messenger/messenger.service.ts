import { Injectable } from '@angular/core';

import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

import { AuthService } from '../auth/auth.service';

import { User } from '../../models/User';
import { Conference } from '../../models/Conference';
import { Message } from '../../models/Message';

@Injectable({
  providedIn: 'root'
})
export class MessengerService {
  // const
  static readonly BATCH_SIZE = 20;

  constructor(private http: HttpClient, private authService: AuthService) { }

  searchUsers(name: string): Observable<User[]> {
    return this.http.get<User[]>(`/api/search?name=${name}`);
  }

  getConferences(): Observable<Conference[]> {
    return this.http.get<Conference[]>('/api/messenger/conferences', { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.jwt}` }) });
  }

  getConference(uuid: string): Observable<Conference> {
    return this.http.get<Conference>(`/api/messenger/conference/${uuid}`, { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.jwt}` }) });
  }

  getMessages(): Observable<Message[]> {
    return this.http.get<Message[]>('/api/messenger/messages', { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.jwt}` }) });
  }

  getMessagesByConference(uuid: string): Observable<Message[]> {
    return this.http.get<Message[]>(`/api/messenger/messages/${uuid}`, { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.jwt}` }) });
  }

  getOldMessageByConference(uuid: string, timestamp: number, limit: number = MessengerService.BATCH_SIZE): Observable<Message[]> {
    return this.http.get<Message[]>(`/api/messenger/old_messages/${uuid}?timestamp=${timestamp}&limit=${limit}`, { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.user.jwt}` }) });
  }
}