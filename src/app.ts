import express from 'express';
import path from 'node:path';
import { rootDirectory } from './config';
import { database } from './infrastructure/database/connection';
import routes from './routes';
import { authMiddleware, login, logout } from './auth';
import userAdminRoutes from './user-admin';

export function createApplication() {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(rootDirectory, 'views'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(authMiddleware);
  app.get('/login', (_request, response) => response.render('login', { error: null }));
  app.post('/login', login);
  app.post('/logout', logout);
  app.use(express.static(path.join(rootDirectory, 'public')));
  app.use('/bootstrap', express.static(path.join(rootDirectory, 'node_modules/bootstrap/dist')));
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
  return app;
}
