import { Readable } from 'node:stream';
import { raw, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { assertCsrf } from '../csrf';
import { BusinessError } from '../domain/business-error';
import { maxFileBytes, maxFiles, maxMultipartBytes } from '../services/ticket-evidence';
import { uploadPhotos } from '../controllers/ticket-controller';

const payloads = new WeakMap<Request, Buffer>();
const verified = new WeakSet<Request>();
const readBody = raw({ type: 'multipart/form-data', inflate: false, limit: maxMultipartBytes });
const options = {
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileBytes, files: maxFiles, fields: 2, parts: maxFiles + 2, fieldSize: 4096, fieldNameSize: 32, fieldNestingDepth: 0 },
  fileFilter(request: Request, _file: Express.Multer.File, callback: multer.FileFilterCallback) {
    try {
      if (!verified.has(request)) {
        assertCsrf(request, request.res!);
        verified.add(request);
      }
      callback(null, true);
    } catch (error) { callback(error as Error); }
  },
  streamHandler(request: Request, parser: NodeJS.WritableStream) {
    const payload = payloads.get(request)!;
    payloads.delete(request);
    Readable.from([payload]).pipe(parser);
  },
};
const parse = multer(options).array('fotos', maxFiles);

let activeUploads = 0;
export async function receiveEvidence(request: Request<Record<string, string>>, response: Response, next: NextFunction) {
  if (!request.is('multipart/form-data')) return next(new BusinessError(415, 'Se requiere un formulario multipart.'));
  if (activeUploads >= 2) {
    response.set('Retry-After', '5');
    return next(new BusinessError(503, 'Hay cargas en curso. Intenta nuevamente.'));
  }
  activeUploads++;
  try {
    if (request.get('x-csrf-token') !== undefined) {
      assertCsrf(request, response);
      verified.add(request);
    }
    await new Promise<void>((resolve, reject) => readBody(request, response, error => error ? reject(error) : resolve()));
    payloads.set(request, request.body);
    try {
      await new Promise<void>((resolve, reject) => parse(request, response, error => error ? reject(error) : resolve()));
    } catch (error) {
      if (error instanceof BusinessError) throw error;
      if (error instanceof multer.MulterError && error.code.startsWith('LIMIT_') && error.code !== 'LIMIT_UNEXPECTED_FILE')
        throw new BusinessError(413, 'La carga excede los límites del formulario.');
      throw new BusinessError(400, 'Formulario multipart inválido.');
    }
    if (!verified.has(request)) assertCsrf(request, response);
    if (!Array.isArray(request.files) || !request.files.length)
      throw new BusinessError(400, 'Selecciona al menos una imagen.');
    await uploadPhotos(request, response);
  } catch (error) {
    next(error);
  } finally {
    payloads.delete(request);
    activeUploads--;
  }
}
