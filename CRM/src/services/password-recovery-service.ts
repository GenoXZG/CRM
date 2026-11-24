import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { QueryTypes } from 'sequelize';
import { database } from '../infrastructure/database/connection';
import { credentialHash, tokenHash } from '../auth-challenge';
import { passwordHash } from '../auth';
import { configuration } from '../config';
import { sendEmail } from './email-service';

type User = { id: number; correo: string; password_hash: string; rol: string; id_tecnico: number | null };
type Recovery = { id_usuario: number; code_hash: string; credential_hash: string; intentos: number; enviado: number; vigente: number };
const hashCode = (token: string, code: string) => createHmac('sha256', token).update('password-recovery:' + code).digest('hex');

const maxOutstandingDeliveries = 32;
const maxConcurrentDeliveries = 4;
let outstandingDeliveries = 0;
let activeDeliveries = 0;
const deliveryQueue: Array<() => Promise<void>> = [];

const deliveryEvents = {
  saturated: { count: 0, lastLog: -Infinity },
  failed: { count: 0, lastLog: -Infinity },
};

function recordDeliveryEvent(event: keyof typeof deliveryEvents) {
  const metric = deliveryEvents[event];
  metric.count++;
  const now = performance.now();
  if (now - metric.lastLog < 60_000) return;
  metric.lastLog = now;
  console.warn('password_recovery_delivery', { event, total: metric.count, outstanding: outstandingDeliveries });
}

function deliverNext() {
  if (activeDeliveries >= maxConcurrentDeliveries) return;
  const deliver = deliveryQueue.shift();
  if (!deliver) return;
  activeDeliveries++;
  void deliver().catch(() => {
    // Keep an undelivered challenge disabled while the per-account cooldown runs.
    recordDeliveryEvent('failed');
  }).finally(() => {
    activeDeliveries--;
    outstandingDeliveries--;
    deliverNext();
  });
}

async function deliverRecovery(email: string, hashedToken: string, code: string) {
  const [pending] = await database.query<{ found: number }>(
    'SELECT 1 AS found FROM recuperaciones_password WHERE token_hash=? AND expira_en>UTC_TIMESTAMP()',
    { replacements: [hashedToken], type: QueryTypes.SELECT },
  );
  if (!pending) return;
  await sendEmail(configuration.auth.testCodeRecipient || email, 'Recuperar contraseña · CRM TSV', `Se solicitó recuperar la contraseña en CRM TSV con la cuenta ${email}.\n\nTu código es: ${code}\n\nCaduca en 10 minutos y solo puede usarse una vez para cambiar la contraseña. Este código no es un código de acceso. Si no lo solicitaste, ignora el correo; tu contraseña no cambiará.`);
  await database.query('UPDATE recuperaciones_password SET enviado=1 WHERE token_hash=?', { replacements: [hashedToken] });
}

export async function requestPasswordRecovery(email: string, previousToken?: string | null): Promise<string> {
  const token = randomBytes(32).toString('hex');
  if (outstandingDeliveries >= maxOutstandingDeliveries) {
    recordDeliveryEvent('saturated');
    return previousToken || token;
  }
  outstandingDeliveries++;
  let scheduled = false;
  try {
    const code = randomInt(0, 1000000).toString().padStart(6, '0');
    const hashedToken = tokenHash(token);
    const result = await database.transaction(async transaction => {
      const [user] = await database.query<User>('SELECT id,correo,password_hash,rol,id_tecnico FROM usuarios WHERE correo=? FOR UPDATE', { replacements: [email], type: QueryTypes.SELECT, transaction });
      if (!user) return { token };
      const [pending] = await database.query<{ espera: number; token_hash: string }>('SELECT token_hash,TIMESTAMPDIFF(SECOND,creado_en,UTC_TIMESTAMP())<60 AS espera FROM recuperaciones_password WHERE id_usuario=? FOR UPDATE', { replacements: [user.id], type: QueryTypes.SELECT, transaction });
      if (pending?.espera) return { token: previousToken && tokenHash(previousToken) === pending.token_hash ? previousToken : token };
      await database.query('DELETE FROM recuperaciones_password WHERE id_usuario=?', { replacements: [user.id], transaction });
      await database.query('INSERT INTO recuperaciones_password(token_hash,id_usuario,code_hash,credential_hash,creado_en,expira_en) VALUES(?,?,?,?,UTC_TIMESTAMP(),DATE_ADD(UTC_TIMESTAMP(),INTERVAL 10 MINUTE))', { replacements: [hashedToken, user.id, hashCode(token, code), credentialHash(user)], transaction });
      return { token, email: user.correo };
    });
    if (result.email) {
      const recipient = result.email;
      deliveryQueue.push(() => deliverRecovery(recipient, hashedToken, code));
      scheduled = true;
      setImmediate(deliverNext);
    }
    return result.token;
  } finally {
    if (!scheduled) outstandingDeliveries--;
  }
}

export async function resetPassword(token: string, code: string, password: string): Promise<'ok' | 'invalid' | 'expired'> {
  const hashedToken = tokenHash(token);
  const [lookup] = await database.query<{ id_usuario: number }>('SELECT id_usuario FROM recuperaciones_password WHERE token_hash=?', { replacements: [hashedToken], type: QueryTypes.SELECT });
  if (!lookup) return 'expired';
  return database.transaction(async transaction => {
    const [user] = await database.query<User>('SELECT id,correo,password_hash,rol,id_tecnico FROM usuarios WHERE id=? FOR UPDATE', { replacements: [lookup.id_usuario], type: QueryTypes.SELECT, transaction });
    const [row] = await database.query<Recovery>('SELECT *,expira_en>UTC_TIMESTAMP() AS vigente FROM recuperaciones_password WHERE token_hash=? FOR UPDATE', { replacements: [hashedToken], type: QueryTypes.SELECT, transaction });
    if (!user || !row || !row.vigente || row.intentos >= 5 || row.credential_hash !== credentialHash(user)) {
      if (row) await database.query('DELETE FROM recuperaciones_password WHERE token_hash=?', { replacements: [hashedToken], transaction });
      return 'expired';
    }
    if (!row.enviado) return 'expired';
    if (!/^\d{6}$/.test(code) || !timingSafeEqual(Buffer.from(row.code_hash, 'hex'), Buffer.from(hashCode(token, code), 'hex'))) {
      await database.query('UPDATE recuperaciones_password SET intentos=intentos+1 WHERE token_hash=?', { replacements: [hashedToken], transaction });
      return row.intentos >= 4 ? 'expired' : 'invalid';
    }
    // Only a live, correct code reaches scrypt. Keep the row locked until it is consumed.
    const hash = await passwordHash(password);
    await database.query('UPDATE usuarios SET password_hash=? WHERE id=?', { replacements: [hash, user.id], transaction });
    await database.query('DELETE FROM sesiones_usuario WHERE id_usuario=?', { replacements: [user.id], transaction });
    await database.query('DELETE FROM desafios_login WHERE id_usuario=?', { replacements: [user.id], transaction });
    await database.query('DELETE FROM recuperaciones_password WHERE id_usuario=?', { replacements: [user.id], transaction });
    return 'ok';
  });
}
