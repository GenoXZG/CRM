import { describeHistory } from './history-descriptions';
import { QueryTypes, type Transaction } from 'sequelize';
import { database } from './connection';
import { currentAuditActor } from '../audit/context';

export interface TicketChange { field: string; before: unknown; after: unknown; beforeLabel?: string; afterLabel?: string }
export async function recordTicketEvent(ticketId: number, event: string, changes: TicketChange[], transaction: Transaction) {
  if (!changes.length) return;
  const actor = currentAuditActor();
  const [described] = await describeHistory([changes], transaction);
  await database.query(`INSERT INTO ticket_historial (id_ticket,evento,cambios,id_usuario,usuario_correo,usuario_rol,ocurrido_en)
    VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(3))`, {
    replacements: [ticketId, event, JSON.stringify(described), actor?.id_usuario ?? null, actor?.correo ?? null, actor?.rol ?? null], transaction,
  });
}
export function changesBetween(before: Record<string, unknown>, after: Record<string, unknown>, labels: Record<string, string>): TicketChange[] {
  const value = (input: unknown) => input instanceof Date ? input.toISOString() : input ?? null;
  return Object.entries(labels).flatMap(([key, field]) => {
    const previous = value(before[key]), next = value(after[key]);
    return JSON.stringify(previous) === JSON.stringify(next) ? [] : [{ field, before: previous, after: next }];
  });
}
export async function ticketHistory(ticketId: number, input: Record<string, unknown>) {
  const sizeValue = Number(input.history_size), pageValue = Number(input.history_page);
  const size = [5,10,25,50].includes(sizeValue) ? sizeValue : 10;
  const [total] = await database.query<{ total: string | number }>('SELECT COUNT(*) AS total FROM ticket_historial WHERE id_ticket=?', { replacements: [ticketId], type: QueryTypes.SELECT });
  const count = Number(total!.total), pages = Math.max(1, Math.ceil(count / size));
  const page = Math.min(Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1, pages);
  const rows = await database.query<{ id: string | number; evento: string; cambios: string | TicketChange[]; usuario_correo: string | null; usuario_rol: string | null; ocurrido_en: Date }>(
    'SELECT id,evento,cambios,usuario_correo,usuario_rol,ocurrido_en FROM ticket_historial WHERE id_ticket=? ORDER BY id DESC LIMIT ? OFFSET ?',
    { replacements: [ticketId, size, (page-1)*size], type: QueryTypes.SELECT },
  );
  const changes = rows.map(row => typeof row.cambios === 'string' ? JSON.parse(row.cambios) as TicketChange[] : row.cambios);
  const described = await describeHistory(changes);
  return { count, pages, page, size, rows: rows.map((row,index) => ({ ...row, cambios: described[index]! })) };
}
