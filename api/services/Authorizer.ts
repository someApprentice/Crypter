import sequelize from './Database';

import dotenv from 'dotenv';

dotenv.config();

import bcrypt from 'bcrypt';

import * as token from 'jsonwebtoken';

import { User } from '../models/User';
import { User as U } from '../../src/app/models/User';

import { difference } from 'lodash';

const JWT_SECRET = process.env.JWT_SECRET;


// ???
// ERROR: Cannot read property 'createdAt' of undefined
// at User._initValues (C:\Users\ILJYa\Documents\Crypter\node_modules\sequelize\lib\model.js:3123:49)
// at new Model (C:\Users\ILJYa\Documents\Crypter\node_modules\sequelize\lib\model.js:3097:10)
// at new Model (C:\Users\ILJYa\Documents\Crypter\node_modules\sequelize-typescript\lib\models\v4\Model.js:8:9)
// at new User (C:\Users\ILJYa\Documents\Crypter\api\models\User.ts:5:1)
// at Object.<anonymous> (C:\Users\ILJYa\Documents\Crypter\api\api.ts:46:14)
const db = sequelize;

class Authorizer {
  async registrate(email: string, name: string, password: string): Promise<U> {
    let uuid;

    let hash = await bcrypt.hash(password, 13);

    let user = new User({ email, name, hash });

    await user.validate();

    await user.save();

    uuid = user.dataValues.uuid;
    hash = user.dataValues.hash;

    let jwt = token.sign({ uuid, hash }, JWT_SECRET);

    let u = <U> {
      uuid,
      email,
      name,
      jwt
    }

    return u;
  }

  async login(email: string, password: string): Promise<U|undefined> {
    let user = new User({ email });

    // Argument of type '{ fields: string[]; }' is not assignable to parameter of type '{ skip?: string[]; }'.
    // Object literal may only specify known properties, and 'fields' does not exist in type '{ skip?: string[]; }'.
    // https://github.com/sequelize/sequelize/blob/master/lib/instance-validator.js#L24
    //await user.validate({ fields: ['email'] });
    await user.validate({ skip: difference(Object.keys(User.rawAttributes), ['email']) });

    user = await User.findOne({ where: { email } });

    if (!user || !await bcrypt.compare(password, user.dataValues.hash)) {
      return undefined;
    }

    let uuid = user.dataValues.uuid;
    let name = user.dataValues.name;
    let hash = user.dataValues.hash;

    let jwt = token.sign({ uuid, hash }, JWT_SECRET);

    let u = <U> {
      uuid,
      email,
      name,
      jwt
    }

    return u;
  }
}

const authorizer = new Authorizer();

export default authorizer; 