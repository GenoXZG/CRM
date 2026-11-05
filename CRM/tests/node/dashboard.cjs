// Run against the configured test/demo database after npm run build.
// Fixtures are isolated by IDs and removed even when assertions fail.
const assert = require('node:assert/strict');
const { dashboardPeriod, operatingToday, shiftDay } = require(process.cwd() + '/dist/domain/dashboard-period');
const m = require(process.cwd() + '/dist/infrastructure/database/models');
const repo = require(process.cwd() + '/dist/infrastructure/database/dashboard-repository');
const { getTicketList } = require(process.cwd() + '/dist/services/ticket-search-service');
const { ticketListReturn } = require(process.cwd() + '/dist/adapters/ticket-navigation');
(async () => {
  let client, tech, unitModel, equipmentModel, equipment;
  try {
    assert.equal(operatingToday(new Date('2026-10-20T05:59:59Z')), '2026-10-19');
    assert.equal(operatingToday(new Date('2026-10-20T06:00:00Z')), '2026-10-20');
    assert.equal(dashboardPeriod({ date: '2028-02-29', view: 'month' }).days, 29);
    assert.equal(dashboardPeriod({ date: '2026-10-18', view: 'week' }).start, '2026-10-12');
    for (const date of ['2026-02-30', 'bad', '0001-01-01']) assert.throws(() => dashboardPeriod({ date }));
    assert.throws(() => dashboardPeriod({ view: 'bad' }));
    assert.equal(ticketListReturn('/tickets?attention=overdue&page=2'), '/tickets?attention=overdue&page=2');
    const today = operatingToday(), tomorrow = shiftDay(today, 1), yesterday = shiftDay(today, -1);
    const marker = 'QA_DASHBOARD_' + Date.now();
    client = await m.clientModel.create({ Nombre_empresa: marker, Encargado: 'QA', Numero: '5512345678' });
    tech = await m.technicianModel.create({ Nombre_tecnico: marker, Numero_tecnico: '5512345678', Estatus_tecnico: 'Activo' });
    unitModel = await m.unitCatalogModel.create({ Marca_unidad: marker, Modelo_Unidad: 'QA' });
    equipmentModel = await m.equipmentCatalogModel.create({ Marca_equipo: marker, Modelo_equipo: 'QA' });
    equipment = await m.equipmentModel.create({ ID_equipo_modelo: equipmentModel.ID_equipo_modelo, Estatus_equipo: 'Asignado' });
    const baseline = await m.database.transaction(t => repo.getOperationalCounts(t, today, tomorrow));
    const make = (state, date, technician = null) => m.ticketModel.create({ ID_cliente: client.ID_cliente, ID_tecnico: technician, Tipo_servicio: 'Instalacion', Numero_unidades: 1, Estatus_servicio: state, Fecha_servicio: date ? new Date(date + 'T12:00:00Z') : null });
    const overdue = await make('En espera', yesterday);
    const ready = await make('En seguimiento', today, tech.ID_Tecnico);
    await m.unitModel.create({ ID_ticket: ready.ID_ticket, ID_Unidad_modelo: unitModel.ID_Unidad_modelo, ID_equipo: equipment.ID_equipo });
    await make('Finalizado', yesterday);
    await make('En espera', null);
    await make('En espera', tomorrow);
    const counts = await m.database.transaction(t => repo.getOperationalCounts(t, today, tomorrow));
    assert.deepEqual(Object.fromEntries(Object.keys(counts).map(k => [k, counts[k] - baseline[k]])), { today: 1, overdue: 1, unassigned: 3, incomplete: 3 });
    for (const [attention, expected] of [['overdue', 1], ['unassigned', 3], ['incomplete', 3], ['active', 4]]) {
      const result = await getTicketList({ attention, client: String(client.ID_cliente), size: '50' });
      assert.equal(result.count, expected, attention);
      if (attention === 'overdue') assert.equal(result.tickets[0].id, overdue.ID_ticket);
    }
    const load = await getTicketList({ attention: 'active', technician: String(tech.ID_Tecnico) });
    assert.equal(load.count, 1);
    const agenda = await m.database.transaction(t => repo.getCalendarTickets(t, today, tomorrow));
    assert(agenda.tickets.some(t => t.id === ready.ID_ticket && t.client.companyName === marker && t.technician.name === marker));
    assert(!agenda.tickets.some(t => t.id === overdue.ID_ticket));
    console.log('PASS operating-day boundaries, leap months, validation, dashboard/list count parity, actual preparation and agenda range/context');
  } finally {
    if (client) {
      const tickets = await m.ticketModel.findAll({ where: { ID_cliente: client.ID_cliente }, attributes: ['ID_ticket'] });
      await m.unitModel.destroy({ where: { ID_ticket: tickets.map(t => t.ID_ticket) } });
      await m.ticketModel.destroy({ where: { ID_cliente: client.ID_cliente } });
      await client.destroy();
    }
    if (equipment) await equipment.destroy();
    if (equipmentModel) await equipmentModel.destroy();
    if (unitModel) await unitModel.destroy();
    if (tech) await tech.destroy();
    await m.database.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
