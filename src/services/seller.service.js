const { pool } = require('../config/db');
const { HttpError } = require('../utils/httpError');

const ALLOWED_TRANSITION = {
  Hazırlanıyor: ['Kargoda'],
};

/**
 * @param {{ id: string, role: string, store_id: string | null }} user
 */
async function listOrdersForSeller(user) {
  const isAdmin = user.role === 'admin';
  if (!isAdmin && !user.store_id) {
    throw new HttpError(403, 'Satıcı paneli için mağaza atanmalı', 'NO_STORE');
  }

  const sql = `
SELECT so.id,
       so.order_id,
       so.store_id,
       so.status,
       o.total_price AS order_total_price,
       o.delivery_address,
       o.created_at AS order_created_at,
       o.user_id AS buyer_user_id
  FROM sub_orders so
  JOIN orders o ON o.id = so.order_id
 WHERE CASE
         WHEN $1::boolean THEN TRUE
         ELSE so.store_id = $2::uuid
       END
 ORDER BY o.created_at DESC
`;

  const { rows } = await pool.query(sql, [isAdmin, user.store_id]);
  return rows;
}

/**
 * @param {{ id: string, role: string, store_id: string | null }} user
 * @param {string} subOrderId
 * @param {string} nextStatus
 */
async function updateSubOrderStatus(user, subOrderId, nextStatus) {
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!subOrderId || !uuidRe.test(String(subOrderId))) {
    throw new HttpError(400, 'Geçersiz subOrderId', 'INVALID_PARAMS');
  }
  const status = String(nextStatus ?? '').trim();
  if (!status) {
    throw new HttpError(400, 'status zorunludur', 'INVALID_BODY');
  }

  const isAdmin = user.role === 'admin';
  if (!isAdmin && !user.store_id) {
    throw new HttpError(403, 'Satıcı paneli için mağaza atanmalı', 'NO_STORE');
  }

  const { rows: currentRows } = await pool.query(
    `SELECT so.id, so.status, so.store_id
       FROM sub_orders so
      WHERE so.id = $1::uuid`,
    [subOrderId]
  );

  if (currentRows.length === 0) {
    throw new HttpError(404, 'Alt sipariş bulunamadı', 'NOT_FOUND');
  }

  const current = currentRows[0];
  if (!isAdmin && current.store_id !== user.store_id) {
    throw new HttpError(403, 'Bu alt siparişe erişemezsiniz', 'FORBIDDEN');
  }

  const allowed = ALLOWED_TRANSITION[current.status];
  if (!allowed || !allowed.includes(status)) {
    throw new HttpError(
      400,
      `Geçersiz durum geçişi: ${current.status} -> ${status}. İzinli: Hazırlanıyor -> Kargoda`,
      'INVALID_STATUS'
    );
  }

  const { rows } = await pool.query(
    `UPDATE sub_orders
        SET status = $1
      WHERE id = $2::uuid
  RETURNING id, order_id, store_id, status`,
    [status, subOrderId]
  );

  return rows[0];
}

module.exports = {
  listOrdersForSeller,
  updateSubOrderStatus,
};
