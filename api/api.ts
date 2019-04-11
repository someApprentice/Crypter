import express from 'express';

import sequelize from './services/Database';

import authorizer from './services/Authorizer';

import jwt from 'express-jwt';

import { User } from './models/User';

import { difference } from 'lodash';


const JWT_SECRET = process.env.JWT_SECRET;


const router = express.Router();


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


/**
 * @swagger
 *
 * components:
 *   schemas:
 *    User:
 *      type: object
 *      properties:
 *        uuid:
 *          type: string
 *          format: uuid
 *        email:
 *          type: string
 *          format: email
 *        name:
 *          type: string
 *        jwt:
 *          type: string
 *          format: jwt
 *
 *   securitySchemas:
 *     BearerToken:
 *       type: http
 *       scheme: bearer
 */


/**
 * @swagger
 *
 * /registrate:
 *  post:
 *    summary: Registrate User
 *    operationId: registrate
 *    parameters:
 *      - name: email
 *        in: query
 *        required: true
 *        description: User email
 *        schema:
 *           type: string
 *           format: email
 *      - name: name
 *        in: query
 *        required: true
 *        description: User name
 *        schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 255
 *      - name: password
 *        in: query
 *        required: true
 *        description: User password
 *        schema:
 *           type: string
 *    requestBody:
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              email:
 *                type: string
 *                format: email
 *              name:
 *                type: string
 *                minLength: 1
 *                maxLength: 255
 *              password:
 *                type: string
 *          required:
 *            - email
 *            - name
 *            - password
 *        application/x-www-form-urlencoded:
 *          schema:
 *            type: object
 *            properties:
 *              email:
 *                type: string
 *                format: email
 *              name:
 *                type: string
 *                minLength: 1
 *                maxLength: 255
 *              password:
 *                type: string
 *          required:
 *            - email
 *            - name
 *            - password
 *    responses:
 *      '200':
 *        description: Response of successful registration
 *        content:
 *          application/json:
 *            schema:
 *              $ref: "#/components/schemas/User"
 *        headers:
 *          Set-Cookie:
 *            schema:
 *              type: string
 *              example: |
 *                uuid=a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11; Path=/; Expires=Fri, 10 Apr 2020 04:27:10 GMT; HttpOnly; Secure
 *                email=openapi%40crypter.com; Path=/; Expires=Fri, 10 Apr 2020 04:27:10 GMT; HttpOnly; Secure
 *                name=OpenAPI; Path=/; Expires=Fri, 10 Apr 2020 04:27:10 GMT; HttpOnly; Secure
 *                jwt=BmsjIrAJvqz9V3HD8GlQwMXKMJ4Qm_NHLOQWiUZO_HY; Path=/; Expires=Fri, 10 Apr 2020 04:27:10 GMT; HttpOnly; Secure
 *      '400':
 *        description: Response of invalid credentials
 *        content:
 *          plain/text:
 *            schema:
 *              type: string
 *      default:
 *        description: unexpected error
 *        content:
 *          plain/text:
 *            schema:
 *              type: string
 */
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


/**
 * @swagger
 *
 * /login:
 *  post:
 *    summary: Login User
 *    operationId: login
 *    parameters:
 *      - name: email
 *        in: query
 *        required: true
 *        description: User email
 *        schema:
 *           type: string
 *           format: email
 *      - name: password
 *        in: query
 *        required: true
 *        description: User password
 *        schema:
 *           type: string
 *    requestBody:
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              email:
 *                type: string
 *                format: email
 *              password:
 *                type: string
 *          required:
 *            - email
 *            - password
 *        application/x-www-form-urlencoded:
 *          schema:
 *            type: object
 *            properties:
 *              email:
 *                type: string
 *                format: email
 *              password:
 *                type: string
 *          required:
 *            - email
 *            - password
 *    responses:
 *      '200':
 *        description: Response of successful login
 *        content:
 *          application/json:
 *            schema:
 *              $ref: "#/components/schemas/User"
 *        headers:
 *          Set-Cookie:
 *            schema:
 *              type: string
 *              example: |
 *                uuid=a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11; Path=/; Expires=Fri, 10 Apr 2020 04:27:10 GMT; HttpOnly; Secure
 *                email=openapi%40crypter.com; Path=/; Expires=Fri, 10 Apr 2020 04:27:10 GMT; HttpOnly; Secure
 *                name=OpenAPI; Path=/; Expires=Fri, 10 Apr 2020 04:27:10 GMT; HttpOnly; Secure
 *                jwt=BmsjIrAJvqz9V3HD8GlQwMXKMJ4Qm_NHLOQWiUZO_HY; Path=/; Expires=Fri, 10 Apr 2020 04:27:10 GMT; HttpOnly; Secure
 *      '400':
 *        description: Response of invalid credentials
 *        content:
 *          plain/text:
 *            schema:
 *              type: string
 *      '404':
 *        description: Response of wrong credentials
 *        content:
 *          plain/text:
 *            schema:
 *              type: string
 *      default:
 *        description: unexpected error
 *        content:
 *          plain/text:
 *            schema:
 *              type: string
 */
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


/**
 * @swagger
 *
 * /logout:
 *  post:
 *    summary: Logout User
 *    operationId: logout
 *    security:
 *      - BearerToken: []
 *    responses:
 *      '200':
 *        description: Response of successful logout
 *        content:
 *          plain/text:
 *            schema:
 *              type: string
 *      '401':
 *        description: Response of UnauthorizedError
 *        content:
 *          plain/text:
 *            schema:
 *              type: string
 *        headers:
 *          WWW-Authenticate:
 *            schema:
 *              type: string
 *              example: Bearer
 *      default:
 *        description: unexpected error
 *        content:
 *          plain/text:
 *            schema:
 *              type: string
 */
router.post('/logout', jwt({ secret: JWT_SECRET, requestProperty: 'jwt' }), (req, res) => {
  res.clearCookie('uuid');
  res.clearCookie('email');
  res.clearCookie('name');
  res.clearCookie('jwt');

  return res.sendStatus(200);
});


/**
 * @swagger
 *
 * /email/{email}:
 *   get:
 *     summary: Info for a email exist
 *     operationId: emailExistence
 *     parameters:
 *       - name: email
 *         in: path
 *         required: true
 *         description: The email to retrieve
 *         schema:
 *           type: string
 *           format: email
 *     responses:
 *       '200':
 *         description: Response of email exist
 *         content:
 *           plain/text:
 *             schema:
 *               type: string
 *       '404':
 *         description: Response of email not exist
 *         content:
 *           plain/text:
 *             schema:
 *               type: string
 *       default:
 *         description: unexpected error
 *         content:
 *           plain/text:
 *             schema:
 *               type: string
 */
router.get('/email/:email', asyncAdapter(async (req, res, next) => {
  let email = req.params.email.toLowerCase();

  let user = new User({email});

  // Argument of type '{ fields: string[]; }' is not assignable to parameter of type '{ skip?: string[]; }'.
  // Object literal may only specify known properties, and 'fields' does not exist in type '{ skip?: string[]; }'.
  // https://github.com/sequelize/sequelize/blob/master/lib/instance-validator.js#L24
  //await user.validate({ fields: ['email'] });
  await user.validate({ skip: difference(Object.keys(User.rawAttributes), ['email']) });

  let u = await User.findOne({ where: { email } });

  if (!u) {
    return res.sendStatus(404);
  }

  return res.sendStatus(200);
}));

export { router };