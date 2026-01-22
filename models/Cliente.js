const {DataTypes} = require('sequelize');
const sequelize = require("../config/db");



const Cliente = sequelize.define('Cliente', {
  ID_cliente: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  Nombre_empresa: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  Encargado: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  Numero: {
    type: DataTypes.STRING(10),
    allowNull: false
  }
}, {
  tableName: 'Cliente',
  timestamps: false
}
);





module.exports = Cliente;


