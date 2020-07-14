import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { AutofocusModule } from '../../modules/autofocus/autofocus.module';

import { MessengerRoutingModule } from './messenger-routing.module';

import { MessengerComponent } from './messenger.component';
import { ConferencesComponent } from './conferences/conferences.component';
import { PrivateConferenceComponent } from './conferences/conference/private/private-conference.component';
import { SearchUserComponent } from './search-user/search-user.component';

@NgModule({
  declarations: [
    MessengerComponent,
    ConferencesComponent,
    PrivateConferenceComponent,
    SearchUserComponent
  ],
  imports: [
    CommonModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    InfiniteScrollModule,
    AutofocusModule,
    MessengerRoutingModule
  ],
  exports: [
    MessengerComponent
  ]
})
export class MessengerModule { }
