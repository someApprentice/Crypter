import { Component, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';

import { Observable, Subscription, Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';

import { MessengerService } from '../messenger.service';

import { User } from '../../../models/User';
import { Message } from '../../../models/Message';

@Component({
  selector: 'app-search-user',
  templateUrl: './search-user.component.html',
  styleUrls: ['./search-user.component.css']
})
export class SearchUserComponent implements OnInit, OnDestroy {
  @Output() searching = new EventEmitter<boolean>();

  isUsersLoading: boolean = false;

  users: User[] = [];
  users$: Subscription;

  selected?: User;

  error?:string;

  private searchTerms = new Subject<string>();

  constructor(private messengerService: MessengerService, private router: Router) {}

  ngOnInit() {
    this.users$ = this.searchTerms.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      tap(() => {
        this.isUsersLoading = true
        this.users = [];
      }),
      switchMap((term: string) => {
        if (term) {
          this.searching.emit(true);

          return this.messengerService.searchUsers(term)
        }

        this.searching.emit(false);

        return of([] as User[]);
      }),
      tap(() => this.isUsersLoading = false)
    ).subscribe(users => {
      this.users = users;
    });
  }

  search(term: string): void {
    this.searchTerms.next(term);
  }

  ngOnDestroy() {
    if (this.users$) {
      this.users$.unsubscribe();
    }
  }
}
