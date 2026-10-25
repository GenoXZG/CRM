import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import type { Request, Response, NextFunction } from 'express';
import { QueryTypes } from 'sequelize';
import { database } from './infrastructure/database/connection';

const scrypt = promisify(scryptCallback);
const SESSION_SECONDS = 60 * 60 * 12;
type User = { id: number; correo: string; password_hash: string };
type Session = { id_usuario: number; correo: string; rol: 'admin' | 'coordinador' | 'tecnico' };
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const emailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function passwordHash(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, salt, digest] = stored.split(':');
  if (algorithm !== 'scrypt' || !salt || !digest || !/^[a-f0-9]{128}$/.test(digest)) return false;
  const expected = Buffer.from(digest, 'hex');
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return timingSafeEqual(expected, actual);
}
export async function initializeAuthentication() {
  await database.query(`CREATE TABLE IF NOT EXISTS usuarios (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    correo VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol ENUM('admin','coordinador','tecnico') NOT NULL DEFAULT 'coordinador',
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await database.query(`CREATE TABLE IF NOT EXISTS sesiones_usuario (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    id_usuario INT NOT NULL,
    expira_en DATETIME NOT NULL,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX (expira_en)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  // Migración segura para bases existentes: no borra cuentas ni tickets.
  const columns = await database.query<{Field: string}>("SHOW COLUMNS FROM usuarios LIKE 'rol'", { type: QueryTypes.SELECT });
  if (!columns.length) {
    await database.query("ALTER TABLE usuarios ADD COLUMN rol ENUM('admin','coordinador','tecnico') NOT NULL DEFAULT 'coordinador'");
  }
  await database.query("ALTER TABLE usuarios MODIFY COLUMN rol ENUM('admin','usuario','coordinador','tecnico') NOT NULL DEFAULT 'tecnico'");
  await database.query("UPDATE usuarios SET rol='coordinador' WHERE rol='usuario'");
  await database.query("ALTER TABLE usuarios MODIFY COLUMN rol ENUM('admin','coordinador','tecnico') NOT NULL DEFAULT 'tecnico'");
  // Solo la cuenta principal definida al desplegar puede tener privilegios de administrador.
  const adminEmail = 'admin@gmail.com';
  await database.query("UPDATE usuarios SET rol='coordinador' WHERE rol='admin' AND correo<>?", {replacements:[adminEmail]});
  await database.query("UPDATE usuarios SET rol='admin' WHERE correo=?", {replacements:[adminEmail]});
  const [counts] = await database.query<{ total: number }>('SELECT COUNT(*) AS total FROM usuarios', { type: QueryTypes.SELECT });
  if (Number(counts?.total) === 0) {
    const correo = process.env.CRM_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.CRM_ADMIN_PASSWORD;
    if (!correo || !emailFormat.test(correo) || !password || password.length < 12) {
      throw new Error('No hay usuarios. Configura CRM_ADMIN_EMAIL y CRM_ADMIN_PASSWORD (minimo 12 caracteres) en .env para crear el primer usuario.');
    }
    await database.query('INSERT INTO usuarios (correo, password_hash, rol) VALUES (?, ?, ?)', {
      replacements: [correo, await passwordHash(password), correo === 'admin@gmail.com' ? 'admin' : 'coordinador'],
    });
    console.log(`Usuario inicial creado: ${correo}`);
  }
  await database.query('DELETE FROM sesiones_usuario WHERE expira_en < NOW()');
}
function cookies(request: Request): Record<string, string> {
  const result: Record<string, string> = {};
  for (const item of (request.headers.cookie ?? '').split(';')) {
    const pos = item.indexOf('=');
    if (pos > 0) result[item.slice(0, pos).trim()] = item.slice(pos + 1).trim();
  }
  return result;
}
function cookieOptions(request: Request): string {
  const secure = request.secure || process.env.COOKIE_SECURE === 'true';
  return `HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}${secure ? '; Secure' : ''}`;
}
function authCookie(request: Request, response: Response, value: string) {
  response.setHeader('Set-Cookie', `crm_session=${value}; ${cookieOptions(request)}`);
}
function token(request: Request) {
  const value = cookies(request).crm_session;
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

function technicianAllowed(path: string, method: string): boolean {
  if (method === 'GET') return path === '/' || path === '/tickets' || path === '/estado_tickets' || /^\/detalle_ticket\/\d+$/.test(path) || path.startsWith('/css/') || path.startsWith('/js/') || path.startsWith('/assets/') || path.startsWith('/bootstrap/') || path.startsWith('/uploads/') || path.startsWith('/images/') || path.startsWith('/img/') || path === '/favicon.ico' || path === '/health';
  if (method === 'POST') return path === '/logout' || /^\/tickets\/finalizar\/\d+$/.test(path);
  return false;
}

export async function authMiddleware(request: Request, response: Response, next: NextFunction) {
  try {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'same-origin');
    const currentToken = token(request);
    if (currentToken) {
      const [session] = await database.query<Session>(
        `SELECT s.id_usuario, u.correo, u.rol FROM sesiones_usuario s JOIN usuarios u ON u.id=s.id_usuario
         WHERE s.token_hash=? AND s.expira_en>NOW() LIMIT 1`,
        { replacements: [sha(currentToken)], type: QueryTypes.SELECT },
      );
      if (session) response.locals.currentUser = session;
    }
    if (request.path === '/login') {
      if (request.method === 'POST') {
        const origin = request.get('origin');
        const referer = request.get('referer');
        const source = origin ?? (referer ? new URL(referer).origin : undefined);
        if (source && new URL(source).host !== request.get('host')) return response.status(403).send('Origen no permitido');
      }
      if (request.method === 'GET' && response.locals.currentUser) return response.redirect('/');
      return next();
    }
    if (request.path === '/health' && request.method === 'GET') return next();
    if (request.path.startsWith('/css/') || request.path.startsWith('/bootstrap/')) return next();
    if (!response.locals.currentUser) {
      if (request.method === 'GET' && !request.path.startsWith('/api/') && request.accepts('html'))
        return response.redirect('/login');
      return response.status(401).json({ error: 'Debes iniciar sesión.' });
    }
    
    if (response.locals.currentUser.rol === 'tecnico' && !technicianAllowed(request.path, request.method)) return response.status(403).send('Acceso denegado para técnico.');
    if (request.path.startsWith('/usuarios') && response.locals.currentUser.rol !== 'admin') return response.status(403).send('Acceso denegado: solo administradores.');
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const origin = request.get('origin');
      const referer = request.get('referer');
      const originToCheck = origin ?? (referer ? new URL(referer).origin : undefined);
      if (originToCheck) {
        const host = request.get('host');
        if (!host || new URL(originToCheck).host !== host) return response.status(403).send('Origen no permitido');
      }
    }
    next();
  } catch (error) { next(error); }
}
export async function login(request: Request, response: Response) {
  const correo = String(request.body?.correo ?? '').trim().toLowerCase();
  const password = String(request.body?.password ?? '');
  if (!emailFormat.test(correo) || password.length > 1024 || !password) {
    return response.status(400).render('login', { error: 'Ingresa un correo y una contraseña válidos.' });
  }
  try {
    const [user] = await database.query<User>(
      'SELECT id, correo, password_hash FROM usuarios WHERE correo=? LIMIT 1',
      { replacements: [correo], type: QueryTypes.SELECT },
    );
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return response.status(401).render('login', { error: 'Correo o contraseña incorrectos.' });
    }
    const value = randomBytes(32).toString('hex');
    await database.query('INSERT INTO sesiones_usuario (token_hash, id_usuario, expira_en) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 12 HOUR))', {
      replacements: [sha(value), user.id],
    });
    authCookie(request, response, value);
    return response.redirect('/');
  } catch (error) { console.error('Login failed', error); return response.status(500).render('login', { error: 'Error al iniciar sesión.' }); }
}
export async function logout(request: Request, response: Response) {
  const currentToken = token(request);
  if (currentToken) await database.query('DELETE FROM sesiones_usuario WHERE token_hash=?', { replacements: [sha(currentToken)] });
  response.setHeader('Set-Cookie', 'crm_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  response.redirect('/login');
}
