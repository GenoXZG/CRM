import { Router } from 'express';
import { QueryTypes } from 'sequelize';
import { database } from './infrastructure/database/connection';
import { passwordHash } from './auth';

const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const adminEmail = 'admin@gmail.com';
type Row = { id: number; correo: string; rol: string; creado_en: Date };
const message = (v: unknown) => typeof v === 'string' ? v.slice(0, 160) : '';
async function display(res: import('express').Response, error = '', success = '', status = 200) {
  const users = await database.query<Row>('SELECT id, correo, rol, creado_en FROM usuarios ORDER BY id', {type: QueryTypes.SELECT});
  return res.status(status).render('usuarios', {users, error, success});
}
router.get('/', async (req, res, next) => {
  try { await display(res, message(req.query.error), message(req.query.success)); } catch(e) { next(e); }
});
router.post('/crear', async (req, res, next) => {
  try {
    const correo = String(req.body.correo ?? '').trim().toLowerCase();
    const password = String(req.body.password ?? '');
    const confirmPassword = String(req.body.confirmPassword ?? '');
    const rol = String(req.body.rol ?? 'tecnico');
    if (!['coordinador','tecnico'].includes(rol)) return display(res,'Rol inválido.','',400);
    if (!emailPattern.test(correo) || correo.length > 254 || password.length < 12 || password.length > 1024) return display(res,'Correo inválido o contraseña menor a 12 caracteres.', '', 400);
    if (password !== confirmPassword) return display(res,'Las contraseñas no coinciden.', '',400);
    if (correo === adminEmail) return display(res,'La cuenta administradora ya está reservada.', '', 400);
    const exists = await database.query<Row>('SELECT id FROM usuarios WHERE correo=? LIMIT 1',{replacements:[correo],type:QueryTypes.SELECT});
    if (exists.length) return display(res,'Ya existe un usuario con ese correo.', '', 409);
    await database.query("INSERT INTO usuarios (correo,password_hash,rol) VALUES (?,?,?)",{replacements:[correo,await passwordHash(password),rol]});
    res.redirect('/usuarios?success=Usuario%20creado');
  } catch(e) { next(e); }
});
router.post('/:id/editar', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const correo = String(req.body.correo ?? '').trim().toLowerCase();
    const password = String(req.body.password ?? '');
    const confirmPassword = String(req.body.confirmPassword ?? '');
    const rol = String(req.body.rol ?? 'tecnico');
    if (!['coordinador','tecnico'].includes(rol)) return display(res,'Rol inválido.','',400);
    if (password && password !== confirmPassword) return display(res,'Las contraseñas no coinciden.', '',400);
    if (!Number.isSafeInteger(id) || id < 1 || !emailPattern.test(correo) || correo.length > 254 || (password && (password.length < 12 || password.length > 1024))) return display(res,'Datos inválidos. La contraseña nueva debe tener mínimo 12 caracteres.', '', 400);
    const [target] = await database.query<Row>('SELECT id,correo,rol FROM usuarios WHERE id=? LIMIT 1',{replacements:[id], type:QueryTypes.SELECT});
    if (!target) return display(res,'Usuario no encontrado.', '',404);
    if (target.rol === 'admin' || target.correo === adminEmail || correo === adminEmail) return display(res,'La cuenta principal no se puede modificar desde aquí.', '',403);
    const existing = await database.query<Row>('SELECT id FROM usuarios WHERE correo=? AND id<>? LIMIT 1',{replacements:[correo,id],type:QueryTypes.SELECT});
    if (existing.length) return display(res,'Ese correo ya está registrado.', '',409);
    if (password) {
      await database.query('UPDATE usuarios SET correo=?,password_hash=?,rol=? WHERE id=? AND rol<>\'admin\'', {replacements:[correo,await passwordHash(password),rol,id]});
      await database.query('DELETE FROM sesiones_usuario WHERE id_usuario=?',{replacements:[id]});
    } else {
      await database.query("UPDATE usuarios SET correo=?,rol=? WHERE id=? AND rol<>'admin'", {replacements:[correo,rol,id]});
    }
    res.redirect('/usuarios?success=Usuario%20actualizado');
  } catch(e) {next(e);}
});
router.post('/:id/eliminar', async (req,res,next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1 || id === res.locals.currentUser.id_usuario) return display(res,'No puedes eliminar esta cuenta.', '',403);
    const [target] = await database.query<Row>('SELECT id,correo,rol FROM usuarios WHERE id=? LIMIT 1',{replacements:[id],type:QueryTypes.SELECT});
    if (!target) return display(res,'Usuario no encontrado.', '',404);
    if (target.rol === 'admin' || target.correo === adminEmail) return display(res,'No puedes eliminar a un administrador.', '',403);
    await database.query("DELETE FROM usuarios WHERE id=? AND rol<>'admin'",{replacements:[id]});
    res.redirect('/usuarios?success=Usuario%20eliminado');
  } catch(e) {next(e);}
});
export default router;
