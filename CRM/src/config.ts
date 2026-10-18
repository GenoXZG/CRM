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
  port: port('PORT', 3030),
  database: {
    name: requiredEnvironment('DB_NAME'),
    user: requiredEnvironment('DB_USER'),
    password: process.env.DB_PASSWORD ?? '',
    host: process.env.DB_HOST || 'localhost',
    port: port('DB_PORT', 3306),
  },
};
