import { Component, OnInit, OnDestroy } from '@angular/core';

import { Router, ActivatedRoute } from '@angular/router';

import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AuthService } from '../auth/auth.service';
import { StorageService } from '../../services/storage/storage.service';

import { User } from '../../models/user.model';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css']
})
export class MainComponent implements OnInit, OnDestroy {
  private unsubscribe$ = new Subject<void>();

  // The purpose of this property is to pass User to the MessengerComponent
  // so that it upserts him into IndexeDB on log in.
  user?: User;

  constructor(
    public authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit() {
    this.route.data.pipe(takeUntil(this.unsubscribe$)).subscribe(d => {
      if ('user' in d) {
        this.user = d['user'];
      }
    });
  }

  ngOnDestroy() {
    let route = this.router.config.find(r => this instanceof r.component);

    delete route.data['user'];

    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
