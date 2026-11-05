import { Sequelize } from 'sequelize';
import { configuration } from '../../config';

const settings = configuration.database;
export const database = new Sequelize(settings.name, settings.user, settings.password, {
  host: settings.host,
  port: settings.port,
  dialect: 'mysql',
  logging: false,
});
