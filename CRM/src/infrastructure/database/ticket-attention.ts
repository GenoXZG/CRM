// Shared predicates keep dashboard counts and the ticket list consistent.
export const activeTicketSql = (alias: string) => `${alias}.Estatus_servicio IN ('En espera', 'En seguimiento')`;
export const incompleteTicketSql = (alias: string) => `(
  COALESCE(${alias}.Numero_unidades, 0) <= 0
  OR (SELECT COUNT(*) FROM Unidades u WHERE u.ID_ticket = ${alias}.ID_ticket) <> ${alias}.Numero_unidades
  OR EXISTS (SELECT 1 FROM Unidades u WHERE u.ID_ticket = ${alias}.ID_ticket AND u.ID_equipo IS NULL)
)`;
