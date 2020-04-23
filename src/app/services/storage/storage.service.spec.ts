import { TestBed } from '@angular/core/testing';

import { Injector, Injectable, Inject  } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { REQUEST } from '@nguniversal/express-engine/tokens';

import { StorageService } from './storage.service';
import { StorageWrapper } from  './StorageWrapper';

describe('StorageService', () => {
  let service: StorageService;

  it('should be created', () => {
    TestBed.configureTestingModule({});

    service = TestBed.get(StorageService);

    expect(service).toBeTruthy();
  });

  it('should provide localStorage and retrive some value of it', () => {
    TestBed.configureTestingModule({
      providers: [ { provide: PLATFORM_ID, useValue: 'browser' } ]
    });

    let jwt = 'BmsjIrAJvqz9V3HD8GlQwMXKMJ4Qm_NHLOQWiUZO_HY';

    localStorage.setItem('hash', jwt);

    service = TestBed.get(StorageService);

    // is it strict enough to revise instance of LocalStorage?
    expect(service.storage).toEqual(jasmine.any(Storage));

    expect(service.storage.hash).toEqual(jwt);
  });

  it('should provide StorageWrapper and retrive somve value of it', () => {
    let jwt = 'BmsjIrAJvqz9V3HD8GlQwMXKMJ4Qm_NHLOQWiUZO_HY';

    TestBed.configureTestingModule({
      providers: [ 
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: REQUEST, useValue: { cookies: { hash: jwt }  } }
      ]
    });

    service = TestBed.get(StorageService);

    expect(service.storage).toEqual(jasmine.any(StorageWrapper));

    expect(service.storage.hash).toEqual(jwt);
  }) 
});
