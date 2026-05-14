const express = require('express');
const orderController = require('../../controllers/order.controller');
const { authenticate, requireRoles } = require('../../middlewares/auth');
const { asyncHandler } = require('../../middlewares/asyncHandler');

const router = express.Router();

router.post(
  '/',
  authenticate,
  requireRoles('buyer', 'admin'),
  asyncHandler(orderController.create)
);

module.exports = router;
