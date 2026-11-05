import { AsyncLocalStorage } from 'node:async_hooks';
export interface AuditActor { id_usuario: number; correo: string; rol: string }
const storage = new AsyncLocalStorage<AuditActor>();
export const currentAuditActor = () => storage.getStore();
export const runAsAuditActor = (actor: AuditActor, operation: () => void) => storage.run(actor, operation);
