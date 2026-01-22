const {DataTypes} = require('sequelize');
const sequelize = require("../config/db");


const Tecnico = sequelize.define('Tecnico',{
    ID_Tecnico : {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    Nombre_tecnico : {
        type: DataTypes.STRING,
        allowNull : false
    },
    Estatus_tecnico : {
        type : DataTypes.ENUM('Activo','Inactivo'),
        allowNull: false
    },
    Numero_tecnico: {
        type : DataTypes.STRING,
        allowNull : false
    }
},
{
    tableName : 'Tecnicos',
    timestamps: false
});



module.exports = Tecnico;