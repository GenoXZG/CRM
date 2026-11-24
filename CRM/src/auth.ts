import { rotateCsrf } from './csrf';
import { authCookieValue, setAuthCookie } from './auth-cookies';
import { runAsAuditActor } from './infrastructure/audit/context';
import { requireActiveTechnician, technicianAccessProblem } from './domain/technician-access';
import { createChallenge, credentialHash, cleanupExpiredChallenges, challengeExists, completeChallenge, cancelChallenge, CHALLENGE_SECONDS } from './auth-challenge';
import { BusinessError } from './domain/business-error';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import type { Request, Response, NextFunction } from 'express';
import { QueryTypes } from 'sequelize';
import { database } from './infrastructure/database/connection';
import { configuration } from './config';
import { accountAtNetwork, authLimits, clientNetwork } from './rate-limit';

const scrypt = promisify(scryptCallback);
const SESSION_SECONDS = 60 * 60 * 12;
export type UserRole = 'admin' | 'coordinador' | 'tecnico';
export type SessionUser = { id_usuario: number; correo: string; rol: UserRole; id_tecnico: number | null; tecnico_estado: string | null };
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
export const emailFormat = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export async function passwordHash(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, salt, digest] = stored.split(':');
  if (algorithm !== 'scrypt' || !salt || !/^[a-f0-9]{32}$/.test(salt) || !digest || !/^[a-f0-9]{128}$/.test(digest)) return false;
  const expected = Buffer.from(digest, 'hex');
  const actual = await scrypt(password, salt, expected.length) as Buffer;
  return timingSafeEqual(expected, actual);
}
// Match the password cost even for an unknown account; never use this hash as a credential.
const dummyHash = `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`;

export async function initializeAuthentication() {
  // Schema changes are applied explicitly with npm run migrate, never at server startup.
  try {
    await database.query('SELECT rol,id_tecnico FROM usuarios LIMIT 0');
    await database.query('SELECT Fecha_cierre FROM Tickets LIMIT 0');
    await database.query('SELECT evento FROM ticket_historial LIMIT 0');
    await database.query('SELECT segundo_factor FROM sesiones_usuario LIMIT 0');
    await database.query('SELECT code_hash,credential_hash FROM desafios_login LIMIT 0');
    await database.query('SELECT code_hash,credential_hash FROM recuperaciones_password LIMIT 0');
  } catch (error) {
    if (error instanceof Error && error.name === 'SequelizeDatabaseError')
      throw new Error('El esquema de autenticación no está actualizado. Ejecuta npm run migrate antes de iniciar la aplicación.');
    throw error;
  }
  const [counts] = await database.query<{ total: number; admins: number }>("SELECT COUNT(*) AS total, COALESCE(SUM(rol='admin'),0) AS admins FROM usuarios", { type: QueryTypes.SELECT });
  if (Number(counts?.total) === 0) {
    const { adminEmail, adminPassword } = configuration.auth;
    if (!emailFormat.test(adminEmail) || adminEmail.length > 254 || adminPassword.length < 12 || adminPassword.length > 1024)
      throw new Error('Configura CRM_ADMIN_EMAIL y CRM_ADMIN_PASSWORD (12 a 1024 caracteres) para crear el primer administrador.');
    await database.query("INSERT INTO usuarios (correo,password_hash,rol) VALUES (?,?,'admin')", {
      replacements: [adminEmail, await passwordHash(adminPassword)],
    });
  } else if (!Number(counts?.admins)) {
    throw new Error('Existen usuarios pero ningún administrador. Asigna el rol admin de forma controlada antes de iniciar; las variables iniciales no cambian cuentas existentes.');
  }
  await cleanupExpiredChallenges();
  await database.query('DELETE FROM recuperaciones_password WHERE expira_en<=UTC_TIMESTAMP()');
  await database.query('DELETE FROM sesiones_usuario WHERE expira_en <= UTC_TIMESTAMP() OR segundo_factor=0');
}
export const sessionToken = (request: Request) => authCookieValue(request, 'crm_session');
const pendingToken = (request: Request) => authCookieValue(request, 'crm_pending');
function setPendingCookie(request: Request, response: Response, value: string, maxAge = CHALLENGE_SECONDS) {
  setAuthCookie(request, response, 'crm_pending', value, maxAge);
}
function setSessionCookie(request: Request, response: Response, value: string, maxAge = SESSION_SECONDS) {
  setAuthCookie(request, response, 'crm_session', value, maxAge);
}
const publicAsset = (path: string) => /^\/(css|js|assets|bootstrap|leaflet)\//.test(path) || path === '/favicon.ico';
function technicianAllowed(path: string, method: string): boolean {
  if (method === 'GET' || method === 'HEAD') return path === '/' || path === '/tickets' || path === '/estado_tickets' || path === '/tickets/exportar' || /^\/detalle_ticket\/\d+$/.test(path) || path.startsWith('/uploads/tickets/');
  return method === 'POST' && (path === '/logout' || path === '/tickets/resolver_ubicacion' || /^\/tickets\/finalizar\/\d+$/.test(path));
}
export async function authMiddleware(request: Request, response: Response, next: NextFunction) {
  try {
    response.locals.currentPath = request.path;
    response.locals.currentUser = null;
    response.locals.canManage = false;
    response.locals.isAdmin = false;
    response.locals.technicianScope = undefined;
    let path: string;
    try { path = decodeURIComponent(request.path).toLowerCase().replace(/\/+$/, '') || '/'; }
    catch { return response.status(400).json({ error: 'Ruta inválida.' }); }
    const method = request.method;
    if ((method === 'GET' || method === 'HEAD') && (publicAsset(path) || path === '/health')) return next();
    const token = sessionToken(request);
    if (token) {
      const [user] = await database.query<SessionUser>(
        `SELECT s.id_usuario, u.correo, u.rol,u.id_tecnico,t.Estatus_tecnico AS tecnico_estado FROM sesiones_usuario s JOIN usuarios u ON u.id=s.id_usuario LEFT JOIN Tecnicos t ON t.ID_Tecnico=u.id_tecnico
         WHERE s.token_hash=? AND s.expira_en>UTC_TIMESTAMP() AND s.segundo_factor=1 LIMIT 1`,
        { replacements: [sha(token)], type: QueryTypes.SELECT },
      );
      if (user && ['admin', 'coordinador', 'tecnico'].includes(user.rol)) {
        response.locals.currentUser = user;
        response.locals.canManage = user.rol !== 'tecnico';
        response.locals.isAdmin = user.rol === 'admin';
        if (user.rol === 'tecnico') response.locals.technicianScope = user.id_tecnico;
      }
    }
    if (['/login', '/login/verificar', '/login/cancelar', '/login/recuperar', '/login/recuperar/restablecer'].includes(path) && (method === 'GET' || method === 'POST')) {
      if (method === 'GET' && response.locals.currentUser && !path.startsWith('/login/recuperar')) return response.redirect('/');
      return next();
    }
    if (!response.locals.currentUser) {
      if (method === 'GET' && !path.startsWith('/api/') && !path.startsWith('/uploads/') && request.accepts('html')) return response.redirect('/login');
      return response.status(401).json({ error: 'Debes iniciar sesión.' });
    }
    const problem = technicianAccessProblem(response.locals.currentUser as SessionUser);
    if (problem && path !== '/logout') {
      if (method === 'GET' && request.accepts('html')) return response.status(403).render('account-unavailable', { problem });
      return response.status(403).json({ error: problem });
    }
    if (path.startsWith('/usuarios') && !response.locals.isAdmin)
      return response.status(403).json({ error: 'Acceso exclusivo para administradores.' });
    if (!response.locals.canManage && (!technicianAllowed(path, method) || (path === '/tickets' && request.query.setup === 'ticket')))
      return response.status(403).json({ error: 'Acceso denegado para técnico.' });
    runAsAuditActor(response.locals.currentUser as SessionUser, next);
  } catch (error) { next(error); }
}

function limitLogin(response: Response, retry: number) {
  response.setHeader('Retry-After', String(retry));
  return response.status(429).render('login', { error: 'Demasiados intentos. Espera antes de volver a intentarlo.' });
}

export async function login(request: Request, response: Response) {
  const network = clientNetwork(request.ip);
  const ipRetry = authLimits.loginIp.consume(network);
  if (ipRetry) return limitLogin(response, ipRetry);
  const correo = typeof request.body?.correo === 'string' ? request.body.correo.trim().toLowerCase() : '';
  const password = typeof request.body?.password === 'string' ? request.body.password : '';
  if (!emailFormat.test(correo) || correo.length > 254 || !password || password.length > 1024)
    return response.status(400).render('login', { error: 'Ingresa un correo y una contraseña válidos.' });
  const accountRetry = authLimits.loginAccountIp.consume(accountAtNetwork(network, correo));
  if (accountRetry) return limitLogin(response, accountRetry);
  try {
    const verified = await database.transaction(async transaction => {
      const [user] = await database.query<{ id: number; correo: string; rol: string; password_hash: string; id_tecnico: number | null; tecnico_estado: string | null }>('SELECT u.id,u.correo,u.rol,u.password_hash,u.id_tecnico,(SELECT Estatus_tecnico FROM Tecnicos WHERE ID_Tecnico=u.id_tecnico) AS tecnico_estado FROM usuarios u WHERE u.correo=? LIMIT 1 FOR UPDATE', { replacements: [correo], type: QueryTypes.SELECT, transaction });
      const matches = await verifyPassword(password, user?.password_hash ?? dummyHash);
      if (user && matches) requireActiveTechnician(user);
      return user && matches ? { id: user.id, fingerprint: credentialHash(user) } : null;
    });
    if (!verified) return response.status(401).render('login', { error: 'Correo o contraseña incorrectos.' });
    authLimits.loginAccountIp.reset(accountAtNetwork(network, correo));
    const pending = await createChallenge(verified.id, verified.fingerprint, sessionToken(request));
    setSessionCookie(request, response, '', 0);
    setPendingCookie(request, response, pending);
    rotateCsrf(request, response);
    return response.redirect('/login/verificar');
  } catch (error) {
    console.error('Login failed:', error instanceof Error ? error.name : 'unknown');
    const status = error instanceof BusinessError ? error.status : 500;
    return response.status(status).render('login', { error: error instanceof BusinessError ? error.message : 'Error al iniciar sesión.' });
  }
}
export async function showVerification(request: Request, response: Response, next: NextFunction) {
  try {
    const token = pendingToken(request);
    if (!token || !await challengeExists(token)) {
      if (token) {
        setPendingCookie(request, response, '', 0);
        rotateCsrf(request, response, { pending: null });
      }
      return response.redirect('/login');
    }
    return response.render('login-verification', { error: null });
  } catch (error) { next(error); }
}
export async function verifyLogin(request: Request, response: Response, next: NextFunction) {
  try {
    const token = pendingToken(request);
    const code = typeof request.body?.code === 'string' ? request.body.code.trim() : '';
    const session = randomBytes(32).toString('hex');
    const result = token ? await completeChallenge(token, code, session) : 'expired';
    if (result === 'invalid') return response.status(401).render('login-verification', { error: 'Código incorrecto. Revisa el correo e intenta nuevamente.' });
    if (result === 'expired') {
      setPendingCookie(request, response, '', 0);
      rotateCsrf(request, response, { pending: null });
      return response.status(401).render('login', { error: 'El código caducó, fue reemplazado o agotó sus intentos. Inicia sesión nuevamente.' });
    }
    setPendingCookie(request, response, '', 0);
    setSessionCookie(request, response, session);
    rotateCsrf(request, response);
    return response.redirect('/');
  } catch (error) { next(error); }
}
export async function cancelLogin(request: Request, response: Response, next: NextFunction) {
  try {
    const token = pendingToken(request);
    if (token) await cancelChallenge(token);
    setPendingCookie(request, response, '', 0);
    return response.redirect('/login');
  } catch (error) { next(error); }
}
export async function logout(request: Request, response: Response, next: NextFunction) {
  try {
    const token = sessionToken(request);
    if (token) await database.query('DELETE FROM sesiones_usuario WHERE token_hash=?', { replacements: [sha(token)] });
    setSessionCookie(request, response, '', 0);
    rotateCsrf(request, response, { session: null });
    response.redirect('/login');
  } catch (error) { next(error); }
}
