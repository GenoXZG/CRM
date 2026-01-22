const {DataTypes} = require('sequelize');
const sequelize = require("../config/db");


const Ticket = sequelize.define('Ticket', {
    ID_ticket: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    ID_tecnico: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    ID_cliente: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    Tipo_servicio: {
      type: DataTypes.ENUM('Instalacion', 'Desinstalacion', 'Revision', 'Rescate'),
      allowNull: true
    },
    Estatus_servicio: {
      type: DataTypes.ENUM('En espera', 'En seguimiento', 'Finalizado'),
      defaultValue: 'En espera',
      allowNull: true
    },
    Numero_unidades: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    Fecha_servicio: {
      type: DataTypes.DATE,
      allowNull: true
    },
    Link_maps: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    Comentarios: {
      type: DataTypes.TEXT,
      allowNull: true
    },
      Estatus_unidades: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
      allowNull: true
    }
  }, {
    tableName: 'Tickets',
    timestamps: false 
});



module.exports = Ticket;