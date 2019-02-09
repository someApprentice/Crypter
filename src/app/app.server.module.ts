import { NgModule, Injectable, Inject } from '@angular/core';
import { ServerModule } from '@angular/platform-server';
import { ModuleMapLoaderModule } from '@nguniversal/module-map-ngfactory-loader';

import { AppModule } from './app.module';
import { AppComponent } from './app.component';

import { Request } from 'express';
import { REQUEST } from '@nguniversal/express-engine/tokens';


@NgModule({
  imports: [
    AppModule,
    ServerModule,
    ModuleMapLoaderModule
  ],
  bootstrap: [AppComponent],
})
export class AppServerModule {}