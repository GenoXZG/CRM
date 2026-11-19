import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { QueryTypes } from 'sequelize';
import { database } from '../infrastructure/database/connection';
import { credentialHash, tokenHash } from '../auth-challenge';
import { passwordHash } from '../auth';
import { configuration } from '../config';
import { sendEmail } from './email-service';

type User = { id: number; correo: string; password_hash: string; rol: string; id_tecnico: number | null };
type Recovery = { id_usuario: number; code_hash: string; credential_hash: string; intentos: number; enviado: number; vigente: number };
const hashCode = (token: string, code: string) => createHmac('sha256', token).update('password-recovery:' + code).digest('hex');

export async function requestPasswordRecovery(email: string, previousToken?: string | null): Promise<string> {
  // Unknown accounts receive an indistinguishable browser token, never a database row.
  const token = randomBytes(32).toString('hex');
  const code = randomInt(0, 1000000).toString().padStart(6, '0');
  const user = await database.transaction(async transaction => {
    const [user] = await database.query<User>('SELECT id,correo,password_hash,rol,id_tecnico FROM usuarios WHERE correo=? FOR UPDATE', { replacements: [email], type: QueryTypes.SELECT, transaction });
    if (!user) return null;
    const [pending] = await database.query<{ espera: number; token_hash: string }>('SELECT token_hash,TIMESTAMPDIFF(SECOND,creado_en,UTC_TIMESTAMP())<60 AS espera FROM recuperaciones_password WHERE id_usuario=? FOR UPDATE', { replacements: [user.id], type: QueryTypes.SELECT, transaction });
    if (pending?.espera) return previousToken && tokenHash(previousToken) === pending.token_hash ? previousToken : null;
    await database.query('DELETE FROM recuperaciones_password WHERE id_usuario=?', { replacements: [user.id], transaction });
    await database.query('INSERT INTO recuperaciones_password(token_hash,id_usuario,code_hash,credential_hash,creado_en,expira_en) VALUES(?,?,?,?,UTC_TIMESTAMP(),DATE_ADD(UTC_TIMESTAMP(),INTERVAL 10 MINUTE))', { replacements: [tokenHash(token), user.id, hashCode(token, code), credentialHash(user)], transaction });
    return user;
  });
  // A repeated request in the same browser keeps its still-valid code during cooldown.
  if (typeof user === 'string') return user;
  if (user) {
    try {
      await sendEmail(configuration.auth.twoFactorTo || user.correo, 'Recuperar contraseña · CRM TSV', `Se solicitó recuperar la contraseña en CRM TSV con la cuenta ${user.correo}.\n\nTu código es: ${code}\n\nCaduca en 10 minutos y solo puede usarse una vez para cambiar la contraseña. Este código no es un código de acceso. Si no lo solicitaste, ignora el correo; tu contraseña no cambiará.`);
      await database.query('UPDATE recuperaciones_password SET enviado=1 WHERE token_hash=?', { replacements: [tokenHash(token)] });
    } catch (error) {
      await database.query('DELETE FROM recuperaciones_password WHERE token_hash=?', { replacements: [tokenHash(token)] });
      // Do not disclose whether an account exists through a provider error.
      console.error('Recovery email failed:', error instanceof Error ? error.name : 'unknown');
    }
  }
  return token;
}

export async function resetPassword(token: string, code: string, password: string): Promise<'ok' | 'invalid' | 'expired'> {
  const [lookup] = await database.query<{ id_usuario: number }>('SELECT id_usuario FROM recuperaciones_password WHERE token_hash=?', { replacements: [tokenHash(token)], type: QueryTypes.SELECT });
  if (!lookup) return 'expired';
  // Hash before acquiring locks. The credential fingerprint is rechecked under lock.
  const hash = await passwordHash(password);
  return database.transaction(async transaction => {
    const [user] = await database.query<User>('SELECT id,correo,password_hash,rol,id_tecnico FROM usuarios WHERE id=? FOR UPDATE', { replacements: [lookup.id_usuario], type: QueryTypes.SELECT, transaction });
    const [row] = await database.query<Recovery>('SELECT *,expira_en>UTC_TIMESTAMP() AS vigente FROM recuperaciones_password WHERE token_hash=? FOR UPDATE', { replacements: [tokenHash(token)], type: QueryTypes.SELECT, transaction });
    if (!user || !row || !row.enviado || !row.vigente || row.intentos >= 5 || row.credential_hash !== credentialHash(user)) {
      if (row) await database.query('DELETE FROM recuperaciones_password WHERE token_hash=?', { replacements: [tokenHash(token)], transaction });
      return 'expired';
    }
    if (!/^\d{6}$/.test(code) || !timingSafeEqual(Buffer.from(row.code_hash, 'hex'), Buffer.from(hashCode(token, code), 'hex'))) {
      await database.query('UPDATE recuperaciones_password SET intentos=intentos+1 WHERE token_hash=?', { replacements: [tokenHash(token)], transaction });
      return row.intentos >= 4 ? 'expired' : 'invalid';
    }
    await database.query('UPDATE usuarios SET password_hash=? WHERE id=?', { replacements: [hash, user.id], transaction });
    await database.query('DELETE FROM sesiones_usuario WHERE id_usuario=?', { replacements: [user.id], transaction });
    await database.query('DELETE FROM desafios_login WHERE id_usuario=?', { replacements: [user.id], transaction });
    await database.query('DELETE FROM recuperaciones_password WHERE id_usuario=?', { replacements: [user.id], transaction });
    return 'ok';
  });
}
