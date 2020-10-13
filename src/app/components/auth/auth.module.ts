import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { LayoutModule } from '@angular/cdk/layout';
import { AutofocusModule } from '../../modules/autofocus/autofocus.module';
import { RecaptchaModule } from '../../modules/recaptcha/recaptcha.module';

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
    LayoutModule,
    AutofocusModule,
    RecaptchaModule,
    AuthRoutingModule,
  ],
  exports: [
    WelcomeComponent,
    LogoutComponent
  ]
})
export class AuthModule { }
