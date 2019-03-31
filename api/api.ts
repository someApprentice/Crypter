import express from 'express';

import sequelize from './services/Database';

import { difference } from 'lodash';

import * as token from 'jsonwebtoken';
//import * as authenticate from 'express-jwt';
import jwt from 'express-jwt';


import bcrypt from 'bcrypt';

import { User } from './models/User';
import { User as U } from '../src/app/models/User';


const JWT_SECRET = process.env.JWT_SECRET;

// ???
// ERROR: Cannot read property 'createdAt' of undefined
// at User._initValues (C:\Users\ILJYa\Documents\Crypter\node_modules\sequelize\lib\model.js:3123:49)
// at new Model (C:\Users\ILJYa\Documents\Crypter\node_modules\sequelize\lib\model.js:3097:10)
// at new Model (C:\Users\ILJYa\Documents\Crypter\node_modules\sequelize-typescript\lib\models\v4\Model.js:8:9)
// at new User (C:\Users\ILJYa\Documents\Crypter\api\models\User.ts:5:1)
// at Object.<anonymous> (C:\Users\ILJYa\Documents\Crypter\api\api.ts:46:14)
const db = sequelize;

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

  let hash = await bcrypt.hash(password, 13);

  let user = new User({ email, name, hash });

  await user.validate();

  let u = await user.save();

  let uuid = u.dataValues.uuid;

  token.sign(u.dataValues, JWT_SECRET, (err, jwt) => {
    if (err) throw err;

    res.cookie('uuid', uuid, { httpOnly: true, secure: true,  expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) });
    res.cookie('email', email, { httpOnly: true, secure: true,  expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) });
    res.cookie('name', name, { httpOnly: true, secure: true,  expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) });
    res.cookie('jwt', jwt, { httpOnly: true, secure: true,  expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) });

    return res.status(200).type('json').json(<U> { uuid, email, name, jwt });
  });
}));

router.post('/login', asyncAdapter(async (req, res, next) => {
  let email = req.body.email.toLowerCase();
  let password  = req.body.password;

  let user = new User({ email });

  // Argument of type '{ fields: string[]; }' is not assignable to parameter of type '{ skip?: string[]; }'.
  // Object literal may only specify known properties, and 'fields' does not exist in type '{ skip?: string[]; }'.
  // https://github.com/sequelize/sequelize/blob/master/lib/instance-validator.js#L24
  //await user.validate({ fields: ['email'] });
  await user.validate({ skip: difference(Object.keys(User.rawAttributes), ['email']) });

  let u = await User.findOne({ where: { email } });

  if (!u || !await bcrypt.compare(password, u.dataValues.hash)) {
    return res.sendStatus(404);
  }

  let uuid = u.dataValues.uuid;
  let name = u.dataValues.name;

  token.sign(u.dataValues, JWT_SECRET, (err, jwt) => {
    if (err) throw err;

    res.cookie('uuid', uuid, { httpOnly: true, secure: true,  expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) });
    res.cookie('email', email, { httpOnly: true, secure: true,  expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) });
    res.cookie('name', name, { httpOnly: true, secure: true,  expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) });
    res.cookie('jwt', jwt, { httpOnly: true, secure: true,  expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) });

    return res.status(200).type('json').json(<U> { uuid, email, name, jwt });
  });
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