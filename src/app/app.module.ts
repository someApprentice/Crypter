import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule }    from '@angular/common/http';
import { AutofocusModule } from './modules/autofocus/autofocus.module';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { AuthModule } from './auth/auth.module';
import { MainComponent } from './main/main.component';
import { WelcomeComponent } from './auth/welcome/welcome.component';
import { LogoutComponent } from './auth/logout/logout.component';
import { NotFoundComponent } from './not-found/not-found.component';


@NgModule({
  declarations: [
    AppComponent,
    MainComponent,
    WelcomeComponent,
    LogoutComponent,
    NotFoundComponent
  ],
  imports: [
    BrowserModule.withServerTransition({appId: 'crypter'}),
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    AutofocusModule,
    AuthModule,
    AppRoutingModule,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
