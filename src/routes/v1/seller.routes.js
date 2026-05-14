const express = require('express');
const sellerController = require('../../controllers/seller.controller');
const { authenticate, requireRoles } = require('../../middlewares/auth');
const { asyncHandler } = require('../../middlewares/asyncHandler');

const router = express.Router();

router.get(
  '/orders',
  authenticate,
  requireRoles('seller', 'admin'),
  asyncHandler(sellerController.listOrders)
);

router.patch(
  '/orders/:subOrderId',
  authenticate,
  requireRoles('seller', 'admin'),
  asyncHandler(sellerController.patchOrderStatus)
);

module.exports = router;
