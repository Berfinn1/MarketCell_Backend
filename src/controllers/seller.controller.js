const sellerService = require('../services/seller.service');
const { sendSuccess } = require('../utils/apiResponse');

async function listOrders(req, res) {
  const orders = await sellerService.listOrdersForSeller(req.user);
  sendSuccess(res, { sub_orders: orders });
}

async function patchOrderStatus(req, res) {
  const { subOrderId } = req.params;
  const { status } = req.body ?? {};
  const updated = await sellerService.updateSubOrderStatus(req.user, subOrderId, status);
  sendSuccess(res, { sub_order: updated });
}

module.exports = {
  listOrders,
  patchOrderStatus,
};
