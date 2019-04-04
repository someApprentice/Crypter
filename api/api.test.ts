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
import { Response } from "supertest";

import { User } from './models/User';
import { User as U } from '../src/app/models/User';

describe("API", () => {
  let app;
  let server;

  const PORT = process.env.PORT || 4000;


  function parseCookiesFromResponse(res: Response) {
    let cookies = res.header['set-cookie'];

    let c = [];

    cookies.map((cookie:string) => cookie.split('; ')).map(attribute => attribute.map(a => a.split('='))).map(split => {
      c.push({ });
      
      split.map((s:any) => {
        c[c.length - 1][s[0]] = (typeof s[1] === 'undefined') ? true : decodeURIComponent(s[1]);
      });
    });

    return c;
  };


  beforeAll(() => {
    app = express();

    app.use(bodyParser.urlencoded({
      extended: true
    }));

    app.use(bodyParser.json());

    app.use(cookieParser());
    app.use('/api', api);
    app.use(errorHandler);

    server = app.listen(PORT, () => {
      console.log(`Node test server listening on http://localhost:${PORT}`);
    });
  });

  beforeEach(() => {
    User.truncate();
  });
  
  it('should registrate User', async (done) => {
    let email = 'tester@crypter.com'
    let name = 'Tester';
    let password = 'secret';

    let response;

    response = await request(server)
      .post('/api/registrate')
      .send({ email, name, password })
      .expect('Content-Type', /json/)
      .expect(200)
      .expect(res => {
        expect(res.body).toHaveProperty('uuid');
        expect(res.body).toHaveProperty('email', email);
        expect(res.body).toHaveProperty('name', name);
        expect(res.body).toHaveProperty('jwt');
      })
    ;

    let cookies = parseCookiesFromResponse(response);

    expect(cookies.find(c => c.hasOwnProperty('uuid'))).toHaveProperty('uuid');
    expect(cookies.find(c => c.hasOwnProperty('email'))).toHaveProperty('email', email);
    expect(cookies.find(c => c.hasOwnProperty('name'))).toHaveProperty('name', name);
    expect(cookies.find(c => c.hasOwnProperty('jwt'))).toHaveProperty('jwt');

    response = await request(server)
      .post('/api/login')
      .send({ email, password })
      .expect('Content-Type', /json/)
      .expect(200)
    ;

    done();
  });

  it("should not registrate twice", async (done) => {
    let email = 'tester@crypter.com'
    let name = 'Tester';
    let password = 'secret';

    let response;

    response = await request(server)
      .post('/api/registrate')
      .send({ email, name, password })
      .expect(200)
    ;

    response = await request(server)
      .post('/api/registrate')
      .send({ email, name, password })
      .expect(400)
    ;

    done();
  });

  it("should not allow to registrate without required fields", async (done) => {
    let email = ''
    let name = '';
    let password = '';

    let response = await request(server)
      .post('/api/registrate')
      .send({ email, name, password })
      .expect(400)
    ;

    done();
  });

  it('should login User or retrive 404 status', async (done) => {
    let email = 'tester@crypter.com'
    let name = 'Tester';
    let password = 'secret';

    let response;

    await request(server)
      .post('/api/login')
      .send({ email, password })
      .expect(404)
    ;

    await request(server)
      .post('/api/registrate')
      .send({ email, name, password })
    ;

    response = await request(server)
      .post('/api/login')
      .send({ email, password })
      .expect('Content-Type', /json/)
      .expect(200)
      .expect(res => {
        expect(res.body).toHaveProperty('uuid');
        expect(res.body).toHaveProperty('email', email);
        expect(res.body).toHaveProperty('name', name);
        expect(res.body).toHaveProperty('jwt');
      })
    ;

    let jwt = response.body.jwt;

    let cookies = parseCookiesFromResponse(response);

    expect(cookies.find(c => c.hasOwnProperty('uuid'))).toHaveProperty('uuid');
    expect(cookies.find(c => c.hasOwnProperty('email'))).toHaveProperty('email', email);
    expect(cookies.find(c => c.hasOwnProperty('name'))).toHaveProperty('name', name);
    expect(cookies.find(c => c.hasOwnProperty('jwt'))).toHaveProperty('jwt');

    await request(server)
      .post('/api/logout')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200)
    ;

    done();
  });

  it("should not allow to login without required fields", async (done) => {
    let email = '';
    let password = '';

    let response = await request(server)
      .post('/api/login')
      .send({ email, password })
      .expect(400)
    ;

    done();
  });


  it('should logout user', async (done) => {
    let email = 'tester@crypter.com'
    let name = 'Tester';
    let password = 'secret';

    let response;

    response = await request(server)
      .post('/api/registrate')
      .send({ email, name, password })
    ;

    let uuid = response.body.uuid;
    let jwt = response.body.jwt;

    response = await request(server)
      .post('/api/logout')
      .set('Authorization', `Bearer ${jwt}`)
      .set('Cookie', [`uuid=${uuid}; email=${email}; name=${name}; jwt=${jwt}`])
      .expect(200)
    ;

    let cookies = parseCookiesFromResponse(response);

    expect(cookies.find(c => c.hasOwnProperty('uuid'))['uuid']).toBeEmpty();
    expect(cookies.find(c => c.hasOwnProperty('email'))['email']).toBeEmpty();
    expect(cookies.find(c => c.hasOwnProperty('name'))['name']).toBeEmpty();
    expect(cookies.find(c => c.hasOwnProperty('jwt'))['jwt']).toBeEmpty();

    done();
  });

  it('should retrive email existence', async(done) => {
    let email = 'tester@crypter.com'
    let name = 'Tester';
    let password = 'secret';

    await request(server)
      .get(`/api/email/${email}`)
      .expect(404)
    ;


    await request(server)
      .post('/api/registrate')
      .send({ email, name, password })
    ;

    await request(server)
      .get(`/api/email/${email}`)
      .expect(200)
    ;

    done();
  });

  afterAll((done) => {
    server.close(done);
  });
});