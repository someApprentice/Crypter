import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';

import { Observable, of, throwError } from 'rxjs';
import { delay, tap, map, catchError } from 'rxjs/operators';

import { StorageService } from '../../services/storage/storage.service';

import { User } from '../../models/User';

import { AuthenticationFailedError } from '../../models/errors/AuthenticationFailedError';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  user?: User;

  constructor(private http: HttpClient, private storageService: StorageService) {
    if ('jwt' in this.storageService.storage) {
      this.user = <User> {
        uuid: this.storageService.storage.uuid,
        email: this.storageService.storage.email,
        name: this.storageService.storage.name,
        jwt: this.storageService.storage.jwt,
        last_seen: this.storageService.storage.last_seen
      };
    }
  }

  registrate(email:string, name:string, password:string, publicKey:string, privateKey:string, revocationCertificate:string): Observable<User> {
    let data = {
      email,
      name,
      password,
      public_key: publicKey,
      private_key: privateKey,
      revocation_certificate: revocationCertificate
    };

    return this.http.post<User>('/api/auth/registrate', data, { headers: new HttpHeaders({ 'Content-Type': 'application/json' }), withCredentials: true }).pipe(
      tap(d => this.user = <User> d),
      catchError(this.handleErrors)
    );
  }

  login(email:string, password:string): Observable<User> {
    return this.http.post<User>('/api/auth/login', { email, password }, { withCredentials: true }).pipe(
      tap(d => this.user = <User> d),
      catchError(this.handleErrors)
    );
  }

  logout(): Observable<boolean> {
    // responseType: 'text' as 'json' https://github.com/angular/angular/issues/18586
    return this.http.post<any>('/api/auth/logout', {}, { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.user.jwt}` }), withCredentials: true, responseType: 'text' as 'json' }).pipe(
      map(d => true),
      tap(d => this.user = undefined),
      catchError(this.handleErrors)
    )
  }

  isEmailExist(email:string): Observable<boolean> {
    // responseType: 'text' as 'json' https://github.com/angular/angular/issues/18586
    return this.http.get<any>(`/api/auth/email/${email}`, { responseType: 'text' as 'json' }).pipe(
      map(d => true),
      catchError(err => {
        if (err.status === 404) {
          return of(false);
        }

        return throwError(err);
      })
    );
  }

  getUser(uuid:string):Observable<User> {
    return this.http.get<User>(`/api/auth/user/${uuid}`, { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.user.jwt}` }) });
  }

  handleErrors(err: HttpErrorResponse) {
    if (err.status === 404) {
      return throwError(new AuthenticationFailedError());
    }

    return throwError(err);
  }
}
