// These are important and needed before anything else
import 'zone.js/dist/zone-node';
import 'reflect-metadata';

import { renderModuleFactory } from '@angular/platform-server';
import { enableProdMode } from '@angular/core';
import { ngExpressEngine } from '@nguniversal/express-engine';
import { provideModuleMap } from '@nguniversal/module-map-ngfactory-loader';

// import * as express from 'express';
import express from 'express';
import dotenv from 'dotenv';
import { join } from 'path';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';

dotenv.config();

import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUiExpress from 'swagger-ui-express';
import swaggerJSDocOptions from './openapi';

import { router as api } from './api/api';
import { errorHandler } from './api/errorHandler'

// Faster server renders w/ Prod mode (dev mode never needed)
enableProdMode();

const server = express();

const PORT = process.env.PORT || 4000;
const DIST_FOLDER = join(process.cwd(), 'dist');

// * NOTE :: leave this as require() since this file is built Dynamically from webpack
const { AppServerModuleNgFactory, LAZY_MODULE_MAP } = require('./dist/server/main.js');

server.engine('html', ngExpressEngine({
  bootstrap: AppServerModuleNgFactory,
  providers: [
    provideModuleMap(LAZY_MODULE_MAP)
  ]
}));

server.set('view engine', 'html');
server.set('views', join(DIST_FOLDER, 'browser'));

server.use(bodyParser.urlencoded({
  extended: true
}));

server.use(bodyParser.json());

server.use(cookieParser());

server.get('*.*', express.static(join(DIST_FOLDER, 'browser')));

server.use('/api', api);

server.use('/documentation', swaggerUiExpress.serve, swaggerUiExpress.setup(swaggerJSDoc(swaggerJSDocOptions)));

server.get('*', (req, res) => {
  res.render(join(DIST_FOLDER, 'browser', 'index.html'), { req });
});

server.use(errorHandler);

server.listen(PORT, () => {
  console.log(`Node server listening on http://localhost:${PORT}`);
});