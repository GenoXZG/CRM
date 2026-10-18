import { QueryTypes, type Transaction } from 'sequelize';
import {
  accessoryModel,
  clientModel,
  database,
  equipmentCatalogModel,
  ticketModel,
  technicianModel,
  unitCatalogModel,
  type DatabaseTicketStatus,
} from './models';
import { mapTicket, ticketStatusFromDatabase } from './mapping';

export async function getStatusCounts(transaction: Transaction) {
  const rows = await database.query<{ state: DatabaseTicketStatus | null; total: number | string }>(
    'SELECT Estatus_servicio AS state, COUNT(*) AS total FROM Tickets GROUP BY Estatus_servicio',
    { type: QueryTypes.SELECT, transaction },
  );
  return rows.map((row) => ({
    state: row.state ? ticketStatusFromDatabase[row.state] : null,
    count: Number(row.total),
  }));
}
export async function getTechnicianWorkload(transaction: Transaction) {
  const rows = await database.query<{
    technicianId: number | null;
    name: string | null;
    activeTickets: number | string;
  }>(
    `SELECT t.ID_tecnico AS technicianId, tech.Nombre_tecnico AS name, COUNT(*) AS activeTickets
     FROM Tickets t LEFT JOIN Tecnicos tech ON tech.ID_Tecnico = t.ID_tecnico
     WHERE t.Estatus_servicio IN ('En espera', 'En seguimiento')
     GROUP BY t.ID_tecnico, tech.Nombre_tecnico ORDER BY activeTickets DESC, t.ID_tecnico ASC LIMIT 5`,
    { type: QueryTypes.SELECT, transaction },
  );
  return rows.map((row) => ({ ...row, activeTickets: Number(row.activeTickets) }));
}
export async function getEquipmentAvailability(transaction: Transaction) {
  const rows = await database.query<{ modelId: number; model: string; available: number | string }>(
    `SELECT c.ID_equipo_modelo AS modelId, c.Modelo_equipo AS model, COUNT(e.ID_equipo) AS available
     FROM Equipos_catalogo c LEFT JOIN Equipos e ON e.ID_equipo_modelo = c.ID_equipo_modelo AND e.Estatus_equipo = 'En espera'
     GROUP BY c.ID_equipo_modelo, c.Modelo_equipo ORDER BY available ASC, c.ID_equipo_modelo ASC LIMIT 5`,
    { type: QueryTypes.SELECT, transaction },
  );
  return rows.map((row) => ({ ...row, available: Number(row.available) }));
}
export async function getCalendarTickets(transaction: Transaction) {
  return (await ticketModel.findAll({ transaction, order: [['ID_ticket', 'ASC']] })).map(mapTicket);
}


/** Read-only counts used by the first-run setup assistant. */
export async function getSetupStatus(transaction: Transaction) {
  const [clients, technicians, equipment, units, accessories] = await Promise.all([
    clientModel.count({ transaction }),
    technicianModel.count({ where: { Estatus_tecnico: 'Activo' }, transaction }),
    equipmentCatalogModel.count({ transaction }),
    unitCatalogModel.count({ transaction }),
    accessoryModel.count({ transaction }),
  ]);

  return { clients, technicians, equipment, units, accessories };
}
