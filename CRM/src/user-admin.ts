import { Router, type Request, type Response } from 'express';
import { QueryTypes, type Transaction } from 'sequelize';
import { database } from './infrastructure/database/connection';
import { emailFormat, passwordHash, sessionToken } from './auth';
import { tokenHash } from './auth-challenge';
import { BusinessError, positiveInteger } from './domain/business-error';

const router = Router();
type Row = { id: number; correo: string; rol: string; creado_en: Date; id_tecnico: number | null };
const message = (value: unknown) => typeof value === 'string' ? value.slice(0, 160) : '';
async function display(response: Response, error = '', success = '', status = 200) {
  const users = await database.query<Row>('SELECT u.id,u.correo,u.rol,u.creado_en,u.id_tecnico,t.Nombre_tecnico AS tecnico_nombre,t.Estatus_tecnico AS tecnico_estado FROM usuarios u LEFT JOIN Tecnicos t ON t.ID_Tecnico=u.id_tecnico ORDER BY u.id', { type: QueryTypes.SELECT });
  const technicians = await database.query('SELECT t.ID_Tecnico AS id,t.Nombre_tecnico AS name,t.Estatus_tecnico AS status,u.id AS owner FROM Tecnicos t LEFT JOIN usuarios u ON u.id_tecnico=t.ID_Tecnico ORDER BY t.Nombre_tecnico,t.ID_Tecnico', { type: QueryTypes.SELECT });
  return response.status(status).render('usuarios', { users, technicians, error, success });
}
// Protect the router itself, including alternate casing and future route mounts.
router.use((_request, response, next) => {
  if (response.locals.currentUser?.rol !== 'admin') return response.status(403).json({ error: 'Acceso exclusivo para administradores.' });
  next();
});
router.get('/', async (request, response, next) => {
  try { await display(response, message(request.query.error), message(request.query.success)); }
  catch (error) { next(error); }
});
function userInput(body: Record<string, unknown>, creating: boolean) {
  const correo = typeof body.correo === 'string' ? body.correo.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const confirm = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';
  const rol = body.rol;
  if (rol !== 'admin' && rol !== 'coordinador' && rol !== 'tecnico') throw new BusinessError(400, 'Rol inválido.');
  if (!emailFormat.test(correo) || correo.length > 254 || ((creating || password) && (password.length < 12 || password.length > 1024)))
    throw new BusinessError(400, 'Correo inválido o contraseña fuera del rango de 12 a 1024 caracteres.');
  if (password !== confirm) throw new BusinessError(400, 'Las contraseñas no coinciden.');
  const technicianId = rol === 'tecnico' ? positiveInteger(body.id_tecnico, 'Técnico vinculado') : null;
  return { correo, password, rol, technicianId };
}
async function editableUser(value: string, transaction: Transaction) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new BusinessError(400, 'Usuario inválido.');
  const [target] = await database.query<Row>('SELECT id,correo,rol,id_tecnico FROM usuarios WHERE id=? FOR UPDATE', { replacements: [id], type: QueryTypes.SELECT, transaction });
  if (!target) throw new BusinessError(404, 'Usuario no encontrado.');
  return target;
}
async function lockAdministration(request: Request, response: Response, transaction: Transaction) {
  // Serialize account administration in MySQL, including concurrent requests in
  // different app instances. Always lock users before sessions or challenges.
  const users = await database.query<Pick<Row, 'id' | 'rol'>>('SELECT id,rol FROM usuarios ORDER BY id FOR UPDATE', { type: QueryTypes.SELECT, transaction });
  const actorId = response.locals.currentUser.id_usuario as number;
  const token = sessionToken(request);
  if (!users.some(user => user.id === actorId && user.rol === 'admin') || !token)
    throw new BusinessError(401, 'Tu acceso cambió. Inicia sesión nuevamente.');
  const [session] = await database.query<{ found: number }>('SELECT 1 AS found FROM sesiones_usuario WHERE token_hash=? AND id_usuario=? AND segundo_factor=1 AND expira_en>UTC_TIMESTAMP() FOR UPDATE', { replacements: [tokenHash(token), actorId], type: QueryTypes.SELECT, transaction });
  if (!session) throw new BusinessError(401, 'Tu sesión terminó. Inicia sesión nuevamente.');
  return users.filter(user => user.rol === 'admin').length;
}
function requireRemainingAdministrator(target: Row, nextRole: string | null, adminCount: number) {
  if (target.rol === 'admin' && nextRole !== 'admin' && adminCount <= 1)
    throw new BusinessError(409, 'Debe permanecer al menos un administrador. Crea o promueve otra cuenta antes de continuar.');
}
async function validateTechnician(id: number | null, transaction: Transaction) {
  if (id === null) return;
  const [tech] = await database.query<{ Estatus_tecnico: string }>('SELECT Estatus_tecnico FROM Tecnicos WHERE ID_Tecnico=? FOR UPDATE', { replacements: [id], type: QueryTypes.SELECT, transaction });
  if (!tech || tech.Estatus_tecnico !== 'Activo') throw new BusinessError(400, 'Selecciona un técnico activo del catálogo.');
}
async function failure(response: Response, error: unknown, next: (error: unknown) => void) {
  if (error instanceof BusinessError && error.status === 401)
    return response.status(401).render('login', { error: error.message });
  if (error instanceof BusinessError) return display(response, error.message, '', error.status);
  if (error instanceof Error && error.name === 'SequelizeUniqueConstraintError') {
    const details = error as Error & { fields?: Record<string, unknown>; parent?: { sqlMessage?: string } };
    const linked = 'id_tecnico' in (details.fields ?? {}) || details.parent?.sqlMessage?.includes('uq_usuarios_tecnico');
    return display(response, linked ? 'El técnico ya está vinculado a otra cuenta.' : 'Ese correo ya está registrado.', '', 409);
  }
  next(error);
}
router.post('/crear', async (request, response, next) => {
  try {
    const { correo, password, rol, technicianId } = userInput(request.body ?? {}, true);
    const hash = await passwordHash(password);
    await database.transaction(async transaction => {
      await lockAdministration(request, response, transaction);
      await validateTechnician(technicianId, transaction);
      await database.query('INSERT INTO usuarios (correo,password_hash,rol,id_tecnico) VALUES (?,?,?,?)', { replacements: [correo, hash, rol, technicianId], transaction });
    });
    response.redirect('/usuarios?success=Usuario%20creado');
  } catch (error) { await failure(response, error, next); }
});
router.post('/:id/editar', async (request, response, next) => {
  try {
    const { correo, password, rol, technicianId } = userInput(request.body ?? {}, false);
    const hash = password ? await passwordHash(password) : null;
    await database.transaction(async transaction => {
      const adminCount = await lockAdministration(request, response, transaction);
      const target = await editableUser(request.params.id!, transaction);
      requireRemainingAdministrator(target, rol, adminCount);
      await validateTechnician(technicianId, transaction);
      await database.query(`UPDATE usuarios SET correo=?,rol=?,id_tecnico=?${hash ? ',password_hash=?' : ''} WHERE id=?`, { replacements: hash ? [correo, rol, technicianId, hash, target.id] : [correo, rol, technicianId, target.id], transaction });
      await database.query('DELETE FROM desafios_login WHERE id_usuario=?', { replacements: [target.id], transaction });
      await database.query('DELETE FROM recuperaciones_password WHERE id_usuario=?', { replacements: [target.id], transaction });
      // Revoke sessions for any account edit, including role changes.
      await database.query('DELETE FROM sesiones_usuario WHERE id_usuario=?', { replacements: [target.id], transaction });
    });
    if (Number(request.params.id) === response.locals.currentUser.id_usuario) {
      response.clearCookie('crm_session', { path: '/', httpOnly: true, sameSite: 'lax' });
      response.clearCookie('crm_pending', { path: '/login', httpOnly: true, sameSite: 'lax' });
      return response.redirect('/login');
    }
    response.redirect('/usuarios?success=Usuario%20actualizado');
  } catch (error) { await failure(response, error, next); }
});
router.post('/:id/eliminar', async (request, response, next) => {
  try {
    await database.transaction(async transaction => {
      const adminCount = await lockAdministration(request, response, transaction);
      const target = await editableUser(request.params.id!, transaction);
      requireRemainingAdministrator(target, null, adminCount);
      if (target.id === response.locals.currentUser.id_usuario)
        throw new BusinessError(409, 'No puedes eliminar tu propia cuenta. Solicita la eliminación a otro administrador.');
      await database.query('DELETE FROM usuarios WHERE id=?', { replacements: [target.id], transaction });
    });
    response.redirect('/usuarios?success=Usuario%20eliminado');
  } catch (error) { await failure(response, error, next); }
});
export default router;
