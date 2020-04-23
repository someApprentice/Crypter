import { Component, OnInit } from '@angular/core';

import { AuthService } from '../auth/auth.service';

import { User } from '../../models/user.model';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css']
})
export class MainComponent implements OnInit {
  constructor(
    public authService: AuthService,
  ) { }

  ngOnInit() {}
}
