import path from 'node:path';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import morgan from 'morgan';
import { env } from './config/env.js';
import { query } from './db/pool.js';
import { requireUser } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { UPLOAD_ROOT } from './middleware/upload.js';
import adminRoutes from './routes/admin/index.js';
import authRoutes from './routes/auth.routes.js';
import chatRoutes from './routes/chat.routes.js';
import fundraiserRoutes from './routes/fundraisers.routes.js';
import meRoutes from './routes/me.routes.js';
import postRoutes from './routes/posts.routes.js';
import sosRoutes from './routes/sos.routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.trustProxy);

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], imgSrc: ["'self'", 'data:'], frameAncestors: ["'none'"] } },
  }));
  app.use(cors({
    origin: (origin, cb) => cb(null, !origin || env.clientOrigins.includes(origin)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  }));
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(hpp());
  app.use(morgan(env.isProd ? 'combined' : 'dev', { skip: (req) => req.path === '/api/health' }));

  app.use('/uploads/public', express.static(path.join(UPLOAD_ROOT, 'public'), {
    index: false, dotfiles: 'deny', maxAge: '30d', immutable: true,
  }));

  app.get('/api/health', async (_req, res) => {
    try {
      await query('SELECT 1');
      res.json({ status: 'ok', db: 'up', time: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: 'degraded', db: 'down' });
    }
  });

  app.use('/api', globalLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/me', requireUser, meRoutes);
  app.use('/api/sos', requireUser, sosRoutes);
  app.use('/api/posts', requireUser, postRoutes);
  app.use('/api/fundraisers', requireUser, fundraiserRoutes);
  app.use('/api/chat', requireUser, chatRoutes);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
