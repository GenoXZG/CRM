import type { Response } from 'express';
import { BusinessError, isRecord } from '../domain/business-error';
export function respondError(response: Response, error: unknown): Response {
  const constraintStatus: Record<string, number> = {
    SequelizeUniqueConstraintError: 409,
    SequelizeForeignKeyConstraintError: 400,
    SequelizeValidationError: 400,
  };
  const status =
    error instanceof BusinessError
      ? error.status
      : isRecord(error) && typeof error.name === 'string'
        ? constraintStatus[error.name] || 500
        : 500;
  if (status === 500) console.error(error);
  const message =
    error instanceof BusinessError
      ? error.message
      : status < 500
        ? 'Los datos incumplen una restricción'
        : 'Error interno del servidor';
  return response.status(status).json({ success: false, error: message });
}
