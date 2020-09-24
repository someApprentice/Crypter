import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { LayoutModule } from '@angular/cdk/layout';
import { MatMenuModule } from '@angular/material/menu';
import { AutofocusModule } from '../../modules/autofocus/autofocus.module';

import { MessengerRoutingModule } from './messenger-routing.module';

import { MessengerComponent } from './messenger.component';
import { SettingsComponent } from './settings/settings.component';
import { ConferencesComponent } from './conferences/conferences.component';
import { PrivateConferenceComponent } from './conferences/conference/private/private-conference.component';
import { SecretConferenceComponent } from './conferences/conference/secret/secret-conference.component';
import { SearchUserComponent } from './search-user/search-user.component';
import { SanitizePipe } from '../../pipes/ng/sanitize/sanitize.pipe';
import { LinkifyPipe } from '../../pipes/ng/linkify/linkify.pipe';

@NgModule({
  declarations: [
    MessengerComponent,
    SettingsComponent,
    ConferencesComponent,
    PrivateConferenceComponent,
    SecretConferenceComponent,
    SearchUserComponent,
    SanitizePipe,
    LinkifyPipe,
  ],
  imports: [
    CommonModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    InfiniteScrollModule,
    LayoutModule,
    MatMenuModule,
    AutofocusModule,
    MessengerRoutingModule
  ],
  exports: [
    MessengerComponent
  ]
})
export class MessengerModule { }
