const {DataTypes} = require('sequelize');
const sequelize = require("../config/db");


const Accesorio_stock = sequelize.define('Accesorio_stock',{

    ID_accesorio_modelo:{
        type : DataTypes.INTEGER,
        primaryKey : true,
        autoIncrement: true,
        allowNull: false
    },
    Nombre_accesorio : {
        type : DataTypes.STRING,
        allowNull: false
    }
},
{
    tableName : 'Accesorios_catalogo',
    timestamps : false
});



module.exports =  Accesorio_stock;