import 'jest-extended';

import authorizer from './Authorizer';

import { User } from '../models/User';
import { User as U } from '../../src/app/models/User';

import { UniqueConstraintError, ValidationError }  from 'sequelize';

describe("Authorizer", () => {
  beforeEach(() => {
    User.truncate();
  });

  it("should registrate an User", async (done) => {
    let email = 'tester@crypter.com'
    let name = 'Tester';
    let password = 'secret';

    let u;

    u = await authorizer.registrate(email, name, password);

    expect(u).toHaveProperty('uuid');
    expect(u).toHaveProperty('email', email);
    expect(u).toHaveProperty('name', name);
    expect(u).toHaveProperty('jwt');

    u = await authorizer.login(email, password);

    expect(u).not.toBeUndefined();

    User.truncate();

    done();
  });

  it("should not registrate twice", async (done) => {
    let email = 'tester@crypter.com'
    let name = 'Tester';
    let password = 'secret';

    let u;

    u = await authorizer.registrate(email, name, password);

    authorizer.registrate(email, name, password).then(d => {}, err => { 
      expect(err).toEqual(expect.any(UniqueConstraintError));

      User.truncate();

      done();
    });

    // ???
    // Received function did not throw
    // expect(async () => { await authorizer.registrate(email, name, password) }).toThrowError(UniqueConstraintError);

    // User.truncate();

    // done();
  });

  it("should validate registration error", async (done) => {
    let invalidEmail = 'tester.com'
    let name = 'Tester';
    let password = 'secret';

    authorizer.registrate(invalidEmail, name, password).then(d => {}, err => {
      expect(err).toEqual(expect.any(ValidationError));

      User.truncate();

      done();
    });

    // ???
    // Received function did not throw
    // expect(async () => { await authorizer.registrate(email, name, password) }).toThrowError(UniqueConstraintError);

    // User.truncate();

    // done();
  });

  it("should login an User", async (done) => {
    let email = 'tester@crypter.com'
    let name = 'Tester';
    let password = 'secret';

    await authorizer.registrate(email, name, password);

    let u = await authorizer.login(email, password);

    expect(u).not.toBe(undefined);

    expect(u).toHaveProperty('uuid');
    expect(u).toHaveProperty('email', email);
    expect(u).toHaveProperty('name', name);
    expect(u).toHaveProperty('jwt');

    User.truncate();

    done();
  });

  it("should validate login error", async (done) => {
    let invalidEmail = 'tester.com'
    let password = 'secret';

    authorizer.login(invalidEmail, password).then(d => {}, err => {
      expect(err).toEqual(expect.any(ValidationError));

      User.truncate();

      done();
    });

    // ???
    // Received function did not throw
    // expect(async () => { await authorizer.registrate(email, name, password) }).toThrowError(UniqueConstraintError);

    // User.truncate();

    // done();
  });

  afterAll(async () => {
     User.truncate();
  });
});
