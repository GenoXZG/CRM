const {DataTypes} = require('sequelize');
const sequelize = require("../config/db");

const Unidad_stock = sequelize.define('Unidad_stock',{
    ID_Unidad_modelo :
    {
        type : DataTypes.INTEGER,
        primaryKey : true,
        autoIncrement: true,
        allowNull: false
    },
    Marca_unidad: {
        type : DataTypes.STRING,
        allowNull: false
    },
    Modelo_Unidad:{
        type : DataTypes.STRING,
        allowNull :  false
    }
},
{
    tableName : 'Unidades_catalogo',
    timestamps : false
});

module.exports = Unidad_stock;