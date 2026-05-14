/**
 * @param {import('express').Response} res
 * @param {unknown} data
 * @param {number} [httpStatus]
 */
function sendSuccess(res, data, httpStatus = 200) {
  return res.status(httpStatus).json({
    status: 'success',
    data,
    error: null,
  });
}

/**
 * @param {import('express').Response} res
 * @param {number} httpStatus
 * @param {string} message
 * @param {string} [code]
 */
function sendError(res, httpStatus, message, code) {
  return res.status(httpStatus).json({
    status: 'error',
    data: null,
    error: {
      message,
      ...(code ? { code } : {}),
    },
  });
}

module.exports = { sendSuccess, sendError };
