// api/server.js
// Vercel Serverless Function handling all /api/* endpoints via vercel.json rewrite
const { handleApiRequest } = require('../server/routes.js');

module.exports = async function handler(req, res) {
  const parsed = new URL(req.url || '/api', 'http://localhost');
  const rewrittenPath = parsed.searchParams.get('__apiPath');
  if (rewrittenPath !== null) {
    parsed.searchParams.delete('__apiPath');
    const qs = parsed.searchParams.toString();
    req.url = `/api/${rewrittenPath.replace(/^\/+/, '')}${qs ? '?' + qs : ''}`;
  }
  return handleApiRequest(req, res);
};
