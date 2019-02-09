import { Injector, Injectable, Inject  } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';

import { REQUEST } from '@nguniversal/express-engine/tokens';

import { StorageWrapper } from  './models/StorageWrapper';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  storage: { [k: string]: any } = { };

  constructor(private injector: Injector) {
    let platformId = injector.get(PLATFORM_ID);

    if (isPlatformBrowser(platformId)) {
      this.storage = localStorage;
    }

    if (isPlatformServer(platformId)) {
      let req = injector.get(REQUEST);

      this.storage = new StorageWrapper(req.cookies);
    }
  }
}