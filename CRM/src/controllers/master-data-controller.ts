import type { Request, Response } from 'express';
import { respondError } from '../adapters/http-errors';
import {
  readAccessory,
  readClient,
  readEquipmentModel,
  readTechnician,
  readUnitModel,
  requestBody,
} from '../adapters/master-data-http';
import {
  serializeAccessory,
  serializeClient,
  serializeEquipmentModel,
  serializeTechnician,
  serializeUnitModel,
} from '../adapters/legacy-http';
import {
  accessoryCatalogService,
  clientService,
  equipmentCatalogService,
  getUnitBrands,
  getUnitModelsByBrand,
  technicianService,
  unitCatalogService,
} from '../services/master-data-service';

interface MasterDataService<Entity> {
  list(): Promise<Entity[]>;
  create(input: unknown): Promise<Entity>;
  update(id: unknown, input: unknown): Promise<void>;
  remove(id: unknown): Promise<void>;
}
function controller<Entity>(
  service: MasterDataService<Entity>,
  read: (input: Record<string, unknown>) => unknown,
  serialize: (entity: Entity) => unknown,
  view: string,
  key: string,
  redirect: string,
  idField: string,
) {
  return {
    async list(_request: Request, response: Response) {
      try {
        response.render(view, {
          [key]: (await service.list()).map(serialize),
          setupWizard: typeof _request.query.setup === 'string' ? _request.query.setup : '',
        });
      } catch (error) {
        respondError(response, error);
      }
    },
    async create(request: Request, response: Response) {
      try {
        await service.create(read(requestBody(request.body as unknown)));
        const setupWizard = request.body?.setupWizard;
        const allowedSetupSteps = new Set(['clients', 'technicians', 'equipment', 'units', 'accessories']);
        if (typeof setupWizard === 'string' && allowedSetupSteps.has(setupWizard)) {
          response.redirect(`/?setupReturn=${encodeURIComponent(setupWizard)}`);
          return;
        }
        response.redirect(redirect);
      } catch (error) {
        respondError(response, error);
      }
    },
    async update(request: Request, response: Response) {
      try {
        const input = requestBody(request.body as unknown);
        await service.update(input[idField], read(input));
        response.redirect(redirect);
      } catch (error) {
        respondError(response, error);
      }
    },
    async remove(request: Request, response: Response) {
      try {
        await service.remove(requestBody(request.body as unknown)[idField]);
        response.redirect(redirect);
      } catch (error) {
        respondError(response, error);
      }
    },
  };
}
export const clients = controller(
  clientService,
  readClient,
  serializeClient,
  'clientes',
  'clientes',
  '/clientes',
  'ID_cliente',
);
export const technicians = controller(
  technicianService,
  readTechnician,
  serializeTechnician,
  'tecnicos',
  'tecnicos',
  '/tecnicos',
  'ID_Tecnico',
);
export const equipmentCatalog = controller(
  equipmentCatalogService,
  readEquipmentModel,
  serializeEquipmentModel,
  'equipos_catalogo',
  'equipos_stock',
  '/equipos',
  'ID_equipo_modelo',
);
export const unitCatalog = controller(
  unitCatalogService,
  readUnitModel,
  serializeUnitModel,
  'unidades_catalogo',
  'unidades',
  '/unidades',
  'ID_Unidad_modelo',
);
export const accessoryCatalog = controller(
  accessoryCatalogService,
  readAccessory,
  serializeAccessory,
  'accesorios_catalogo',
  'accesorios_stock',
  '/accesorios',
  'ID_accesorio_modelo',
);

export async function listBrands(_request: Request, response: Response) {
  try {
    response.json((await getUnitBrands()).map((brand) => ({ Marca_unidad: brand })));
  } catch (error) {
    respondError(response, error);
  }
}
export async function listModels(request: Request, response: Response) {
  try {
    response.json((await getUnitModelsByBrand(request.query.marca)).map(serializeUnitModel));
  } catch (error) {
    respondError(response, error);
  }
}
