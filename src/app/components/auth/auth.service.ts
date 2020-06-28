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
    if ('hash' in this.storageService.storage) {
      this.user = <User> {
        uuid: this.storageService.storage.uuid,
        email: this.storageService.storage.email,
        name: this.storageService.storage.name,
        hash: this.storageService.storage.hash,
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
      first()
    );
  }

  login(email: string, password: string): Observable<User> {
    return this.http.post<User>('/api/auth/login', { email, password }, { withCredentials: true }).pipe(
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
