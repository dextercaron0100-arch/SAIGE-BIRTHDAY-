import { config } from 'dotenv';
import { createServer } from 'node:http';
import { createHandler } from './http.js';

config({ path: ['.env.local', '.env'], quiet: true });
const server = createServer((req, res) => {
  const route = new URL(req.url ?? '/', 'http://localhost').pathname;
  void createHandler(route)(req, res);
});
server.requestTimeout = 15_000;
server.listen(3001, '127.0.0.1', () =>
  console.info('Local invitation API ready on http://127.0.0.1:3001'),
);
