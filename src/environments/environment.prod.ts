export const environment = {
  production: true,
  test: false,
  socket_url: 'http://localhost',
  socket_path: '/ws',
  batch_size: 20,
  rsa_bits: 2048,
  recaptcha_url: 'https://www.google.com/recaptcha/api.js?onload=gRecaptchaOnLoad&render=explicit&hl=en',
  recaptcha_sitekey: ''
};

// ignore zone.js errors 
// https://stackoverflow.com/questions/49873128/how-to-stop-errors-generated-by-zone-js-in-browser-console
// ???
import 'zone.js/dist/zone-error';
