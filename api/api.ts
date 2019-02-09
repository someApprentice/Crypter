import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

import { Sequelize } from 'sequelize-typescript';
import { difference } from 'lodash';

import * as token from 'jsonwebtoken';
//import * as authenticate from 'express-jwt';
import jwt from 'express-jwt';


import bcrypt from 'bcrypt';

import { User } from './models/User';
import { User as U } from '../src/app/models/User';


const JWT_SECRET = process.env.JWT_SECRET;


const sequelize =  new Sequelize({
  dialect: 'postgres',
  database: (process.env.NODE_ENV === 'test') ? process.env.TEST_DB_NAME : process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  logging: false,
  operatorsAliases: false
});

sequelize.addModels([User]); // Is there any way to declare all classes at once for a webpack output file?


const router = express.Router();

// Does Bearer token provide XSRF protection?


// https://stackoverflow.com/a/51391081
const asyncHandler = fn => (req, res, next) => {
  return Promise
    .resolve(fn(req, res, next))
    .catch(next);
};

router.post('/registrate', asyncHandler(async (req, res, next) => {
  let email = req.body.email.toLowerCase();
  let name = req.body.name;
  let password = req.body.password;

  let hash = await bcrypt.hash(password, 13);

  let user = new User({ email, name, hash });

  await user.validate();

  let u = await user.save();

  let uuid = u.dataValues.uuid;

  token.sign(u.dataValues, JWT_SECRET, (err, jwt) => {
    if (err) throw new err;

    res.cookie('uuid', uuid, { expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) });
    res.cookie('email', email, { expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) });
    res.cookie('name', name, { expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) });
    res.cookie('jwt', jwt, { expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) });

    return res.status(200).type('json').json(<U> { uuid, email, name, jwt });
  });
}));

router.post('/login', asyncHandler(async (req, res, next) => {
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
    if (err) throw new err;

    res.cookie('uuid', uuid, { expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) });
    res.cookie('email', email, { expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) });
    res.cookie('name', name, { expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) });
    res.cookie('jwt', jwt, { expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) });

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

router.get('/email/:email', asyncHandler(async (req, res, next) => {
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