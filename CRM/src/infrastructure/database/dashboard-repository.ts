import { Op, QueryTypes, type Transaction } from 'sequelize';
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
import { mapTicketSummary, ticketStatusFromDatabase } from './mapping';

export async function getStatusCounts(transaction: Transaction, technician?: number) {
  const rows = await database.query<{ state: DatabaseTicketStatus | null; total: number | string }>(
    'SELECT Estatus_servicio AS state, COUNT(*) AS total FROM Tickets WHERE (:technician IS NULL OR ID_tecnico=:technician) GROUP BY Estatus_servicio',
    { type: QueryTypes.SELECT, transaction, replacements: { technician: technician ?? null } },
  );
  return rows.map((row) => ({
    state: row.state ? ticketStatusFromDatabase[row.state] : null,
    count: Number(row.total),
  }));
}
import { activeTicketSql, incompleteTicketSql } from './ticket-attention';

export async function getTechnicianWorkload(transaction: Transaction, technician?: number) {
  const rows = await database.query<{
    technicianId: number | null;
    name: string | null;
    activeTickets: number | string;
  }>(
    `SELECT t.ID_tecnico AS technicianId, tech.Nombre_tecnico AS name, COUNT(*) AS activeTickets
     FROM Tickets t LEFT JOIN Tecnicos tech ON tech.ID_Tecnico = t.ID_tecnico
     WHERE t.Estatus_servicio IN ('En espera', 'En seguimiento') AND t.ID_tecnico IS NOT NULL AND (:technician IS NULL OR t.ID_tecnico=:technician)
     GROUP BY t.ID_tecnico, tech.Nombre_tecnico ORDER BY activeTickets DESC, t.ID_tecnico ASC LIMIT 5`,
    { type: QueryTypes.SELECT, transaction, replacements: { technician: technician ?? null } },
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
export async function getCalendarTickets(transaction: Transaction, start: string, end: string, technician?: number) {
  const where = { ...(technician === undefined ? {} : { ID_tecnico: technician }), Fecha_servicio: { [Op.gte]: new Date(`${start}T00:00:00Z`), [Op.lt]: new Date(`${end}T00:00:00Z`) } };
  const count = await ticketModel.count({ where, transaction });
  const rows = await ticketModel.findAll({ where, transaction, include: [clientModel, { model: technicianModel, required: false }], order: [['Fecha_servicio', 'ASC'], ['ID_ticket', 'ASC']], limit: 200 });
  return { count, tickets: rows.map(mapTicketSummary) };
}
export async function getOperationalCounts(transaction: Transaction, today: string, tomorrow: string, technician?: number) {
  const [row] = await database.query<{ today: string | number; overdue: string | number; unassigned: string | number; incomplete: string | number }>(
    `SELECT
      COALESCE(SUM(t.Fecha_servicio >= :today AND t.Fecha_servicio < :tomorrow), 0) AS today,
      COALESCE(SUM(${activeTicketSql('t')} AND t.Fecha_servicio < :today), 0) AS overdue,
      COALESCE(SUM(${activeTicketSql('t')} AND t.ID_tecnico IS NULL), 0) AS unassigned,
      COALESCE(SUM(${activeTicketSql('t')} AND ${incompleteTicketSql('t')}), 0) AS incomplete
     FROM Tickets t WHERE (:technician IS NULL OR t.ID_tecnico=:technician)`,
    { type: QueryTypes.SELECT, transaction, replacements: { today, tomorrow, technician: technician ?? null } },
  );
  return { today: Number(row!.today), overdue: Number(row!.overdue), unassigned: Number(row!.unassigned), incomplete: Number(row!.incomplete) };
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
