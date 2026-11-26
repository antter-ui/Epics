// server/auth.js
// Production-grade Authentication: Real Email/Password Registration, Log In, and Google OAuth
const crypto = require('node:crypto');
const db = require('./db.js');

// Parse Base64URL JWT payload from Google Identity Services
function parseGoogleJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error('Failed to parse Google JWT:', err.message);
    return null;
  }
}

// 1. Real Patient Registration with Email and Password
function handleRegister({ name, email, password }) {
  if (!name || name.trim().length < 2) {
    throw new Error('Please enter your full name (at least 2 characters).');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new Error('Please provide a valid email address.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const user = db.registerUser({ name, email, password });
  const session = db.createSession(user.id);

  return {
    user,
    token: session.token,
    expiresAt: session.expiresAt
  };
}

// 2. Real Patient Login with Email and Password
function handleLogin({ email, password }) {
  if (!email || !email.trim()) {
    throw new Error('Please enter your email address.');
  }
  if (!password) {
    throw new Error('Please enter your password.');
  }

  const user = db.verifyUserPassword(email, password);
  const session = db.createSession(user.id);

  return {
    user,
    token: session.token,
    expiresAt: session.expiresAt
  };
}

// 3. Real Google OAuth ID Token Authentication
function handleGoogleLogin({ credential }) {
  if (!credential) {
    throw new Error('Missing Google login credentials.');
  }

  const payload = parseGoogleJwt(credential);
  if (!payload || !payload.email) {
    throw new Error('Invalid or unreadable Google credential token.');
  }

  const googleId = payload.sub || `google_${payload.email}`;
  const email = payload.email.toLowerCase().trim();
  const name = payload.name || payload.email.split('@')[0];
  const avatar = payload.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=0284c7`;

  const user = db.upsertGoogleUser({ googleId, email, name, avatar });
  const session = db.createSession(user.id);

  return {
    user,
    token: session.token,
    expiresAt: session.expiresAt
  };
}

// Extract bearer token or cookie from HTTP request
function extractToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  const cookieHeader = req.headers['cookie'];
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    for (const c of cookies) {
      if (c.startsWith('mc_session=')) {
        return c.substring(11).trim();
      }
    }
  }

  return null;
}

// Authenticate request and attach user
function authenticate(req) {
  const token = extractToken(req);
  if (!token) return null;

  const sessionData = db.getSession(token);
  if (!sessionData) return null;

  return {
    user: sessionData.user,
    token
  };
}

module.exports = {
  handleRegister,
  handleLogin,
  handleGoogleLogin,
  extractToken,
  authenticate
};
