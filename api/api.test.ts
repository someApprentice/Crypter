import request from "supertest";

import cookieParser from 'cookie-parser';

import * as token from 'jsonwebtoken';

import bcrypt from 'bcrypt';

import { User } from './models/User';
import { User as U } from '../src/app/models/User';

import server from "../server";

describe("API", () => {
  const JWT_SECRET = process.env.JWT_SECRET;

  const cookieParser = function(cookies: []) {
    let c = [];

    cookies.map((v: string) => v.split('; ')).map(a => a.map(v => v.split('='))).map(a => {
      c.push({ });
      
      a.map(v => {
        c[c.length - 1][v[0]] = v[1]; 
      })
    });

    return c;
  };
  
  it('should registrate User', async (done) => {
    let email = 'tester@crypter.com'
    let name = 'Tester';
    let password = 'secret';

    let hash = await bcrypt.hash(password, 13);

    let response = await request(server)
      .post('/api/registrate')
      .send({ email, name, password })
      .expect(200)
    ;

    let user = await User.findOne({ where: { email } });

    let uuid = user.dataValues.uuid;

    let cookies = cookieParser(response.header['set-cookie']);

    token.sign(user.dataValues, JWT_SECRET, (err, jwt) => {
      if (err) throw err;

      expect(response).not.toBeNull();

      expect(cookies.find(c => c.hasOwnProperty('uuid')['uuid'])).toBe(uuid);
      expect(cookies.find(c => c.hasOwnProperty('email')['email'])).toBe(email);
      expect(cookies.find(c => c.hasOwnProperty('name')['name'])).toBe(name);
      expect(cookies.find(c => c.hasOwnProperty('jwt')['jwt'])).toBe(jwt);

      expect(response.body).toBe({uuid, email, name, jwt});
    });

    User.truncate();

    done();
  });

  it('should login User or retrive 404 status', async (done) => {
    let email = 'tester@crypter.com'
    let password = 'secret';

    await request(server)
      .post('/api/login')
      .send({ email, password })
      .expect(404)
    ;


    let name = 'Tester';

    let hash = await bcrypt.hash(password, 13);

    let user = new User({ email, name, hash });

    await user.save();

    let response = await request(server)
      .post('/api/login')
      .send({ email, password })
      .expect(200)
      .expect('Content-Type', /json/)
    ;

    let uuid = user.dataValues.uuid;

    let cookies = cookieParser(response.header['set-cookie']);

    token.sign(user.dataValues, JWT_SECRET, (err, jwt) => {
      if (err) throw err;

      expect(response).not.toBeNull();

      expect(cookies.find(c => c.hasOwnProperty('uuid')['uuid'])).toBe(uuid);
      expect(cookies.find(c => c.hasOwnProperty('email')['email'])).toBe(email);
      expect(cookies.find(c => c.hasOwnProperty('name')['name'])).toBe(name);
      expect(cookies.find(c => c.hasOwnProperty('jwt')['jwt'])).toBe(jwt);

      expect(response.body).toBe({uuid, email, name, jwt});
    });

    User.truncate();

    done();
  });

  it('should logout user', async (done) => {
    let email = 'tester@crypter.com'
    let name = 'Tester';
    let password = 'secret';

    let hash = await bcrypt.hash(password, 13);

    let user = new User({ email, name, hash });

    await user.save();

    let uuid = user.dataValues.uuid;

    token.sign(user.dataValues, JWT_SECRET, async (err, jwt) => {
      if (err) throw err;

      let response = await request(server)
        .post('/api/logout')
        .set('Authorization', `Bearer ${jwt}`)
        .set('Cookie', [`uuid=${uuid}; email=${email}; name=${name}; jwt=${jwt}`])
        .expect(200)
      ;

      expect(response).not.toBeNull();

      let cookies = cookieParser(response.header['set-cookie']);

      expect(cookies.find(c => c.hasOwnProperty('uuid')['uuid'])).toBeUndefined();
      expect(cookies.find(c => c.hasOwnProperty('email')['email'])).toBeUndefined();
      expect(cookies.find(c => c.hasOwnProperty('name')['name'])).toBeUndefined();
      expect(cookies.find(c => c.hasOwnProperty('jwt')['jwt'])).toBeUndefined();
    });

    User.truncate();

    done();
  });

  it('should retrive email existence', async(done) => {
    let email = 'tester@crypter.com'

    await request(server)
      .get(`/api/email/${email}`)
      .expect(404)
    ;

    let name = 'Tester';
    let password = 'secret';

    let hash = await bcrypt.hash(password, 13);

    let user = new User({ email, name, hash });

    await user.save();

    await request(server)
      .get(`/api/email/${email}`)
      .expect(200)
    ;

    User.truncate();

    done();
  });

  afterAll(async () => {
    //Jest has detected the following 1 open handle potentially keeping Jest from exiting:
    // > 60 | server.listen(PORT, () => {
    //      |        ^
    //   61 |   console.log(`Node server listening on http://localhost:${PORT}`);
    //   62 | });
    // at Function.listen (node_modules/express/lib/application.js:618:24)
    // at Object.<anonymous> (server.ts:60:8)
  })
});