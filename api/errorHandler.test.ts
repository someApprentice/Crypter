import 'jest-extended';

import express from 'express';
import dotenv from 'dotenv';
import { join } from 'path';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';

dotenv.config();

import { router as api } from './api';
import { errorHandler } from './errorHandler'

import request from "supertest";

import * as token from 'jsonwebtoken';

import { User } from './models/User';

describe("errorHandler", () => {
  let app;
  let server;

  const PORT = process.env.PORT || 4000;

  const JWT_SECRET = process.env.JWT_SECRET;

  beforeAll(() => {
    app = express();

    app.use(bodyParser.urlencoded({
      extended: true
    }));

    app.use(bodyParser.json());

    app.use(cookieParser());
    app.use('/api', api);
    app.use(errorHandler);

    app.get('/error', (req, res) => {
      throw new Error("Catch me");
    });

    server = app.listen(PORT, () => {
      console.log(`Node test server listening on http://localhost:${PORT}`);
    });
  });

  beforeEach(() => {
    User.truncate();
  });

  it("should handle ValidationError or SyntaxError", async (done) => {
    let email;
    let name;
    let password;

    let response;

    email = 'tester.com'
    name = 'Tester';
    password = 'p';

    await request(server)
      .post('/api/registrate')
      .send({ email, name, password })
      .expect(400);
    ;


    email = ''
    name = '';
    password = '';

    await request(server)
      .post('/api/registrate')
      .send({ email, name, password })
      .expect(400);
    ;

    done();
  });

  it("should handle UnauthorizedError or TokenExpiredError", async (done) => {
    let uuid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    let hash = '$2b$13$K5t5mk14r0TJNVZaXf7Tde/rX.lyYcfreKYNaZjGLPzPhVfVW8dum';

    let jwt;

    jwt = token.sign({ uuid, hash }, 'wrong secret');

    await request(server)
      .post('/api/logout')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(401)
    ;

    
    // outdated token
    jwt = token.sign({ uuid, hash, iat: Math.floor((new Date()).setDate((new Date()).getDate() - 1) / 1000), exp: Math.floor((new Date()).setDate((new Date()).getDate()) / 1000) }, JWT_SECRET);

    await request(server)
      .post('/api/logout')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(401)
    ;

    done()
  });

  it("should handle any error", async (done) => {
    await request(server)
      .get('/error')
      .expect(500);
    ;

    done();
  });

  afterAll((done) => {
    server.close(done);
  });
});