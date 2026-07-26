import http from 'node:http';

/**
 * Minimal Fabric API mock for extension e2e tests.
 * Modes: success | unauthorized | forbidden | rateLimited | serverError
 */
export function createMockApi(options = {}) {
  let mode = options.mode || 'success';
  let retryAfterSeconds = options.retryAfterSeconds ?? 120;
  let lastRequest = null;
  let requestCount = 0;

  const server = http.createServer((req, res) => {
    requestCount += 1;
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const bodyText = Buffer.concat(chunks).toString('utf8');
      lastRequest = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: bodyText ? JSON.parse(bodyText) : null
      };

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.url === '/v2/user/me' && req.method === 'GET') {
        if (mode === 'unauthorized') {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'unauthorized' }));
          return;
        }
        if (mode === 'serverError') {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'server' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 'user-1', email: 'test@example.com' }));
        return;
      }

      if (req.url === '/v2/bookmarks' && req.method === 'POST') {
        if (mode === 'unauthorized') {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'unauthorized' }));
          return;
        }
        if (mode === 'forbidden') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'forbidden' }));
          return;
        }
        if (mode === 'rateLimited') {
          res.writeHead(429, {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfterSeconds)
          });
          res.end(JSON.stringify({ error: 'rate limited' }));
          return;
        }
        if (mode === 'serverError') {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'server' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 'bookmark-fixture-1' }));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
    });
  });

  return {
    async start() {
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const { port } = server.address();
      return {
        baseUrl: `http://127.0.0.1:${port}`,
        port
      };
    },
    setMode(next) {
      mode = next;
    },
    setRetryAfterSeconds(seconds) {
      retryAfterSeconds = seconds;
    },
    getLastRequest() {
      return lastRequest;
    },
    getRequestCount() {
      return requestCount;
    },
    async stop() {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  };
}
