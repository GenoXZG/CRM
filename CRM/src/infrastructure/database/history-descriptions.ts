import { QueryTypes, type Transaction } from 'sequelize';
import { database } from './connection';
import type { TicketChange } from './ticket-history-repository';

const references: Record<string, string> = {
  Cliente: "SELECT ID_cliente AS id,CONCAT(Nombre_empresa,' · #',ID_cliente) AS label FROM Cliente WHERE ID_cliente IN (:ids)",
  Técnico: "SELECT ID_Tecnico AS id,CONCAT(Nombre_tecnico,' · #',ID_Tecnico) AS label FROM Tecnicos WHERE ID_Tecnico IN (:ids)",
  Unidad: "SELECT u.ID_unidad AS id,CONCAT_WS(' · ',CONCAT_WS(' ',c.Marca_unidad,c.Modelo_Unidad),IF(u.Placa_unidad IS NULL,NULL,CONCAT('Placa: ',u.Placa_unidad)),IF(u.Vin_unidad IS NULL,NULL,CONCAT('VIN: ',u.Vin_unidad)),CONCAT('#',u.ID_unidad)) AS label FROM Unidades u LEFT JOIN Unidades_catalogo c ON c.ID_Unidad_modelo=u.ID_Unidad_modelo WHERE u.ID_unidad IN (:ids)",
  Equipo: "SELECT e.ID_equipo AS id,CONCAT_WS(' · ',CONCAT_WS(' ',c.Marca_equipo,c.Modelo_equipo),IF(e.IMEI IS NULL,NULL,CONCAT('IMEI: ',e.IMEI)),CONCAT('#',e.ID_equipo)) AS label FROM Equipos e LEFT JOIN Equipos_catalogo c ON c.ID_equipo_modelo=e.ID_equipo_modelo WHERE e.ID_equipo IN (:ids)",
  'Modelo de unidad': "SELECT ID_Unidad_modelo AS id,CONCAT_WS(' · ',CONCAT_WS(' ',Marca_unidad,Modelo_Unidad),CONCAT('#',ID_Unidad_modelo)) AS label FROM Unidades_catalogo WHERE ID_Unidad_modelo IN (:ids)",
  Accesorio: "SELECT ID_accesorio_modelo AS id,CONCAT(Nombre_accesorio,' · #',ID_accesorio_modelo) AS label FROM Accesorios_catalogo WHERE ID_accesorio_modelo IN (:ids)",
  Foto: "SELECT ID_foto AS id,CONCAT(COALESCE(Nombre_original,'Fotografía'),' · #',ID_foto) AS label FROM Ticket_fotos WHERE ID_foto IN (:ids)",
};
const referenceType = (field: string) => field === 'Accesorios' ? 'Accesorio' : field;
const idsOf = (value: unknown): number[] => (Array.isArray(value) ? value : [value]).filter((id): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0);

// Batch by reference type for a whole page; snapshots always take precedence.
export async function describeHistory(groups: TicketChange[][], transaction?: Transaction): Promise<TicketChange[][]> {
  const wanted = new Map<string, Set<number>>();
  for (const changes of groups) for (const change of changes) {
    const type = referenceType(change.field);
    if (!Object.hasOwn(references, type)) continue;
    const ids = [...(change.beforeLabel === undefined ? idsOf(change.before) : []), ...(change.afterLabel === undefined ? idsOf(change.after) : [])];
    const set = wanted.get(type) ?? new Set<number>();
    for (const id of ids) set.add(id);
    if (set.size) wanted.set(type,set);
  }
  const labels = new Map<string,Map<number,string>>();
  for (const [type, ids] of wanted) {
    const rows = await database.query<{id:number;label:string}>(references[type]!, { replacements:{ids:[...ids]}, type:QueryTypes.SELECT, transaction });
    labels.set(type,new Map(rows.map(row=>[row.id,row.label])));
  }
  return groups.map(changes=>changes.map(change=>{
    const type=referenceType(change.field);
    if (!Object.hasOwn(references, type)) return change;
    const describe=(value:unknown):string|undefined=>{
      const ids=idsOf(value);
      if (!ids.length) return undefined;
      return ids.map(id=>labels.get(type)?.get(id) ?? `${type} #${id} (registro no disponible)`).join('; ');
    };
    return {...change,beforeLabel:change.beforeLabel ?? describe(change.before),afterLabel:change.afterLabel ?? describe(change.after)};
  }));
}
