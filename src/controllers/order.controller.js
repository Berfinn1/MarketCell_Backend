const orderService = require('../services/order.service');
const { sendSuccess } = require('../utils/apiResponse');

async function create(req, res) {
  const { delivery_address, items, payment } = req.body ?? {};
  const card_number = payment?.card_number;

  const result = await orderService.createOrder({
    delivery_address,
    items,
    card_number,
    user_id: req.user.id,
  });

  sendSuccess(res, result, 201);
}

module.exports = {
  create,
};
