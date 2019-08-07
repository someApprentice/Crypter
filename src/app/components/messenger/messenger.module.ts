import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { InViewportModule } from 'ng-in-viewport';
import { AutofocusModule } from '../../modules/autofocus/autofocus.module';

import { MessengerRoutingModule } from './messenger-routing.module';

import { MessengerComponent } from './messenger.component';
import { ConferencesComponent } from './conferences/conferences.component';
import { PrivateConferenceComponent } from './conferences/conference/private/private-conference.component';
import { PublicConferenceComponent } from './conferences/conference/public/public-conference.component';
import { SearchUserComponent } from './search-user/search-user.component';
import { MessageFormComponent } from './message-form/message-form.component';


@NgModule({
  declarations: [
    MessengerComponent,
    ConferencesComponent,
    PrivateConferenceComponent,
    PublicConferenceComponent,
    SearchUserComponent,
    MessageFormComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    InfiniteScrollModule,
    InViewportModule,
    AutofocusModule,
    MessengerRoutingModule
  ],
  exports: [
    MessengerComponent
  ]
})
export class MessengerModule { }
