import { showRecovery, showReset, sendRecovery, completeRecovery } from './controllers/password-recovery-controller';
import express from 'express';
import path from 'node:path';
import { configuration, rootDirectory } from './config';
import { database } from './infrastructure/database/connection';
import routes from './routes';
import { authMiddleware, login, logout, showVerification, verifyLogin, cancelLogin } from './auth';
import userAdminRoutes from './user-admin';

export function createApplication() {
  const app = express();
  app.set('case sensitive routing', true);
  app.locals.mapTiles = configuration.maps;
  app.set('view engine', 'ejs');
  app.set('views', path.join(rootDirectory, 'views'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(authMiddleware);
  app.get('/login', (_request, response) => response.render('login', { error: null }));
  app.post('/login', login);
  app.get('/login/recuperar', showRecovery);
  app.post('/login/recuperar', sendRecovery);
  app.get('/login/recuperar/restablecer', showReset);
  app.post('/login/recuperar/restablecer', completeRecovery);
  app.get('/login/verificar', showVerification);
  app.post('/login/verificar', verifyLogin);
  app.post('/login/cancelar', cancelLogin);
  app.post('/logout', logout);
  app.use(express.static(path.join(rootDirectory, 'public')));
  app.use('/bootstrap', express.static(path.join(rootDirectory, 'node_modules/bootstrap/dist')));
  app.use('/leaflet', express.static(path.join(rootDirectory, 'node_modules/leaflet/dist')));
  app.get('/health', async (_request, response) => {
    try {
      await database.authenticate();
      response.json({ status: 'ok' });
    } catch {
      response.status(503).json({ status: 'unavailable' });
    }
  });
  app.use('/usuarios', userAdminRoutes);
  app.use('/', routes);
  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error('Request failed:', error instanceof Error ? error.name : 'unknown');
    response.status(500).json({ success: false, error: 'Error interno del servidor' });
  });
  return app;
}
