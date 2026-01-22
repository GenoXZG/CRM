

const { Sequelize } = require('sequelize');

// Conexión a la base de datos
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: 'localhost',
  dialect: 'mysql',
  logging: false, 
});

module.exports = sequelize;