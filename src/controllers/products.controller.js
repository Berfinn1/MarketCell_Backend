const productsService = require('../services/products.service');
const { sendSuccess } = require('../utils/apiResponse');

async function list(req, res) {
  const products = await productsService.listProducts(req.query ?? {});
  sendSuccess(res, { products });
}

module.exports = {
  list,
};
