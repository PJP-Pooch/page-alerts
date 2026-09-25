const crypto = require('crypto');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const ALLOWED_DOMAIN = process.env.GOOGLE_ALLOWED_DOMAIN || '';
const SESSION_SECRET = process.env.SESSION_SECRET || 'page-alerts-secure-session-secret-2026';
const COOKIE_NAME = 'pa_session';

function isAuthConfigured() {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

function getRedirectUri(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  return `${proto}://${host}/api/auth/callback`;
}

/**
 * Creates a signed JWT-like token (payload.signature)
 */
function createSignedToken(payload) {
  const dataStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(dataStr)
    .digest('base64url');
  return `${dataStr}.${signature}`;
}

/**
 * Verifies and decodes signed token
 */
function verifySignedToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [dataStr, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(dataStr)
    .digest('base64url');

  if (signature !== expectedSig) return null;

  try {
    const payload = JSON.parse(Buffer.from(dataStr, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Checks if an email is permitted by the domain whitelist
 */
function isEmailAllowed(email) {
  if (!ALLOWED_DOMAIN) return true; // If no domain specified, permit any valid Google account
  const allowedList = ALLOWED_DOMAIN.split(',').map(d => d.trim().toLowerCase().replace(/^@/, ''));
  const userDomain = email.split('@')[1]?.toLowerCase();
  return allowedList.includes(userDomain);
}

/**
 * Express Middleware: Protects routes and APIs
 */
function requireAuth(req, res, next) {
  // If Google Auth is not configured yet (e.g. env vars not set), permit access
  if (!isAuthConfigured()) {
    req.user = { email: 'admin@local', name: 'Admin', isLocalBypass: true };
    return next();
  }

  // Allow Vercel Cron jobs or internal cron requests to run uninterrupted
  if (req.headers['x-vercel-cron'] || req.path.includes('/api/cron')) {
    return next();
  }

  const token = req.cookies ? req.cookies[COOKIE_NAME] : null;
  const user = verifySignedToken(token);

  if (user && isEmailAllowed(user.email)) {
    req.user = user;
    return next();
  }

  // If requesting API endpoint, return 401
  const isApi = (req.originalUrl || req.url || req.path || '').startsWith('/api/');
  if (isApi) {
    return res.status(401).json({
      error: 'Unauthorized',
      authConfigured: true,
      allowedDomain: ALLOWED_DOMAIN || null
    });
  }

  // If requesting page HTML, proceed (frontend will display Google Login modal/view)
  return next();
}

module.exports = {
  CLIENT_ID,
  CLIENT_SECRET,
  ALLOWED_DOMAIN,
  COOKIE_NAME,
  isAuthConfigured,
  getRedirectUri,
  createSignedToken,
  verifySignedToken,
  isEmailAllowed,
  requireAuth
};
