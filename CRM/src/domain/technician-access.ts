import { BusinessError } from './business-error';
export interface LinkedAccount { rol: string; id_tecnico: number | null; tecnico_estado: string | null }
export function technicianAccessProblem(user: LinkedAccount): string | null {
  if (user.rol !== 'tecnico') return null;
  if (!user.id_tecnico) return 'Tu cuenta aún no está vinculada a un técnico. Solicita la vinculación al administrador.';
  if (user.tecnico_estado !== 'Activo') return 'El técnico vinculado a tu cuenta está inactivo. Contacta al administrador.';
  return null;
}
export function requireActiveTechnician(user: LinkedAccount) {
  const problem = technicianAccessProblem(user);
  if (problem) throw new BusinessError(403, problem);
}
