// server/server.js
// Main HTTP Server for MediCare Connect
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const url = require('node:url');
const { handleApiRequest } = require('./routes.js');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const DEFAULT_PORT = parseInt(process.env.PORT || '3000', 10);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

function serveStatic(req, res) {
  const parsedUrl = url.parse(req.url);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Prevent directory traversal attacks
  pathname = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  let filePath = path.join(PUBLIC_DIR, pathname);

  // Support directory index.html and clean extensionless page routes (e.g. /about -> /about.html)
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    const dirIndex = path.join(filePath, 'index.html');
    if (fs.existsSync(dirIndex)) filePath = dirIndex;
  } else if (!path.extname(pathname) && fs.existsSync(filePath + '.html')) {
    filePath = filePath + '.html';
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // If file not found and doesn't look like a direct asset file, fallback to index.html (SPA)
      const ext = path.extname(pathname);
      if (!ext || ext === '.html') {
        const indexPath = path.join(PUBLIC_DIR, 'index.html');
        return fs.readFile(indexPath, (readErr, content) => {
          if (readErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('404 Not Found');
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
        });
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found: ' + pathname);
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

function startServer(port = DEFAULT_PORT) {
  const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url);
    if (parsedUrl.pathname.startsWith('/api/')) {
      return handleApiRequest(req, res);
    }
    return serveStatic(req, res);
  });

  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${port} is in use. Trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });

  server.listen(port, () => {
    console.log(`\n======================================================`);
    console.log(`🏥 MediCare Connect Platform is Live!`);
    console.log(`🌐 Local URL:  http://localhost:${port}`);
    console.log(`🔒 Google OAuth & SQLite Ready`);
    console.log(`======================================================\n`);
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
