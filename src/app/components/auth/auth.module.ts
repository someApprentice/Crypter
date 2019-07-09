import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AutofocusModule } from '../../modules/autofocus/autofocus.module';

import { AuthRoutingModule } from './auth-routing.module';

import { WelcomeComponent } from './welcome/welcome.component';
import { LoginComponent } from './login/login.component';
import { RegistrationComponent } from './registration/registration.component';
import { LogoutComponent } from './logout/logout.component';


@NgModule({
  declarations: [
    WelcomeComponent,
    LoginComponent,
    RegistrationComponent,
    LogoutComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    AutofocusModule,
    AuthRoutingModule
  ],
  exports: [
    WelcomeComponent,
    LogoutComponent
  ]
})
export class AuthModule { }