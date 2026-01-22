const Sequelize = require('sequelize');
const sequelize = require('../config/db');

const Cliente = require('./Cliente');
const Tecnico = require('./Tecnicos');
const Ticket = require('./Tickets');
const Equipo_stock = require('./Equipo_stock');
const Equipo = require('./Equipos'); 
const Unidad_catalogo = require('./Unidad_stock');
const Unidad = require('./Unidades');
const Accesorio_stock = require('./Accesorio_stock');
const TicketFoto = require('./Ticket_foto');
const Unidad_stock = require('./Unidad_stock')
const Unidad_Accesorio = require('./Unidad_Accesorio');


// Relaciones
Cliente.hasMany(Ticket, { foreignKey: 'ID_cliente' });
Ticket.belongsTo(Cliente, { foreignKey: 'ID_cliente' });

Tecnico.hasMany(Ticket, { foreignKey: 'ID_tecnico' });
Ticket.belongsTo(Tecnico, { foreignKey: 'ID_tecnico' });

Equipo_stock.hasMany(Equipo, {foreignKey:'ID_equipo_modelo'});
Equipo.belongsTo(Equipo_stock, {foreignKey:'ID_equipo_modelo'});


Ticket.hasMany(Unidad, { foreignKey: 'ID_ticket' });
Unidad.belongsTo(Ticket, { foreignKey: 'ID_ticket' });
Unidad.belongsTo(Unidad_catalogo, { foreignKey: 'ID_Unidad_modelo' });


Ticket.hasMany(TicketFoto, { foreignKey: 'ID_ticket' });
TicketFoto.belongsTo(Ticket, { foreignKey: 'ID_ticket' });


Unidad.belongsTo(Equipo, { foreignKey: 'ID_equipo' });
Equipo.hasOne(Unidad, { foreignKey: 'ID_equipo' });


Unidad.belongsToMany(Accesorio_stock, { 
    through: Unidad_Accesorio, 
    foreignKey: 'ID_unidad',
    otherKey: 'ID_accesorio'
});


Accesorio_stock.belongsToMany(Unidad, { 
    through: Unidad_Accesorio, 
    foreignKey: 'ID_accesorio',
    otherKey: 'ID_unidad'
});



module.exports = {
  sequelize,
  Cliente,
  Tecnico,
  Ticket,
  Equipo_stock,
  Equipo,
  Unidad_catalogo,
  Unidad,
  Accesorio_stock,
  TicketFoto,
  Unidad_stock,
  Unidad_Accesorio
};

