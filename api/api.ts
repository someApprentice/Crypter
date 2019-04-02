import express from 'express';

import sequelize from './services/Database';

import authorizer from './services/Authorizer';

//import * as authenticate from 'express-jwt';
import jwt from 'express-jwt';

import { User } from './models/User';

import { difference } from 'lodash';


const JWT_SECRET = process.env.JWT_SECRET;



const router = express.Router();

// Does Bearer token provide XSRF protection?


/*
  This function is needs for adapting an async route's handlers which is not supported by express yet. 

  // This won't work without adapter
  express.get('/route', async (...) => {
    await promise = ...
  });

  https://stackoverflow.com/a/51391081
*/
const asyncAdapter = fn => (req, res, next) => {
  return Promise
    .resolve(fn(req, res, next))
    .catch(next);
};

router.post('/registrate', asyncAdapter(async (req, res, next) => {
  let email = req.body.email.toLowerCase();
  let name = req.body.name;
  let password = req.body.password;

  let u = await authorizer.registrate(email, name, password);

  res.cookie('uuid', u.uuid, { httpOnly: true, secure: true,  expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) });
  res.cookie('email', u.email, { httpOnly: true, secure: true,  expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) });
  res.cookie('name', u.name, { httpOnly: true, secure: true,  expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) });
  res.cookie('jwt', u.jwt, { httpOnly: true, secure: true,  expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) });

  return res.status(200).type('json').json(u);
}));

router.post('/login', asyncAdapter(async (req, res, next) => {
  let email = req.body.email.toLowerCase();
  let password  = req.body.password;

  let u = await authorizer.login(email, password);

  if (!u) {
    return res.sendStatus(404);
  }

  res.cookie('uuid', u.uuid, { httpOnly: true, secure: true,  expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) });
  res.cookie('email', u.email, { httpOnly: true, secure: true,  expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) });
  res.cookie('name', u.name, { httpOnly: true, secure: true,  expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) });
  res.cookie('jwt', u.jwt, { httpOnly: true, secure: true,  expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) });

  return res.status(200).type('json').json(u);
}));

// router.post('/logout', authenticate({ secret: JWT_SECRET, requestProperty: 'jwt' }), (req, res) => {
router.post('/logout', jwt({ secret: JWT_SECRET, requestProperty: 'jwt' }), (req, res) => {
  res.clearCookie('uuid');
  res.clearCookie('email');
  res.clearCookie('name');
  res.clearCookie('jwt');

  return res.sendStatus(200);
});

router.get('/email/:email', asyncAdapter(async (req, res, next) => {
  let email = req.params.email.toLowerCase();

  let user = new User({email});

  // Argument of type '{ fields: string[]; }' is not assignable to parameter of type '{ skip?: string[]; }'.
  // Object literal may only specify known properties, and 'fields' does not exist in type '{ skip?: string[]; }'.
  // https://github.com/sequelize/sequelize/blob/master/lib/instance-validator.js#L24
  //await user.validate({ fields: ['email'] });
  await user.validate({ skip: difference(Object.keys(User.rawAttributes), ['email']) });

  let u = await User.findOne({ where: { email } });

  let exist = Boolean(u);

  return res.status(200).type('json').json({ email, exist });
}));

export { router };