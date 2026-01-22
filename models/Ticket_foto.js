// models/TicketFoto.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db'); 

const TicketFoto = sequelize.define('TicketFoto', {
    ID_foto: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    Ruta_archivo: {
        type: DataTypes.STRING,
        allowNull: false
    },
    Nombre_original: {
        type: DataTypes.STRING
    }
}, {
    tableName: 'Ticket_fotos',
    timestamps: true
});

module.exports = TicketFoto;