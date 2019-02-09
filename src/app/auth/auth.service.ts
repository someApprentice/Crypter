import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';

import { Observable, of, throwError } from 'rxjs';
import { delay, tap, map, catchError } from 'rxjs/operators';

import { StorageService } from '../storage.service';

import { User } from '../models/User';

import { AuthenticationFailedError } from '../models/errors/AuthenticationFailedError';


@Injectable({
  providedIn: 'root'
})
export class AuthService {
  isLoggedIn: boolean = false;

  constructor(private http: HttpClient, private storageService: StorageService) {
    if ('jwt' in this.storageService.storage) {
      this.isLoggedIn = true;
    }
  }

  registrate(email, name, password): Observable<User> {
    return this.http.post<User>('/api/registrate', { email, name, password }, { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }).pipe(
      tap(d => this.isLoggedIn = true),
      catchError(this.handleErrors)
    );
  }

  login(email, password): Observable<User> {
    return this.http.post<User>('/api/login', { email, password }).pipe(
      tap(() => this.isLoggedIn = true),
      catchError(this.handleErrors)
    );
  }

  logout(): Observable<boolean> {
    let jwt = this.storageService.storage.jwt;

    // Is it right way to turn Observable<T> to Observable<boolean>?
    // responseType: 'text' as 'json' https://github.com/angular/angular/issues/18586
    return this.http.post<any>('/api/logout', {}, { headers: new HttpHeaders({ 'Authorization': `Bearer ${jwt}` }), responseType: 'text' as 'json' }).pipe(
      map(d => true),
      tap(() => this.isLoggedIn = false),
      catchError(this.handleErrors)
    )
  }

  isEmailExist(email): Observable<boolean> {
    // Is it right way to turn Observable<T> to Observable<boolean>?
    return this.http.get<{ email: string, exist: boolean }>(`/api/email/${email}`).pipe(
      map(d => d.exist),
      catchError(this.handleErrors)
    );
  }

  handleErrors(err) {
    if (err.status === 404) {
      return throwError(new AuthenticationFailedError());
    }

    return throwError(err);
  }
}
