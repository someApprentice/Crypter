import { NgModule, Injectable, Inject } from '@angular/core';
import { ServerModule, ServerTransferStateModule } from '@angular/platform-server';
import { ModuleMapLoaderModule } from '@nguniversal/module-map-ngfactory-loader';

import { AppModule } from './app.module';
import { AppComponent } from './app.component';

import { Request } from 'express';
import { REQUEST } from '@nguniversal/express-engine/tokens';

import {HTTP_INTERCEPTORS} from '@angular/common/http';
import {UniversalInterceptor} from './universal-interceptor';

@NgModule({
  imports: [
    AppModule,
    ServerModule,
    ServerTransferStateModule,
    ModuleMapLoaderModule
  ],
  providers: [{
    provide: HTTP_INTERCEPTORS,
    useClass: UniversalInterceptor,
    multi: true
  }],
  bootstrap: [AppComponent],
})
export class AppServerModule {}