// Worker entry. Static assets (the built SPA) are served by the platform; this
// code only runs for /api/* and /auth/* (see run_worker_first in wrangler.toml).
import { Hono } from 'hono';
import { handleError } from './access';
import { campaignRoutes } from './api/campaigns';
import { characterRoutes } from './api/characters';
import { contentRoutes } from './api/content';
import { mapRoutes } from './api/maps';
import { authRoutes, loadUser } from './auth';
import { notionRoutes } from './notion/routes';
import { settingsRoutes } from './api/settings';
import type { AppEnv } from './types';

const app = new Hono<AppEnv>();

app.onError(handleError);

app.use('*', async (c, next) => {
  c.set('user', await loadUser(c));
  await next();
});

app.route('/auth', authRoutes);

app.get('/api/me', (c) => {
  const user = c.get('user');
  return user ? c.json({ user }) : c.json({ user: null }, 401);
});

app.route('/api/notion', notionRoutes);
app.route('/api', campaignRoutes);
app.route('/api', characterRoutes);
app.route('/api', mapRoutes);
app.route('/api', settingsRoutes);
app.route('/api', contentRoutes);

app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
export { TableRoom } from './table';
