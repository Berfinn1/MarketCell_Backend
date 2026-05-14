const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');

function hashOpaqueToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function generateOpaqueRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

/**
 * @param {{ id: string, role: string, gsm: string, store_id: string | null }} user
 */
function signAccessToken(user) {
  if (!jwtConfig.accessSecret) {
    throw new Error('JWT_ACCESS_SECRET is not set');
  }
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      gsm: user.gsm,
      store_id: user.store_id,
    },
    jwtConfig.accessSecret,
    { expiresIn: jwtConfig.accessExpiresIn }
  );
}

/**
 * @param {string} token
 */
function verifyAccessToken(token) {
  if (!jwtConfig.accessSecret) {
    throw new Error('JWT_ACCESS_SECRET is not set');
  }
  return jwt.verify(token, jwtConfig.accessSecret);
}

/**
 * @param {string} expiresIn - e.g. '7d'
 */
function refreshTokenExpiresAt(expiresIn) {
  const match = /^(\d+)([smhd])$/.exec(String(expiresIn).trim());
  if (!match) {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  const n = Number(match[1]);
  const u = match[2];
  const mult =
    u === 's' ? 1000
    : u === 'm' ? 60 * 1000
    : u === 'h' ? 60 * 60 * 1000
    : 24 * 60 * 60 * 1000;
  return new Date(Date.now() + n * mult);
}

module.exports = {
  hashOpaqueToken,
  generateOpaqueRefreshToken,
  signAccessToken,
  verifyAccessToken,
  refreshTokenExpiresAt,
};
