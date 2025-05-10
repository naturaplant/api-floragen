import { Hono } from 'hono';
import { CloudflareBindings } from '../worker-configuration'; // Assumindo que worker-configuration.ts existe ou será gerado
import plants from './features/plants/plantRoutes';

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get('/', (c) => {
  return c.text('Hello Hono with Plants API!');
});

// Monta as rotas de plantas sob o prefixo '/plants'
app.route('/plants', plants);

export default app;