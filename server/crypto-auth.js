const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function resolveJwtSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) {
    return process.env.JWT_SECRET;
  }
  const secretFile = path.join(__dirname, '..', 'data', '.jwt_secret');
  try {
    if (fs.existsSync(secretFile)) {
      const saved = fs.readFileSync(secretFile, 'utf8').trim();
      if (saved.length >= 32) return saved;
    }
    fs.mkdirSync(path.dirname(secretFile), { recursive: true });
    const generated = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(secretFile, generated, { mode: 0o600 });
    return generated;
  } catch (e) {
    return crypto.randomBytes(48).toString('hex');
  }
}

const JWT_SECRET = resolveJwtSecret();
const TOKEN_COOKIE_NAME = 'easygrow_auth_token';

// In-Memory Rate Limiting for brute-force protection
const loginAttempts = new Map(); // ip -> { count, lockedUntil }
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 mins

function checkRateLimit(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) return { allowed: true };

  if (record.lockedUntil && now < record.lockedUntil) {
    const remainingSec = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      allowed: false,
      error: `Demasiados intentos fallidos. Tu IP está temporalmente bloqueada por ciberseguridad. Intenta de nuevo en ${remainingSec} segundos.`
    };
  }

  if (record.lockedUntil && now >= record.lockedUntil) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }

  return { allowed: true };
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0 };
  record.count += 1;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_TIME;
    console.warn(`[CIBERSEGURIDAD] Bloqueada IP ${ip} por ${LOCKOUT_TIME / 60000} minutos tras múltiples fallos.`);
  }

  loginAttempts.set(ip, record);
}

function clearRateLimit(ip) {
  loginAttempts.delete(ip);
}

// Pure Node.js JWT Implementation (HMAC-SHA256)
function base64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64').toString('utf8');
}

function signJWT(payload, expiresInSeconds = 8 * 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest();
  const encodedSignature = base64url(signature);

  return `${data}.${encodedSignature}`;
}

function verifyJWT(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = base64url(crypto.createHmac('sha256', JWT_SECRET).update(data).digest());
  const sigBuf = Buffer.from(encodedSignature);
  const expBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64urlDecode(encodedPayload));
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch (err) {
    return null;
  }
}

// Parse cookies from request headers
function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
  }
  return list;
}

// Generate Set-Cookie Header
function buildAuthCookie(token, maxAgeSec = 8 * 3600) {
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${TOKEN_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secureFlag}`;
}

function buildClearCookie() {
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${TOKEN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secureFlag}`;
}

module.exports = {
  TOKEN_COOKIE_NAME,
  checkRateLimit,
  recordFailedLogin,
  clearRateLimit,
  signJWT,
  verifyJWT,
  parseCookies,
  buildAuthCookie,
  buildClearCookie
};
