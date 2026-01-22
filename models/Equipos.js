
const {DataTypes} = require('sequelize');
const sequelize = require("../config/db");

  const Equipo = sequelize.define('Equipos', {
    ID_equipo: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    ID_equipo_modelo: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    IMEI: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    ID_modem: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    Estatus_equipo: {
      type: DataTypes.ENUM('En espera', 'Asignado', 'Instalado'),
      defaultValue: 'En espera'
    }
  }, {
    tableName: 'Equipos',
    timestamps: false
  });


  
module.exports = Equipo;

