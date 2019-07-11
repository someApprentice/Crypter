import { Component, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';

import {NgbModal} from '@ng-bootstrap/ng-bootstrap';


import { Observable, Subscription, Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

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

  users: User[] = [];
  users$: Subscription;

  selected?: User;

  error?:string;

  private searchTerms = new Subject<string>();

  constructor(private messengerService: MessengerService, private router: Router, private modalService: NgbModal) {}

  ngOnInit() {
    this.users$ = this.searchTerms.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((term: string) => {
        if (term) {
          this.searching.emit(true);

          return this.messengerService.searchUsers(term)
        }

        this.searching.emit(false);

        return of([] as User[]);
      })
    ).subscribe(users => {
      this.users = users;
    });
  }

  search(term: string): void {
    this.searchTerms.next(term);
  }

  select(user: User, content:any) {
    this.selected = user;

    this.modalService.open(content, {ariaLabelledBy: 'modal-basic-title'});
  }

  onSent(message: Message) {
    this.router.navigate(['conference', message.conference]);
  }

  close() {
    this.selected = undefined;
  }

  ngOnDestroy() {
    if (this.users$) {
      this.users$.unsubscribe();
    }
  }
}
