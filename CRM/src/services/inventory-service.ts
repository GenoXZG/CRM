import { BusinessError, positiveInteger } from '../domain/business-error';
import { searchInventory, type InventorySearch } from '../infrastructure/database/inventory-repository';

export async function getInventory(input: Record<string, unknown>) {
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const status = text(input.status);
  if (status && status !== 'pending_assignment' && status !== 'assigned' && status !== 'installed')
    throw new BusinessError(400, 'Estado de equipo inválido');
  const size = Number(input.size), page = Number(input.page);
  const filters: InventorySearch = {
    search: text(input.search).slice(0, 255), status: status as InventorySearch['status'],
    brand: text(input.brand).slice(0, 255), model: text(input.model) ? positiveInteger(input.model, 'Modelo') : null,
    size: [5, 10, 25, 50].includes(size) ? size : 10,
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
  return { ...(await searchInventory(filters)), filters };
}
