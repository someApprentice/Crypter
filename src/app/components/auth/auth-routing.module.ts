import { NgModule }             from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

import { WelcomeComponent } from './welcome/welcome.component';
import { LoginComponent } from './login/login.component';
import { RegistrationComponent } from './registration/registration.component';

const authRoutes: Routes = [
  { path: 'login', component: LoginComponent, data: { title: 'Login' }, canActivate: [AuthGuard] },
  { path: 'registration', component: RegistrationComponent, data: { title: 'Registration' }, canActivate: [AuthGuard] }
];

@NgModule({
  imports: [
    RouterModule.forChild(authRoutes)
  ],
  exports: [
    RouterModule
  ]
})
export class AuthRoutingModule {}
