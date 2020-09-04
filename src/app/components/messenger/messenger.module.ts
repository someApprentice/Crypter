import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { MatMenuModule } from '@angular/material/menu';
import { AutofocusModule } from '../../modules/autofocus/autofocus.module';

import { MessengerRoutingModule } from './messenger-routing.module';

import { MessengerComponent } from './messenger.component';
import { ConferencesComponent } from './conferences/conferences.component';
import { PrivateConferenceComponent } from './conferences/conference/private/private-conference.component';
import { SecretConferenceComponent } from './conferences/conference/secret/secret-conference.component';
import { SearchUserComponent } from './search-user/search-user.component';

@NgModule({
  declarations: [
    MessengerComponent,
    ConferencesComponent,
    PrivateConferenceComponent,
    SecretConferenceComponent,
    SearchUserComponent
  ],
  imports: [
    CommonModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    InfiniteScrollModule,
    MatMenuModule,
    AutofocusModule,
    MessengerRoutingModule
  ],
  exports: [
    MessengerComponent
  ]
})
export class MessengerModule { }
