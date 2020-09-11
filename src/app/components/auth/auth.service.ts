import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';

import { Observable, of, throwError } from 'rxjs';
import { first, delay, tap, map, catchError } from 'rxjs/operators';

import { StorageService } from '../../services/storage/storage.service';

import User from '../../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  user?: User;

  constructor(private http: HttpClient, private storageService: StorageService) {
    if ('hash' in this.storageService.storage) {
      this.user = <User> {
        uuid: this.storageService.storage.uuid,
        email: this.storageService.storage.email,
        name: this.storageService.storage.name,
        hash: this.storageService.storage.hash,
        conferences_count: this.storageService.storage.conferences_count,
        last_seen: this.storageService.storage.last_seen
      };
    }
  }

  registrate(
      email: string, name: string,
      password: string,
      fingerprint: string,
      public_key: string,
      private_key: string,
      revocation_certificate: string,
      recaptcha_token?: string
  ): Observable<User> {
    let data: {
      email: string,
      name: string,
      password: string,
      fingerprint: string,
      public_key: string,
      private_key: string,
      revocation_certificate: string,
      recaptcha_token?:string
    } = {
      email,
      name,
      password,
      fingerprint,
      public_key,
      private_key,
      revocation_certificate
    };

    if (recaptcha_token)
      data['recaptcha_token'] = recaptcha_token;

    return this.http.post<User>(
      '/api/auth/registrate',
      data,
      {
        headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
        withCredentials: true
      }
    ).pipe(
      first()
    );
  }

  login(email: string, password: string, recaptcha_token?: string): Observable<User> {
    let data: {
      email: string,
      password: string,
      recaptcha_token?: string
    } = {
      email,
      password
    };

    if (recaptcha_token)
      data['recaptcha_token'] = recaptcha_token;

    return this.http.post<User>('/api/auth/login', data, { withCredentials: true }).pipe(
      first()
    );
  }

  logout(): Observable<boolean> {
    // responseType: 'text' as 'json' https://github.com/angular/angular/issues/18586
    return this.http.post<any>(
      '/api/auth/logout',
      {},
      {
        headers: new HttpHeaders({ 'Authorization': `Bearer ${this.user.hash}` }),
        withCredentials: true, responseType: 'text' as 'json'
      }
    ).pipe(
      first(),
      map(d => true)
    )
  }

  isEmailExist(email: string): Observable<boolean> {
    // responseType: 'text' as 'json' https://github.com/angular/angular/issues/18586
    return this.http.get<any>(`/api/auth/email/${email}`, { responseType: 'text' as 'json' }).pipe(
      first(),
      map(d => true),
      catchError(err => {
        if (err.status === 404)
          return of(false);

        return throwError(err);
      })
    );
  }

  getUser(uuid: string):Observable<User> {
    return this.http.get<User>(`/api/auth/user/${uuid}`, { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.user.hash}` }) }).pipe(
      first()
    );
  }
}
