import path from 'node:path';
import { isIP } from 'node:net';
import dotenv from 'dotenv';

export const rootDirectory = path.resolve(__dirname, '..');
if (process.env.NODE_ENV !== 'test')
  dotenv.config({ path: path.join(rootDirectory, '.env'), quiet: true });

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}
function port(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65535)
    throw new Error(`Invalid port: ${name}`);
  return value;
}
const deployment = process.env.CRM_DEPLOYMENT ?? 'local';
if (deployment !== 'local' && deployment !== 'test' && deployment !== 'public')
  throw new Error('Invalid CRM_DEPLOYMENT: expected local, test or public');

const trustedProxyIp = process.env.TRUSTED_PROXY_IP?.trim() || '';
if (trustedProxyIp && (!isIP(trustedProxyIp) || trustedProxyIp.includes('%')))
  throw new Error('Invalid TRUSTED_PROXY_IP: expected one literal IP address');
if (deployment === 'public' && !trustedProxyIp)
  throw new Error('TRUSTED_PROXY_IP is required for CRM_DEPLOYMENT=public');

const testCodeRecipient = process.env.AUTH_2FA_TO?.trim() || '';
if (testCodeRecipient && deployment !== 'test')
  throw new Error('AUTH_2FA_TO requires CRM_DEPLOYMENT=test');

const cspMode = process.env.CSP_MODE || (deployment === 'public' ? 'enforce' : 'report-only');
if (cspMode !== 'report-only' && cspMode !== 'enforce') throw new Error('Invalid CSP_MODE');
const tileUrl = process.env.MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const tileSource = new URL(tileUrl.replaceAll('{s}', 'tile'));
if (!['http:', 'https:'].includes(tileSource.protocol) || tileSource.username || tileSource.password)
  throw new Error('Invalid MAP_TILE_URL');
const tileOrigin = tileUrl.includes('{s}') && new URL(tileUrl).hostname.startsWith('{s}.')
  ? tileSource.origin.replace('://tile.', '://*.') : tileSource.origin;
const evidenceSetting = process.env.EVIDENCE_ROOT?.trim();
const evidenceRoot = path.resolve(rootDirectory, evidenceSetting || 'evidence');
const fromPublic = path.relative(path.join(rootDirectory, 'public'), evidenceRoot);
if (!fromPublic || (!path.isAbsolute(fromPublic) && !fromPublic.startsWith('..' + path.sep) && fromPublic !== '..'))
  throw new Error('EVIDENCE_ROOT must be outside public');

const evidenceMinimumFreeMiB = Number(process.env.EVIDENCE_MIN_FREE_MIB || '128');
if (!Number.isSafeInteger(evidenceMinimumFreeMiB) || evidenceMinimumFreeMiB < 0)
  throw new Error('Invalid EVIDENCE_MIN_FREE_MIB');

export const configuration = {
  trustedProxyIp,
  deployment,
  cspMode,
  evidenceRoot,
  evidenceMinimumFreeMiB,
  usesMountedEvidence: Boolean(evidenceSetting),
  auth: {
    adminEmail: (process.env.CRM_ADMIN_EMAIL || '').trim().toLowerCase(),
    adminPassword: process.env.CRM_ADMIN_PASSWORD || '',
    cookieSecure: deployment === 'public' || process.env.COOKIE_SECURE === 'true',
    testCodeRecipient,
  },
  email: {
    gmailUser: process.env.GMAIL_USER || '',
    gmailAppPassword: (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, ''),
    testTo: process.env.MAIL_TEST_TO || '',
  },
  maps: {
    tileUrl,
    tileOrigin,
    attribution: process.env.MAP_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  port: port('PORT', 3030),
  database: {
    name: requiredEnvironment('DB_NAME'),
    user: requiredEnvironment('DB_USER'),
    password: process.env.DB_PASSWORD ?? '',
    host: process.env.DB_HOST || 'localhost',
    port: port('DB_PORT', 3306),
  },
};
