const { pool } = require('../config/db');
const { HttpError } = require('../utils/httpError');

function normalizeCardNumber(cardNumber) {
  return String(cardNumber ?? '').replace(/\s+/g, '');
}

function assertPaycell(cardNumber) {
  const digits = normalizeCardNumber(cardNumber);
  if (digits.startsWith('4000')) {
    throw new HttpError(402, 'Ödeme Başarısız', 'PAYMENT_DECLINED');
  }
  if (!digits.startsWith('4242')) {
    throw new HttpError(400, 'Ödeme onaylanmadı', 'PAYMENT_REJECTED');
  }
}

/**
 * @param {object} input
 * @param {string} input.delivery_address
 * @param {{ product_id: string, quantity: number }[]} input.items
 * @param {string} input.card_number
 * @param {string} input.user_id
 */
async function createOrder({ delivery_address, items, card_number, user_id }) {
  if (!user_id) {
    throw new HttpError(401, 'Kimlik doğrulama gerekli', 'UNAUTHORIZED');
  }
  if (!delivery_address || typeof delivery_address !== 'string') {
    throw new HttpError(400, 'delivery_address zorunludur', 'INVALID_BODY');
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(400, 'Sepet boş olamaz', 'EMPTY_CART');
  }

  const merged = new Map();
  for (const line of items) {
    const pid = line?.product_id;
    const qty = Number(line?.quantity);
    if (!pid || !Number.isInteger(qty) || qty < 1) {
      throw new HttpError(
        400,
        'Her kalem için geçerli product_id ve pozitif quantity gerekir',
        'INVALID_LINE'
      );
    }
    merged.set(pid, (merged.get(pid) ?? 0) + qty);
  }

  const productIds = [...merged.keys()].sort();

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const { rows: lockedProducts } = await client.query(
      `SELECT id, store_id, base_price, stock_count
         FROM products
        WHERE id = ANY($1::uuid[])
     ORDER BY id
        FOR UPDATE`,
      [productIds]
    );

    if (lockedProducts.length !== productIds.length) {
      throw new HttpError(400, 'Sepette geçersiz veya bulunamayan ürün var', 'INVALID_PRODUCT');
    }

    let totalPrice = 0;
    const storeIds = new Set();

    for (const p of lockedProducts) {
      const need = merged.get(p.id);
      if (p.stock_count < need) {
        throw new HttpError(409, `Yetersiz stok: ürün ${p.id}`, 'INSUFFICIENT_STOCK');
      }
      totalPrice += Number(p.base_price) * need;
      storeIds.add(p.store_id);
    }

    const totalRounded = Number(totalPrice.toFixed(2));

    for (const p of lockedProducts) {
      const need = merged.get(p.id);
      await client.query(
        `UPDATE products
            SET stock_count = stock_count - $1
          WHERE id = $2`,
        [need, p.id]
      );
    }

    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (total_price, delivery_address, user_id)
       VALUES ($1, $2, $3)
    RETURNING id, total_price, delivery_address, user_id, created_at`,
      [totalRounded, delivery_address, user_id]
    );
    const order = orderRows[0];

    const subOrders = [];
    for (const storeId of [...storeIds].sort()) {
      const { rows: subRows } = await client.query(
        `INSERT INTO sub_orders (order_id, store_id, status)
         VALUES ($1, $2, $3)
      RETURNING id, order_id, store_id, status`,
        [order.id, storeId, 'Hazırlanıyor']
      );
      subOrders.push(subRows[0]);
    }

    assertPaycell(card_number);

    await client.query('COMMIT');

    return { order, sub_orders: subOrders };
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore
      }
    }
    throw err;
  } finally {
    if (client) client.release();
  }
}

module.exports = {
  createOrder,
};
