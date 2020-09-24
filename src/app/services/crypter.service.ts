import { environment } from '../../environments/environment';

import { Injectable, OnDestroy } from '@angular/core';

import { Observable, from, concat, zip } from 'rxjs';
import { map, reduce, switchMap, delayWhen } from 'rxjs/operators';

import { initWorker, config, key, message, generateKey, encrypt, decrypt, destroyWorker } from 'openpgp';

@Injectable({
  providedIn: 'root'
})
export class CrypterService implements OnDestroy {
  constructor() {
    config.show_version = false;
    config.show_comment = false;

    initWorker({ path: 'openpgp.worker.min.js' });
  }
  
  generateKey(name: string, email: string, passphrase: string): Observable<{
    key: key.Key,
    privateKeyArmored: string,
    publicKeyArmored: string,
    revocationCertificate: string
  }> {
    let options = {
      userIds: [{ name, email }],
      rsaBits: environment.rsa_bits,
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

  changePassphrase(passphrase: string, decryptedPrivateKey: string): Observable<string> {
    return from(key.readArmored(decryptedPrivateKey)).pipe(
      map(k => k.keys[0]),
      delayWhen(privateKeyObj => from(privateKeyObj.encrypt(passphrase))),
      map(k => k.armor())
    );
  }

  encrypt(text: string, publicKeys: string[]): Observable<string> {
    let publicKeys$ = publicKeys.map(k => from(key.readArmored(k)));

    return concat(...publicKeys$).pipe(
      reduce((acc, cur) => [ ...acc, cur ], []),
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

  decrypt(encrypted: string, privateKey: string): Observable<string> {
    let message$ = from(message.readArmored(encrypted));

    let privateKeyObj$ = from(key.readArmored(privateKey)).pipe(map(k => k.keys[0]));

    return zip(message$, privateKeyObj$).pipe(
      map(([ message, privateKeys ]) => ({ message, privateKeys })),
      switchMap(options => from(decrypt(options))),
      map(decrypted => decrypted.data as string)
    );
  }

  ngOnDestroy() {
    destroyWorker();
  }
}
