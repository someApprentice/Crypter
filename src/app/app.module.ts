import { BrowserModule, BrowserTransferStateModule } from '@angular/platform-browser';
import { NgModule, APP_INITIALIZER } from '@angular/core';
import { HttpClientModule }    from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { MainComponent } from './components/main/main.component';
import { NotFoundComponent } from './components/not-found/not-found.component';

import { AuthModule } from './components/auth/auth.module';
import { MessengerModule } from './components/messenger/messenger.module';

@NgModule({
  declarations: [
    AppComponent,
    MainComponent,
    NotFoundComponent
  ],
  imports: [
    BrowserModule.withServerTransition({appId: 'crypter'}),
    BrowserTransferStateModule,
    HttpClientModule,
    AuthModule,
    MessengerModule,
    AppRoutingModule
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
