import { Component, OnInit, OnDestroy } from '@angular/core';

import { Router, ActivatedRoute } from '@angular/router';

import { Subscription } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { StorageService } from '../../services/storage/storage.service';

import { User } from '../../models/User';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css']
})
export class MainComponent implements OnInit, OnDestroy {
  // The purpose of this property is to pass User to the MessengerComponent
  // so that it upserts him into IndexeDB on log in.
  user?: User;

  subscriptions: { [key:string]: Subscription } = { };
  
  constructor(
    public authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit() {
    this.subscriptions['this.route.data'] = this.route.data.subscribe(d => {
      if ('user' in d) {
        this.user = d['user'];
      }
    });
  }

  ngOnDestroy() {
    let route = this.router.config.find(r => this instanceof r.component);

    delete route.data.user;

    for (let key in this.subscriptions) {
      this.subscriptions[key].unsubscribe();
    }
  }
}
