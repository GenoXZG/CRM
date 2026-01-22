const {DataTypes} = require('sequelize');
const sequelize = require("../config/db");
const Unidades = sequelize.define('Unidades', {
    ID_unidad: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    ID_Unidad_modelo: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    ID_equipo: {
      type: DataTypes.INTEGER,
      unique: true
    },
    ID_ticket: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    Placa_unidad: {
      type: DataTypes.STRING
    },
    Vin_unidad: {
      type: DataTypes.STRING
    }
  }, {
    tableName: 'Unidades',
    timestamps: false
  });

module.exports = Unidades;