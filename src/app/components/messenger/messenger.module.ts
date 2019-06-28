import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { AutofocusModule } from '../../modules/autofocus/autofocus.module';

import { MessengerRoutingModule } from './messenger-routing.module';

import { MessengerComponent } from './messenger.component';
import { ConferencesComponent } from './conferences/conferences.component';
import { ConferenceComponent } from './conferences/conference/conference.component';
import { SearchUserComponent } from './search-user/search-user.component';
import { MessageFormComponent } from './message-form/message-form.component';


@NgModule({
  declarations: [
    MessengerComponent,
    ConferencesComponent,
    ConferenceComponent,
    SearchUserComponent,
    MessageFormComponent,
  ],
  imports: [
    CommonModule,
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
