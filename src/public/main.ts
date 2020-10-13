import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from '../app/app.module';
import { environment } from '../environments/environment';

if (environment.production) {
  enableProdMode();
}

// platformBrowserDynamic().bootstrapModule(AppModule)
//   .catch(err => console.error(err));

document.addEventListener('DOMContentLoaded', () => {
  platformBrowserDynamic().bootstrapModule(AppModule)
    .catch(err => console.log(err));
});

// https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
declare global {
  interface Window {
    calculateViewportHeight: () => void;
  }
};
window.calculateViewportHeight = () => {
  // In mobile version, for some reason innerHeight becomes larger than the window height after
  // navigating from page with soft keyboard open
  // let vh = window.innerHeight * 0.01;

  let vh = document.documentElement.clientHeight * 0.01;

  document.documentElement.style.setProperty('--vh', `${vh}px`);

};
window.addEventListener('load', window.calculateViewportHeight);
