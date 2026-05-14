const { HttpError } = require('../utils/httpError');
const { sendError } = require('../utils/apiResponse');

function errorHandler(err, req, res, _next) {
  console.error(err);

  if (res.headersSent) {
    return;
  }

  const statusCode =
    err instanceof HttpError
      ? err.statusCode
      : typeof err.statusCode === 'number' && Number.isInteger(err.statusCode)
        ? err.statusCode
        : 500;

  const message =
    statusCode === 500 ? 'Internal Server Error' : err.message || 'Hata';

  const code =
    err instanceof HttpError && err.code
      ? err.code
      : statusCode === 500
        ? 'INTERNAL_ERROR'
        : undefined;

  return sendError(res, statusCode, message, code);
}

module.exports = { errorHandler };
