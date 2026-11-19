import { requireActiveTechnician, technicianAccessProblem } from './domain/technician-access';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { QueryTypes } from 'sequelize';
import { database } from './infrastructure/database/connection';
import { configuration } from './config';
import { BusinessError } from './domain/business-error';
import { sendEmail } from './services/email-service';

export const CHALLENGE_SECONDS = 300;
export const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
export const credentialHash = (user: { password_hash: string; correo: string; rol: string; id_tecnico: number | null }) => tokenHash(`${user.password_hash}|${user.correo}|${user.rol}|${user.id_tecnico ?? ""}`);
const codeHash = (token: string, code: string) => createHmac('sha256', token).update(code).digest('hex');
type Challenge = { token_hash: string; id_usuario: number; code_hash: string; credential_hash: string; intentos: number; enviado: number; vigente: number; espera: number };

export async function cleanupExpiredChallenges() {
  await database.query('DELETE FROM desafios_login WHERE expira_en<=UTC_TIMESTAMP()');
}
export async function createChallenge(userId: number, fingerprint: string, previous: string | null) {
  const token = randomBytes(32).toString('hex');
  const code = randomInt(0, 1000000).toString().padStart(6, '0');
  const recipient = await database.transaction(async transaction => {
    const [user] = await database.query<{ correo: string; password_hash: string; rol: string; id_tecnico: number | null; tecnico_estado: string | null }>('SELECT u.correo,u.password_hash,u.rol,u.id_tecnico,(SELECT Estatus_tecnico FROM Tecnicos WHERE ID_Tecnico=u.id_tecnico) AS tecnico_estado FROM usuarios u WHERE u.id=? FOR UPDATE', { replacements: [userId], type: QueryTypes.SELECT, transaction });
    if (!user || credentialHash(user) !== fingerprint) throw new BusinessError(401, 'La cuenta cambió. Inicia sesión nuevamente.');
    requireActiveTechnician(user);
    const [pending] = await database.query<Challenge>('SELECT TIMESTAMPDIFF(SECOND,creado_en,UTC_TIMESTAMP())<60 AS espera FROM desafios_login WHERE id_usuario=? FOR UPDATE', { replacements: [userId], type: QueryTypes.SELECT, transaction });
    if (pending?.espera) throw new BusinessError(429, 'Espera un minuto antes de solicitar otro código.');
    await database.query('DELETE FROM desafios_login WHERE id_usuario=?', { replacements: [userId], transaction });
    await database.query('INSERT INTO desafios_login (token_hash,id_usuario,code_hash,credential_hash,creado_en,expira_en) VALUES (?,?,?,?,UTC_TIMESTAMP(),DATE_ADD(UTC_TIMESTAMP(),INTERVAL 5 MINUTE))', { replacements: [tokenHash(token), userId, codeHash(token, code), fingerprint], transaction });
    // A new login must not retain a previous fully authenticated browser session.
    if (previous) await database.query('DELETE FROM sesiones_usuario WHERE token_hash=?', { replacements: [tokenHash(previous)], transaction });
    return { to: configuration.auth.twoFactorTo || user.correo, account: user.correo };
  });
  try {
    await sendEmail(recipient.to, 'Código de acceso · CRM TSV', `Se solicitó iniciar sesión en CRM TSV con la cuenta ${recipient.account}.\n\nTu código es: ${code}\n\nCaduca en 5 minutos y solo puede usarse una vez. Si no solicitaste este acceso, ignora el correo.`);
    await database.query('UPDATE desafios_login SET enviado=1 WHERE token_hash=?', { replacements: [tokenHash(token)] });
  } catch (error) {
    await database.query('DELETE FROM desafios_login WHERE token_hash=?', { replacements: [tokenHash(token)] });
    throw error;
  }
  return token;
}
export async function challengeExists(token: string) {
  const [row] = await database.query<{ found: number }>('SELECT 1 AS found FROM desafios_login WHERE token_hash=? AND enviado=1 AND intentos<5 AND expira_en>UTC_TIMESTAMP()', { replacements: [tokenHash(token)], type: QueryTypes.SELECT });
  return Boolean(row);
}
export async function cancelChallenge(token: string) {
  await database.query('DELETE FROM desafios_login WHERE token_hash=?', { replacements: [tokenHash(token)] });
}
export async function completeChallenge(token: string, code: string, session: string): Promise<'ok' | 'invalid' | 'expired'> {
  const [lookup] = await database.query<{ id_usuario: number }>('SELECT id_usuario FROM desafios_login WHERE token_hash=?', { replacements: [tokenHash(token)], type: QueryTypes.SELECT });
  if (!lookup) return 'expired';
  return database.transaction(async transaction => {
    // Same lock order as login and account administration: user first, challenge second.
    const [user] = await database.query<{ correo: string; password_hash: string; rol: string; id_tecnico: number | null; tecnico_estado: string | null }>('SELECT u.correo,u.password_hash,u.rol,u.id_tecnico,(SELECT Estatus_tecnico FROM Tecnicos WHERE ID_Tecnico=u.id_tecnico) AS tecnico_estado FROM usuarios u WHERE u.id=? FOR UPDATE', { replacements: [lookup.id_usuario], type: QueryTypes.SELECT, transaction });
    const [row] = await database.query<Challenge>('SELECT *,expira_en>UTC_TIMESTAMP() AS vigente FROM desafios_login WHERE token_hash=? FOR UPDATE', { replacements: [tokenHash(token)], type: QueryTypes.SELECT, transaction });
    if (!user || technicianAccessProblem(user) || !row || !row.enviado || !row.vigente || row.intentos>=5 || row.credential_hash !== credentialHash(user)) {
      if (row) await database.query('DELETE FROM desafios_login WHERE token_hash=?', { replacements: [tokenHash(token)], transaction });
      return 'expired';
    }
    const matches = /^\d{6}$/.test(code) && timingSafeEqual(Buffer.from(row.code_hash, 'hex'), Buffer.from(codeHash(token, code), 'hex'));
    if (!matches) {
      await database.query('UPDATE desafios_login SET intentos=intentos+1 WHERE token_hash=?', { replacements: [tokenHash(token)], transaction });
      return row.intentos >= 4 ? 'expired' : 'invalid';
    }
    await database.query('DELETE FROM desafios_login WHERE token_hash=?', { replacements: [tokenHash(token)], transaction });
    // Rotate the token: possession of the pending cookie must never be a full session.
    await database.query('INSERT INTO sesiones_usuario (token_hash,id_usuario,expira_en,segundo_factor) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 12 HOUR),1)', { replacements: [tokenHash(session), lookup.id_usuario], transaction });
    return 'ok';
  });
}
