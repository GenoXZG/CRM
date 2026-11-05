export interface SelectedAccessory {
  id: string;
  name: string;
  readOnly: boolean;
}

export class AssignmentState {
  readonly equipment = new Map<string, string>();
  readonly accessories = new Map<string, SelectedAccessory[]>();
  readonly lockedUnits = new Set<string>();
  private readonly equipmentOwners = new Map<string, string>();

  reset() {
    this.equipment.clear();
    this.accessories.clear();
    this.lockedUnits.clear();
    this.equipmentOwners.clear();
  }

  assign(unitId: string, equipmentId: string, persisted = false) {
    if (this.lockedUnits.has(unitId))
      throw new Error('El equipo guardado se modifica desde los detalles del ticket.');
    const owner = this.equipmentOwners.get(equipmentId);
    if (owner && owner !== unitId)
      throw new Error('Este equipo ya está asignado a otra unidad en esta sesión.');
    const previous = this.equipment.get(unitId);
    if (previous) this.equipmentOwners.delete(previous);
    this.equipment.set(unitId, equipmentId);
    this.equipmentOwners.set(equipmentId, unitId);
    if (persisted) this.lockedUnits.add(unitId);
  }

  release(unitId: string) {
    if (this.lockedUnits.has(unitId))
      throw new Error('El equipo guardado se modifica desde los detalles del ticket.');
    const device = this.equipment.get(unitId);
    if (device) this.equipmentOwners.delete(device);
    this.equipment.delete(unitId);
  }

  addAccessory(unitId: string, accessory: SelectedAccessory) {
    const selected = this.accessories.get(unitId) ?? [];
    if (selected.some((item) => item.id === accessory.id))
      throw new Error('Este accesorio ya está agregado.');
    selected.push(accessory);
    this.accessories.set(unitId, selected);
  }

  removeAccessory(unitId: string, accessoryId: string) {
    const selected = this.accessories.get(unitId) ?? [];
    const accessory = selected.find((item) => item.id === accessoryId);
    if (accessory?.readOnly) throw new Error('No se puede eliminar un accesorio guardado.');
    this.accessories.set(
      unitId,
      selected.filter((item) => item.id !== accessoryId),
    );
  }

  // Preserve the existing HTTP contract at this boundary.
  toRequest() {
    return {
      equipos: Object.fromEntries(this.equipment),
      accesorios: Object.fromEntries(
        Array.from(this.accessories, ([unitId, items]) => [
          unitId,
          items.map((item) => ({ id: item.id, nombre: item.name, readOnly: item.readOnly })),
        ]),
      ),
    };
  }
}
