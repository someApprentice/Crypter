import { Sequelize } from 'sequelize-typescript';

import dotenv from 'dotenv';

dotenv.config();

import { User } from '../models/User';

const sequelize =  new Sequelize({
  dialect: 'postgres',
  database: (process.env.NODE_ENV === 'test') ? process.env.TEST_DB_NAME : process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  logging: false,
  operatorsAliases: false
});

sequelize.addModels([User]); // Is there any way to declare all classes at once for a webpack output file?

export default sequelize;