import { Injectable, OnDestroy } from '@angular/core';

import { Observable, from, forkJoin } from 'rxjs';
import { map, switchMap, delayWhen } from 'rxjs/operators';

import { initWorker, key, message, generateKey, encrypt, decrypt, destroyWorker } from 'openpgp';

@Injectable({
  providedIn: 'root'
})
export class CrypterService implements OnDestroy {
  constructor() {
    initWorker({ path: 'openpgp.worker.min.js' });
  }
  
  generateKey(name: string, email: string, passphrase: string): Observable<any> {
    let options = {
      userIds: [{ name, email }],
      rsaBits: 4096,
      passphrase
    };

    return from(generateKey(options));
  }

  decryptPrivateKey(privateKey: string, passphrase: string): Observable<string> {
    return from(key.readArmored(privateKey)).pipe(
      map(k => k.keys[0]),
      delayWhen(privateKeyObj => from(privateKeyObj.decrypt(passphrase))),
      map(k => k.armor())
    );
  }

  encrypt(text: string, publicKeys: string[]): Observable<string> {
    let publicKeys$ = publicKeys.map(k => from(key.readArmored(k)));

    return forkJoin(publicKeys$).pipe(
      map(publicKeys => publicKeys.map(k => k.keys[0])),
      switchMap(publicKeys => {
        let options = {
          message: message.fromText(text),
          publicKeys: publicKeys
        };

        return from(encrypt(options));
      }),
      map(ciphertext => ciphertext.data)
    );
  } 

  decrypt(encrypted: string, privateKey: string): Observable<any> {
    let message$ = from(message.readArmored(encrypted));

    let privateKeyObj$ = from(key.readArmored(privateKey)).pipe(map(k => k.keys[0]));

    return forkJoin({ message: message$, privateKeys: privateKeyObj$ }).pipe(
      switchMap(options => from(decrypt(options))),
      map(decrypted => decrypted.data)
    );
  }

  ngOnDestroy() {
    destroyWorker();
  }
}
