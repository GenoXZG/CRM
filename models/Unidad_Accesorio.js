const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Unidad_Accesorio = sequelize.define('Unidad_Accesorio', {
    ID_unidad: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
            model: 'Unidades',
            key: 'ID_unidad'
        }
    },
    ID_accesorio: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {          
            model: 'Accesorios_catalogo', 
            key: 'ID_accesorio_modelo'
        }
    }
}, {
    tableName: 'Unidad_Accesorio',
    timestamps: false
});

module.exports = Unidad_Accesorio;
