// api/[...path].js
// Vercel catch-all Serverless Function handling all /api/* endpoints via server/routes.js
const { handleApiRequest } = require('../server/routes.js');

module.exports = async function handler(req, res) {
  return handleApiRequest(req, res);
};
