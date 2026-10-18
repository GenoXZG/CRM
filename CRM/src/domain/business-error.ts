export class BusinessError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'BusinessError';
  }
}
export function positiveInteger(value: unknown, field: string): number {
  if (!(typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value.trim())))) {
    throw new BusinessError(400, `${field} debe ser un entero positivo`);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0 || number > 2147483647) {
    throw new BusinessError(400, `${field} debe ser un entero positivo`);
  }
  return number;
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function nullableText(value: unknown, field: string, maxLength?: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || (maxLength !== undefined && value.length > maxLength)) {
    throw new BusinessError(400, `${field} inválido`);
  }
  return value;
}
