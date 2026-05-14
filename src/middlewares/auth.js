const jwt = require('jsonwebtoken');
const { HttpError } = require('../utils/httpError');
const { verifyAccessToken } = require('../utils/tokenUtil');

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new HttpError(401, 'Yetkisiz: access token gerekli', 'UNAUTHORIZED');
    }
    const token = header.slice('Bearer '.length).trim();
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      gsm: payload.gsm,
      store_id: payload.store_id ?? null,
    };
    next();
  } catch (e) {
    if (e instanceof HttpError) {
      return next(e);
    }
    if (e instanceof jwt.JsonWebTokenError || e instanceof jwt.TokenExpiredError) {
      return next(new HttpError(401, 'Geçersiz veya süresi dolmuş token', 'INVALID_TOKEN'));
    }
    next(e);
  }
}

/**
 * @param {...string} roles
 */
function requireRoles(...roles) {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new HttpError(401, 'Yetkisiz', 'UNAUTHORIZED');
      }
      if (!roles.includes(req.user.role)) {
        throw new HttpError(403, 'Bu işlem için yetkiniz yok', 'FORBIDDEN');
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}

module.exports = { authenticate, requireRoles };
