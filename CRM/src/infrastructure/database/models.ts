import { DataTypes, type Model, type Optional } from 'sequelize';
import { database } from './connection';
export { database } from './connection';

// Existing SQL names are restricted to the persistence/compatibility boundary.
export type DatabaseTicketStatus = 'En espera' | 'En seguimiento' | 'Finalizado';
export type DatabaseServiceType = 'Instalacion' | 'Desinstalacion' | 'Revision' | 'Rescate';
export type DatabaseEquipmentStatus = 'En espera' | 'Asignado' | 'Instalado';
export interface TicketAttributes {
  ID_ticket: number;
  ID_cliente: number;
  ID_tecnico: number | null;
  Tipo_servicio: DatabaseServiceType | null;
  Estatus_servicio: DatabaseTicketStatus | null;
  Numero_unidades: number | null;
  Fecha_servicio: Date | null;
  Link_maps: string | null;
  Comentarios: string | null;
  Estatus_unidades: 0 | 1 | 2 | null;
}
export interface ClientAttributes {
  ID_cliente: number;
  Nombre_empresa: string;
  Encargado: string;
  Numero: string;
}
export interface TechnicianAttributes {
  ID_Tecnico: number;
  Nombre_tecnico: string;
  Estatus_tecnico: 'Activo' | 'Inactivo';
  Numero_tecnico: string;
}
export interface EquipmentModelAttributes {
  ID_equipo_modelo: number;
  Marca_equipo: string;
  Modelo_equipo: string;
}
export interface UnitModelAttributes {
  ID_Unidad_modelo: number;
  Marca_unidad: string;
  Modelo_Unidad: string;
}
export interface AccessoryAttributes {
  ID_accesorio_modelo: number;
  Nombre_accesorio: string;
}
export interface EquipmentAttributes {
  ID_equipo: number;
  ID_equipo_modelo: number;
  IMEI: string | null;
  ID_modem: string | null;
  Estatus_equipo: DatabaseEquipmentStatus;
}
export interface UnitAttributes {
  ID_unidad: number;
  ID_Unidad_modelo: number;
  ID_equipo: number | null;
  ID_ticket: number;
  Placa_unidad: string | null;
  Vin_unidad: string | null;
}
export interface PhotoAttributes {
  ID_foto: number;
  ID_ticket: number | null;
  Ruta_archivo: string;
  Nombre_original: string | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface UnitAccessoryAttributes {
  ID_unidad: number;
  ID_accesorio: number;
}
type Row<A extends object, K extends keyof A = never> = Model<A, Optional<A, K>> & A;
export type ClientRow = Row<ClientAttributes, 'ID_cliente'>;
export type TechnicianRow = Row<TechnicianAttributes, 'ID_Tecnico'>;
export type EquipmentModelRow = Row<EquipmentModelAttributes, 'ID_equipo_modelo'>;
export type UnitModelRow = Row<UnitModelAttributes, 'ID_Unidad_modelo'>;
export type AccessoryRow = Row<AccessoryAttributes, 'ID_accesorio_modelo'>;
export type PhotoRow = Row<PhotoAttributes, 'ID_foto' | 'createdAt' | 'updatedAt'>;
export type EquipmentRow = Row<EquipmentAttributes, 'ID_equipo' | 'Estatus_equipo'> & {
  Equipo_stock?: EquipmentModelRow;
};
export type UnitRow = Row<UnitAttributes, 'ID_unidad'> & {
  Unidad_stock?: UnitModelRow;
  Equipo?: EquipmentRow;
  Accesorio_stocks?: AccessoryRow[];
  Ticket?: TicketRow;
};
export type TicketRow = Row<
  TicketAttributes,
  'ID_ticket' | 'Estatus_servicio' | 'Estatus_unidades'
> & {
  Cliente?: ClientRow;
  Tecnico?: TechnicianRow;
  Unidades?: UnitRow[];
  TicketFotos?: PhotoRow[];
};

// Model names and column names are compatibility contracts for existing SQL and includes.
const primaryKey = () => ({
  type: DataTypes.INTEGER,
  primaryKey: true,
  autoIncrement: true,
  allowNull: false,
});
const requiredString = () => ({ type: DataTypes.STRING(255), allowNull: false });
const modelOptions = (tableName: string) => ({ tableName, timestamps: false });
export const clientModel = database.define<ClientRow>(
  'Cliente',
  {
    ID_cliente: primaryKey(),
    Nombre_empresa: { type: DataTypes.STRING(100), allowNull: false },
    Encargado: { type: DataTypes.STRING(50), allowNull: false },
    Numero: { type: DataTypes.STRING(10), allowNull: false },
  },
  modelOptions('Cliente'),
);
export const technicianModel = database.define<TechnicianRow>(
  'Tecnico',
  {
    ID_Tecnico: primaryKey(),
    Nombre_tecnico: requiredString(),
    Estatus_tecnico: { type: DataTypes.ENUM('Activo', 'Inactivo'), allowNull: false },
    Numero_tecnico: requiredString(),
  },
  modelOptions('Tecnicos'),
);
export const ticketModel = database.define<TicketRow>(
  'Ticket',
  {
    ID_ticket: primaryKey(),
    ID_cliente: { type: DataTypes.INTEGER, allowNull: false },
    ID_tecnico: { type: DataTypes.INTEGER, allowNull: true },
    Tipo_servicio: {
      type: DataTypes.ENUM('Instalacion', 'Desinstalacion', 'Revision', 'Rescate'),
      allowNull: true,
    },
    Estatus_servicio: {
      type: DataTypes.ENUM('En espera', 'En seguimiento', 'Finalizado'),
      defaultValue: 'En espera',
      allowNull: true,
    },
    Numero_unidades: { type: DataTypes.INTEGER, allowNull: true },
    Fecha_servicio: { type: DataTypes.DATE, allowNull: true },
    Link_maps: { type: DataTypes.STRING(255), allowNull: true },
    Comentarios: { type: DataTypes.TEXT, allowNull: true },
    Estatus_unidades: { type: DataTypes.TINYINT, defaultValue: 0, allowNull: true },
  },
  modelOptions('Tickets'),
);
export const equipmentCatalogModel = database.define<EquipmentModelRow>(
  'Equipo_stock',
  {
    ID_equipo_modelo: primaryKey(),
    Marca_equipo: requiredString(),
    Modelo_equipo: requiredString(),
  },
  modelOptions('Equipos_catalogo'),
);
export const unitCatalogModel = database.define<UnitModelRow>(
  'Unidad_stock',
  {
    ID_Unidad_modelo: primaryKey(),
    Marca_unidad: requiredString(),
    Modelo_Unidad: requiredString(),
  },
  modelOptions('Unidades_catalogo'),
);
export const accessoryModel = database.define<AccessoryRow>(
  'Accesorio_stock',
  {
    ID_accesorio_modelo: primaryKey(),
    Nombre_accesorio: requiredString(),
  },
  modelOptions('Accesorios_catalogo'),
);
export const equipmentModel = database.define<EquipmentRow>(
  'Equipos',
  {
    ID_equipo: primaryKey(),
    ID_equipo_modelo: { type: DataTypes.INTEGER, allowNull: false },
    IMEI: { type: DataTypes.STRING(100), allowNull: true },
    ID_modem: { type: DataTypes.STRING(100), allowNull: true },
    Estatus_equipo: {
      type: DataTypes.ENUM('En espera', 'Asignado', 'Instalado'),
      defaultValue: 'En espera',
    },
  },
  modelOptions('Equipos'),
);
export const unitModel = database.define<UnitRow>(
  'Unidades',
  {
    ID_unidad: primaryKey(),
    ID_Unidad_modelo: { type: DataTypes.INTEGER, allowNull: false },
    ID_equipo: { type: DataTypes.INTEGER, allowNull: true, unique: true },
    ID_ticket: { type: DataTypes.INTEGER, allowNull: false },
    Placa_unidad: { type: DataTypes.STRING(255), allowNull: true },
    Vin_unidad: { type: DataTypes.STRING(255), allowNull: true },
  },
  modelOptions('Unidades'),
);
export const photoModel = database.define<PhotoRow>(
  'TicketFoto',
  {
    ID_foto: primaryKey(),
    ID_ticket: { type: DataTypes.INTEGER, allowNull: true },
    Ruta_archivo: requiredString(),
    Nombre_original: { type: DataTypes.STRING(255), allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  },
  { tableName: 'Ticket_fotos', timestamps: true },
);
export const unitAccessoryModel = database.define<Row<UnitAccessoryAttributes>>(
  'Unidad_Accesorio',
  {
    ID_unidad: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      references: { model: 'Unidades', key: 'ID_unidad' },
    },
    ID_accesorio: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      references: { model: 'Accesorios_catalogo', key: 'ID_accesorio_modelo' },
    },
  },
  modelOptions('Unidad_Accesorio'),
);

clientModel.hasMany(ticketModel, { foreignKey: 'ID_cliente' });
ticketModel.belongsTo(clientModel, { foreignKey: 'ID_cliente' });
technicianModel.hasMany(ticketModel, { foreignKey: 'ID_tecnico' });
ticketModel.belongsTo(technicianModel, { foreignKey: 'ID_tecnico' });
equipmentCatalogModel.hasMany(equipmentModel, { foreignKey: 'ID_equipo_modelo' });
equipmentModel.belongsTo(equipmentCatalogModel, { foreignKey: 'ID_equipo_modelo' });
ticketModel.hasMany(unitModel, { foreignKey: 'ID_ticket' });
unitModel.belongsTo(ticketModel, { foreignKey: 'ID_ticket' });
unitModel.belongsTo(unitCatalogModel, { foreignKey: 'ID_Unidad_modelo' });
ticketModel.hasMany(photoModel, { foreignKey: 'ID_ticket' });
photoModel.belongsTo(ticketModel, { foreignKey: 'ID_ticket' });
unitModel.belongsTo(equipmentModel, { foreignKey: 'ID_equipo' });
equipmentModel.hasOne(unitModel, { foreignKey: 'ID_equipo' });
unitModel.belongsToMany(accessoryModel, {
  through: unitAccessoryModel,
  foreignKey: 'ID_unidad',
  otherKey: 'ID_accesorio',
});
accessoryModel.belongsToMany(unitModel, {
  through: unitAccessoryModel,
  foreignKey: 'ID_accesorio',
  otherKey: 'ID_unidad',
});
