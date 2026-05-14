const authService = require('../services/auth.service');
const { sendSuccess } = require('../utils/apiResponse');

async function register(req, res) {
  const { gsm } = req.body ?? {};
  const data = await authService.register({ gsm });
  sendSuccess(res, data, 200);
}

async function verifyOtp(req, res) {
  const { gsm, otp } = req.body ?? {};
  const data = await authService.verifyOtp({ gsm, otp });
  sendSuccess(res, data, 200);
}

async function refresh(req, res) {
  const { refresh_token } = req.body ?? {};
  const data = await authService.refresh({ refresh_token });
  sendSuccess(res, data, 200);
}

module.exports = {
  register,
  verifyOtp,
  refresh,
};
