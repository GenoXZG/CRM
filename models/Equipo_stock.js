const {DataTypes} = require('sequelize');
const sequelize = require("../config/db");


const Equipo_stock = sequelize.define('Equipo_stock',{
    ID_equipo_modelo :
    {
        type : DataTypes.INTEGER,
        primaryKey : true,
        autoIncrement: true,
        allowNull: false
    },
    Marca_equipo: {
        type : DataTypes.STRING,
        allowNull: false
    },
    Modelo_equipo:{
        type : DataTypes.STRING,
        allowNull :  false
    }
},
{
    tableName : 'Equipos_catalogo',
    timestamps : false
});

module.exports = Equipo_stock;