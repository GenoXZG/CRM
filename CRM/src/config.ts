import path from 'node:path';
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
export const configuration = {
  auth: {
    adminEmail: (process.env.CRM_ADMIN_EMAIL || '').trim().toLowerCase(),
    adminPassword: process.env.CRM_ADMIN_PASSWORD || '',
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    twoFactorTo: process.env.AUTH_2FA_TO || '',
  },
  email: {
    provider: process.env.EMAIL_PROVIDER || 'resend',
    gmailUser: process.env.GMAIL_USER || '',
    gmailAppPassword: (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, ''),
    testTo: process.env.MAIL_TEST_TO || process.env.RESEND_TEST_TO || '',
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.RESEND_FROM || 'CRM TSV <onboarding@resend.dev>',
    testTo: process.env.RESEND_TEST_TO || '',
  },
  maps: {
    tileUrl: process.env.MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
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
