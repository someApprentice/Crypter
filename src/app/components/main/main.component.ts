import { Component, OnInit } from '@angular/core';

import { AuthService } from '../auth/auth.service';
import { StorageService } from '../../services/storage/storage.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css']
})
export class MainComponent implements OnInit {
  
  constructor(public authService: AuthService) { }

  ngOnInit() { }
}
