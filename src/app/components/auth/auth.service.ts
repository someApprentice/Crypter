import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';

import { Observable, of, throwError } from 'rxjs';
import { first, delay, tap, map, catchError } from 'rxjs/operators';

import { StorageService } from '../../services/storage/storage.service';

import { User } from '../../models/user.model';

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

  registrate(email: string, name: string, password: string, publicKey: string, privateKey: string, revocationCertificate: string): Observable<User> {
    return this.http.post<User>(
      '/api/auth/registrate',
      {
        email,
        name,
        password,
        public_key: publicKey,
        private_key: privateKey,
        revocation_certificate: revocationCertificate
      },
      {
        headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
        withCredentials: true
      }
    ).pipe(
      first(),
      tap((user: User) => this.user = user),
      tap((user: User) => {
        localStorage.setItem('uuid', user.uuid);
        localStorage.setItem('email', user.email);
        localStorage.setItem('name', user.name);
        localStorage.setItem('jwt', user.jwt);
        localStorage.setItem('last_seen', user.last_seen as unknown as string); // Conversion of type 'number' to type 'string' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
      })
    );
  }

  login(email: string, password: string): Observable<User> {
    return this.http.post<User>('/api/auth/login', { email, password }, { withCredentials: true }).pipe(
      first(),
      tap((user: User) => this.user = user),
      tap((user: User) => {
        localStorage.setItem('uuid', user.uuid);
        localStorage.setItem('email', user.email);
        localStorage.setItem('name', user.name);
        localStorage.setItem('jwt', user.jwt);
        localStorage.setItem('last_seen', user.last_seen as unknown as string); // Conversion of type 'number' to type 'string' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
      })
    );
  }

  logout(): Observable<boolean> {
    // responseType: 'text' as 'json' https://github.com/angular/angular/issues/18586
    return this.http.post<any>(
      '/api/auth/logout',
      {},
      {
        headers: new HttpHeaders({ 'Authorization': `Bearer ${this.user.jwt}` }),
        withCredentials: true, responseType: 'text' as 'json'
      }
    ).pipe(
      first(),
      map(d => true),
      tap(d => this.user = undefined),
      tap(d => {
        localStorage.removeItem('uuid');
        localStorage.removeItem('email');
        localStorage.removeItem('name');
        localStorage.removeItem('jwt');
        localStorage.removeItem('last_seen');
      })
    )
  }

  isEmailExist(email: string): Observable<boolean> {
    // responseType: 'text' as 'json' https://github.com/angular/angular/issues/18586
    return this.http.get<any>(`/api/auth/email/${email}`, { responseType: 'text' as 'json' }).pipe(
      first(),
      map(d => true),
      catchError(err => {
        if (err.status === 404) {
          return of(false);
        }

        return throwError(err);
      })
    );
  }

  getUser(uuid: string):Observable<User> {
    return this.http.get<User>(`/api/auth/user/${uuid}`, { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.user.jwt}` }) }).pipe(
      first()
    );
  }
}
