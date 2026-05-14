const express = require('express');
const productsController = require('../../controllers/products.controller');
const { asyncHandler } = require('../../middlewares/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(productsController.list));

module.exports = router;
