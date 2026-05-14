const express = require('express');
const authController = require('../../controllers/auth.controller');
const { asyncHandler } = require('../../middlewares/asyncHandler');

const router = express.Router();

router.post('/register', asyncHandler(authController.register));
router.post('/verify-otp', asyncHandler(authController.verifyOtp));
router.post('/refresh', asyncHandler(authController.refresh));

module.exports = router;
