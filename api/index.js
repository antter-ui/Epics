// api/index.js
// Vercel Serverless Function entrypoint delegating /api/* to server/routes.js
const { handleApiRequest } = require('../server/routes.js');

module.exports = async function handler(req, res) {
  return handleApiRequest(req, res);
};
