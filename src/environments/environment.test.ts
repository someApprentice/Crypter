export const environment = {
  production: false,
  test: true,
  socket_url: 'http://localhost',
  socket_path: '/ws'
};

// ignore zone.js errors 
// https://stackoverflow.com/questions/49873128/how-to-stop-errors-generated-by-zone-js-in-browser-console
// ???
import 'zone.js/dist/zone-error';
